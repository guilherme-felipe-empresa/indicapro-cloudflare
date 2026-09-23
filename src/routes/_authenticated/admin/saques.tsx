import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatDate } from "@/lib/money";
import { FilterChips, LoadMore } from "@/components/ListControls";

export const Route = createFileRoute("/_authenticated/admin/saques")({
  head: () => ({
    meta: [
      { title: "Saques — Administração IndicaPro" },
      { name: "description", content: "Gerencie solicitações de saque PIX dos indicadores." },
      { property: "og:title", content: "Saques — Administração IndicaPro" },
      { property: "og:description", content: "Gerencie solicitações de saque PIX." },
    ],
  }),
  component: AdminWithdrawals,
});

const LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  failed: "Falhou",
  rejected: "Recusado",
};

function AdminWithdrawals() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"all" | "pending" | "paid" | "other">("pending");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);

  const list = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name, email");
      if (error) throw error;
      return data;
    },
  });

  async function decide(id: string, status: "paid" | "failed" | "rejected") {
    if (busyId) return;
    setBusyId(id);
    const { error } = await supabase.rpc("set_withdrawal_status", { _id: id, _status: status, ...(notes[id] ? { _note: notes[id]!, _reference: notes[id]! } : {}) });
    setBusyId(null);
    if (error) {
      toast.error(
        error.message.includes("ja processado")
          ? "Este saque já foi processado."
          : "Não foi possível atualizar o saque.",
      );
    } else {
      toast.success("Saque atualizado.");
    }
    qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  if (list.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const all = list.data ?? [];
  const term = search.trim().toLowerCase();
  const filtered = all
    .filter((w) =>
      status === "all"
        ? true
        : status === "other"
          ? w.status !== "pending" && w.status !== "paid"
          : w.status === status,
    )
    .filter((w) => {
      if (!term) return true;
      const p = profiles.data?.find((x) => x.id === w.user_id);
      return (
        (p?.name ?? "").toLowerCase().includes(term) ||
        (p?.email ?? "").toLowerCase().includes(term) ||
        String(w.pix_key ?? "").toLowerCase().includes(term)
      );
    });

  const pendingCount = all.filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9 pr-9"
          placeholder="Buscar por nome, e-mail ou chave PIX"
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
          { value: "pending", label: "Pendentes", count: pendingCount },
          { value: "paid", label: "Pagos" },
          { value: "other", label: "Recusados / falhas" },
          { value: "all", label: "Todos", count: all.length },
        ]}
      />

      {filtered.length > 0 ? (
        <>
          {filtered.slice(0, limit).map((w) => {
            const p = profiles.data?.find((x) => x.id === w.user_id);
            return (
              <div key={w.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{p?.name || p?.email || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(w.created_at)}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      PIX ({w.pix_key_type}): {w.pix_key}
                    </p>
                    {w.note && <p className="mt-1 text-xs text-muted-foreground">Obs: {w.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-extrabold">{formatBRL(w.amount_cents)}</p>
                    <Badge variant={w.status === "paid" ? "default" : "secondary"}>
                      {LABEL[w.status] ?? w.status}
                    </Badge>
                  </div>
                </div>
                {w.status === "pending" && (
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder="Observação / identificador do pagamento"
                      className="h-11"
                      value={notes[w.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [w.id]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="h-11 flex-1"
                        disabled={busyId === w.id}
                        onClick={() => decide(w.id, "paid")}
                      >
                        Marcar pago
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 flex-1"
                        disabled={busyId === w.id}
                        onClick={() => decide(w.id, "failed")}
                      >
                        Marcar falha
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 flex-1"
                        disabled={busyId === w.id}
                        onClick={() => decide(w.id, "rejected")}
                      >
                        Recusar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <LoadMore
            shown={limit}
            total={filtered.length}
            onMore={() => setLimit((n) => n + 10)}
            noun="saques"
          />
        </>
      ) : (
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">
          {all.length > 0
            ? "Nenhum saque encontrado com esses filtros."
            : "Nenhuma solicitação de saque."}
        </p>
      )}
    </div>
  );
}
