import { createFileRoute, useSearch, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/money";
import { useAuth } from "@/hooks/useAuth";
import { useAppName } from "@/hooks/useAppName";


type Search = { ref?: string | undefined };

export const Route = createFileRoute("/produto/$slug")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ref: typeof search["ref"] === "string" ? search["ref"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Produto — IndicaPro" },
      { name: "description", content: "Confira este produto e finalize sua compra pelo WhatsApp." },
      { property: "og:title", content: "Produto — IndicaPro" },
      { property: "og:description", content: "Confira este produto e compre pelo WhatsApp." },
    ],
  }),
  component: PublicProduct,
});

function PublicProduct() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const { ref } = useSearch({ from: "/produto/$slug" });
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const appName = useAppName();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      void router.navigate({ to: "/" });
    }
  }

  const backBar = (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          aria-label="Voltar"
          className="-ml-2 h-10 gap-2 px-2 font-semibold"
        >
          <ArrowLeft className="size-5" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <span className="flex-1 text-center text-base font-bold text-primary">{appName}</span>
        <span className="w-10 sm:w-20" aria-hidden="true" />
      </div>
    </header>
  );


  const product = useQuery({
    queryKey: ["public-product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, description, image_url, price_cents, active")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function buy() {
    if (busy) return;
    if (!user) {
      toast.info("Entre ou crie sua conta para finalizar a compra.");
      void router.navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_purchase_intent", { _slug: slug, ...(ref ? { _ref: ref } : {}) });
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      toast.error("Não foi possível iniciar a compra. Tente novamente.");
      return;
    }
    const { data: me } = await supabase
      .from("profiles")
      .select("name, email, phone")
      .eq("id", user.id)
      .maybeSingle();
    const buyer = (me?.name || "").trim() || (me?.email || user.email || "").split("@")[0] || "";
    const phoneLine = me?.phone ? `\nMeu contato: ${me.phone}` : "";
    const msg = `Olá! Sou ${buyer} e tenho interesse no produto ${row.product_name}.${phoneLine}\n\nCódigo da indicação: ${row.code}`;
    const phone = String(row.whatsapp_number).replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }

  if (product.isLoading) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden">
        {backBar}
        <div className="mx-auto max-w-lg px-4 py-8">
          <Skeleton className="aspect-square w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!product.data) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden">
        {backBar}
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
          <div>
            <h1 className="text-xl font-bold">Produto indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este produto não está mais disponível para compra.
            </p>
            <Button onClick={goBack} className="mt-4 h-11">
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const p = product.data;

  return (
    <div className="min-h-screen w-full overflow-x-hidden pb-28">
      {backBar}
      <div className="mx-auto w-full max-w-3xl px-4 pt-4">

        <div className="grid gap-6 md:grid-cols-2">
          <div className="surface-card aspect-square overflow-hidden bg-muted">
            {p.image_url && (
              <img src={p.image_url} alt={p.name} className="size-full object-cover" />
            )}
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-extrabold tracking-tight">{p.name}</h1>
            <p className="text-3xl font-extrabold text-primary">{formatBRL(p.price_cents)}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
            <Button onClick={buy} disabled={busy} className="hidden h-12 w-full md:flex">
              <MessageCircle className="size-4" />
              {busy ? "Abrindo WhatsApp..." : "Comprar pelo WhatsApp"}
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur md:hidden">
        <Button onClick={buy} disabled={busy} className="h-13 w-full py-3.5 text-base">
          <MessageCircle className="size-5" />
          {busy ? "Abrindo WhatsApp..." : "Comprar pelo WhatsApp"}
        </Button>
      </div>
    </div>
  );
}
