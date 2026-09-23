import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatDate } from "@/lib/money";
import { FilterChips, LoadMore } from "@/components/ListControls";

export const Route = createFileRoute("/_authenticated/indicacoes")({
  head: () => ({
    meta: [
      { title: "Minhas indicações — IndicaPro" },
      { name: "description", content: "Acompanhe suas indicações e o status de cada comissão." },
      { property: "og:title", content: "Minhas indicações — IndicaPro" },
      { property: "og:description", content: "Acompanhe suas indicações e o status de cada comissão." },
    ],
  }),
  component: MinhasIndicacoes,
});

const LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "Pendente", className: "bg-secondary text-secondary-foreground" },
  approved: { text: "Liberada", className: "bg-primary text-primary-foreground" },
  failed: { text: "Não aprovada", className: "bg-destructive text-destructive-foreground" },
};

function MinhasIndicacoes() {
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "failed">("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);

  const q = useQuery({
    queryKey: ["my-intents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_intents")
        .select("id, code, product_name, commission_cents, price_cents, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const term = search.trim().toLowerCase();
  const list = (q.data ?? [])
    .filter((i) => (status === "all" ? true : i.status === status))
    .filter((i) =>
      !term
        ? true
        : i.code.toLowerCase().includes(term) || i.product_name.toLowerCase().includes(term),
    );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold tracking-tight">Minhas indicações</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9 pr-9"
          placeholder="Buscar por código ou produto"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setLimit(10); }}
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            className="absolute right-1 top-1/2 size-9 -translate-y-1/2 p-0"
            onClick={() => setSearch("")}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <FilterChips
        value={status}
        onChange={(v) => { setStatus(v); setLimit(10); }}
        options={[
          { value: "all", label: "Todas" },
          { value: "pending", label: "Pendentes" },
          { value: "approved", label: "Liberadas" },
          { value: "failed", label: "Não aprovadas" },
        ]}
      />

      {q.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : q.error ? (
        <p className="text-sm text-destructive">Não foi possível carregar suas indicações.</p>
      ) : list.length > 0 ? (
        <>
          <ul className="space-y-3">
            {list.slice(0, limit).map((i) => {
              const label = LABEL[i.status] ?? LABEL["pending"]!;
              return (
                <li key={i.id} className="surface-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{i.product_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {i.code} · {formatDate(i.created_at)}
                      </p>
                    </div>
                    <Badge className={label.className}>{label.text}</Badge>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <span className="text-xs text-muted-foreground">
                      Venda {formatBRL(i.price_cents)}
                    </span>
                    <span className="text-base font-extrabold text-primary">
                      {formatBRL(i.commission_cents)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <LoadMore
            shown={limit}
            total={list.length}
            onMore={() => setLimit((n) => n + 10)}
            noun="indicações"
          />
        </>
      ) : (
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">
          {q.data && q.data.length > 0
            ? "Nenhuma indicação encontrada com esses filtros."
            : "Você ainda não tem indicações. Compartilhe um produto para começar."}
        </p>
      )}
    </div>
  );
}
