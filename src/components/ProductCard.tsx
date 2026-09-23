import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, Share2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { commissionCents, formatBRL, type CommissionType } from "@/lib/money";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  price_cents: number;
  commission_type: CommissionType;
  commission_value: number;
  active: boolean;
  category?: string | null;
};

export function ProductCard({ product }: { product: Product }) {
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  function requireLogin(acao = "divulgar este produto") {
    if (user) return false;
    toast.info(`Crie sua conta ou entre para ${acao}.`);
    void navigate({ to: "/auth" });
    return true;
  }

  function handleBuy(e: React.MouseEvent) {
    if (!user) {
      e.preventDefault();
      requireLogin("comprar este produto");
    }
  }
  const commission = commissionCents(
    product.price_cents,
    product.commission_type,
    product.commission_value,
  );

  async function buildLink(): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_or_create_referral_link", {
      _product_id: product.id,
    });
    if (error || !data) {
      toast.error("Não foi possível gerar seu link agora.");
      return null;
    }
    return `${window.location.origin}/produto/${product.slug}?ref=${data}`;
  }

  async function share() {
    if (busy || requireLogin()) return;
    setBusy(true);
    const url = await buildLink();
    if (!url) return setBusy(false);
    const text = `Olha esse produto: ${product.name} — ${formatBRL(product.price_cents)}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: product.name, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch {
      /* usuário cancelou o compartilhamento */
    }
    setBusy(false);
  }

  async function copy() {
    if (busy || requireLogin()) return;
    setBusy(true);
    const url = await buildLink();
    if (url) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      } catch {
        toast.error("Não foi possível copiar. Tente compartilhar.");
      }
    }
    setBusy(false);
  }

  return (
    <article className="surface-card flex flex-col overflow-hidden shadow-sm">
      <div className="aspect-square w-full bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category ? (
          <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {product.category}
          </span>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold leading-snug">{product.name}</h3>
          {!product.active && <Badge variant="secondary">Inativo</Badge>}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        <p className="text-lg font-extrabold">{formatBRL(product.price_cents)}</p>
        <Badge className="w-fit bg-accent text-accent-foreground hover:bg-accent">
          Ganhe {formatBRL(commission)} indicando
        </Badge>
        <div className="mt-auto flex flex-col gap-2 pt-3">
          <Button asChild variant="outline" className="h-11">
            <Link to="/produto/$slug" params={{ slug: product.slug }} onClick={handleBuy}>
              <ShoppingBag className="size-4" /> Comprar
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button className="h-11 flex-1" onClick={share} disabled={busy}>
              <Share2 className="size-4" /> Divulgar
            </Button>
            <Button
              variant="secondary"
              className="h-11 px-3"
              onClick={copy}
              disabled={busy}
              aria-label="Copiar link"
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
