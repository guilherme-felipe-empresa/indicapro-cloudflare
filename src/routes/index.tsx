import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type Product } from "@/components/ProductCard";
import { AppShell } from "@/components/AppShell";
import { FilterChips, LoadMore } from "@/components/ListControls";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { commissionCents, formatBRL } from "@/lib/money";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSummary } from "@/hooks/useWalletSummary";

type Ordem = "recentes" | "comissao" | "preco-asc" | "preco-desc";
const PASSO = 6;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Produtos — IndicaPro" },
      {
        name: "description",
        content: "Veja os produtos disponíveis e quanto você ganha ao indicar cada um.",
      },
      { property: "og:title", content: "Produtos — IndicaPro" },
      {
        property: "og:description",
        content: "Veja os produtos disponíveis e quanto você ganha ao indicar.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, loading } = useAuth();
  const wallet = useWalletSummary(!!user);
  const products = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("all");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [limite, setLimite] = useState(PASSO);

  const categorias = useMemo(() => {
    const set = new Set(
      (products.data ?? []).map((p) => (p.category ?? "").trim()).filter(Boolean),
    );
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [products.data]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const arr = (products.data ?? []).filter((p) => {
      if (categoria !== "all" && (p.category ?? "").trim() !== categoria) return false;
      if (!termo) return true;
      return `${p.name} ${p.description} ${p.category ?? ""}`.toLowerCase().includes(termo);
    });
    const com = (p: Product) => commissionCents(p.price_cents, p.commission_type, p.commission_value);
    if (ordem === "comissao") return [...arr].sort((a, b) => com(b) - com(a));
    if (ordem === "preco-asc") return [...arr].sort((a, b) => a.price_cents - b.price_cents);
    if (ordem === "preco-desc") return [...arr].sort((a, b) => b.price_cents - a.price_cents);
    return arr;
  }, [products.data, busca, categoria, ordem]);

  return (
    <AppShell>
      <div className="space-y-6">
        {user ? (
          <section className="balance-panel p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium opacity-80">Saldo disponível</p>
                <p className="text-3xl font-extrabold tracking-tight">
                  {wallet.isLoading ? "—" : formatBRL(wallet.data?.available)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium opacity-80">Pendente</p>
                <p className="text-xl font-bold">
                  {wallet.isLoading ? "—" : formatBRL(wallet.data?.pending)}
                </p>
              </div>
            </div>
          </section>
        ) : loading ? null : (
          <section className="balance-panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-lg font-extrabold tracking-tight">
                Indique produtos e ganhe comissão
              </p>
              <p className="text-xs font-medium opacity-80">
                Crie sua conta grátis para divulgar, comprar e receber via PIX.
              </p>
            </div>
            <Button asChild variant="secondary" className="h-11 font-semibold">
              <Link to="/auth">Entrar ou criar conta</Link>
            </Button>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Produtos para indicar</h2>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 pl-9 pr-10"
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setLimite(PASSO);
                }}
              />
              {busca && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setBusca("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {categorias.length > 1 && (
              <FilterChips
                options={categorias.map((c) => ({ value: c, label: c === "all" ? "Todas" : c }))}
                value={categoria}
                onChange={(v) => {
                  setCategoria(v);
                  setLimite(PASSO);
                }}
              />
            )}

            <Select
              value={ordem}
              onValueChange={(v) => {
                setOrdem(v as Ordem);
                setLimite(PASSO);
              }}
            >
              <SelectTrigger className="h-11 w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="comissao">Maior comissão</SelectItem>
                <SelectItem value="preco-asc">Menor preço</SelectItem>
                <SelectItem value="preco-desc">Maior preço</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {products.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-80 w-full rounded-xl" />
              ))}
            </div>
          ) : products.error ? (
            <p className="text-sm text-destructive">Não foi possível carregar os produtos.</p>
          ) : filtrados.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtrados.slice(0, limite).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <LoadMore
                shown={limite}
                total={filtrados.length}
                step={PASSO}
                noun="produtos"
                onMore={() => setLimite((l) => l + PASSO)}
              />
            </>
          ) : (
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              {products.data && products.data.length > 0
                ? "Nenhum produto encontrado com esses filtros."
                : "Nenhum produto disponível no momento."}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
