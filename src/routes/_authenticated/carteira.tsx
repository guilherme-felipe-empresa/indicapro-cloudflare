import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatDate, parseBRLToCents } from "@/lib/money";
import { useWalletSummary } from "@/hooks/useWalletSummary";
import { useAuth } from "@/hooks/useAuth";
import { FilterChips, LoadMore } from "@/components/ListControls";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira — IndicaPro" },
      { name: "description", content: "Veja seu saldo, extrato de comissões e solicite saques via PIX." },
      { property: "og:title", content: "Carteira — IndicaPro" },
      { property: "og:description", content: "Veja seu saldo e solicite saques via PIX." },
    ],
  }),
  component: Carteira,
});

const WD_LABEL: Record<string, string> = {
  pending: "Em análise",
  paid: "Pago",
  failed: "Falhou",
  rejected: "Recusado",
};

const TX_LABEL: Record<string, string> = {
  commission_credit: "Comissão",
  withdrawal_debit: "Saque solicitado",
  adjustment: "Ajuste",
};

function Carteira() {
  const qc = useQueryClient();
  const wallet = useWalletSummary();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "in" | "out">("all");
  const [txLimit, setTxLimit] = useState(10);
  const [wdFilter, setWdFilter] = useState<"all" | "pending" | "paid" | "other">("all");
  const [wdLimit, setWdLimit] = useState(10);

  const { user } = useAuth();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("pix_key, pix_key_type")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const txs = useQuery({
    queryKey: ["wallet-tx"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, type, amount_cents, description, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const withdrawals = useQuery({
    queryKey: ["my-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("id, amount_cents, status, pix_key, created_at, paid_at, note")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function requestWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const cents = parseBRLToCents(amount);
    if (cents <= 0) { toast.error("Informe um valor válido."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("request_withdrawal", { _amount_cents: cents });
    setBusy(false);
    if (error) { toast.error(traduzir(error.message)); return; }
    toast.success("Solicitação de saque enviada!");
    setAmount("");
    qc.invalidateQueries({ queryKey: ["wallet-summary"] });
    qc.invalidateQueries({ queryKey: ["wallet-tx"] });
    qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
  }

  const min = settings.data?.min_withdrawal_cents ?? 0;
  const hasPix = !!profile.data?.pix_key && !!profile.data?.pix_key_type;

  const txList = (txs.data ?? []).filter((t) =>
    txFilter === "all" ? true : txFilter === "in" ? t.amount_cents >= 0 : t.amount_cents < 0,
  );
  const wdList = (withdrawals.data ?? []).filter((w) =>
    wdFilter === "all"
      ? true
      : wdFilter === "other"
        ? w.status !== "pending" && w.status !== "paid"
        : w.status === wdFilter,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold tracking-tight">Carteira</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saldo disponível" value={wallet.data?.available} loading={wallet.isLoading} highlight />
        <Stat label="Saldo pendente" value={wallet.data?.pending} loading={wallet.isLoading} />
        <Stat label="Total recebido" value={wallet.data?.total} loading={wallet.isLoading} />
        <Stat label="Saques em andamento" value={wallet.data?.withdrawing} loading={wallet.isLoading} />
      </div>

      {!profile.isLoading && !hasPix && (
        <div className="surface-card space-y-2 border-l-4 border-l-destructive p-4">
          <p className="text-sm font-bold text-destructive">Cadastre sua chave PIX</p>
          <p className="text-xs text-muted-foreground">
            Você ainda não tem uma chave PIX cadastrada. Sem ela não é possível solicitar saques.
          </p>
          <Button asChild variant="outline" className="h-11 w-full sm:w-auto">
            <Link to="/perfil">Cadastrar chave PIX no perfil</Link>
          </Button>
        </div>
      )}

      <form onSubmit={requestWithdrawal} className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-bold">Solicitar saque via PIX</h2>
        <p className="text-xs text-muted-foreground">
          Valor mínimo: {formatBRL(min)}. O valor solicitado fica reservado até o pagamento.
        </p>
        <div className="space-y-2">
          <Label htmlFor="amount">Valor</Label>
          <Input
            id="amount"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12"
            disabled={!hasPix}
          />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={busy || !hasPix}>
          {busy ? "Enviando..." : hasPix ? "Solicitar saque" : "Cadastre sua chave PIX para sacar"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Meus saques</h2>
        <FilterChips
          value={wdFilter}
          onChange={(v) => { setWdFilter(v); setWdLimit(10); }}
          options={[
            { value: "all", label: "Todos" },
            { value: "pending", label: "Em análise" },
            { value: "paid", label: "Pagos" },
            { value: "other", label: "Recusados / falhas" },
          ]}
        />
        {withdrawals.isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : wdList.length > 0 ? (
          <>
            <ul className="space-y-2">
              {wdList.slice(0, wdLimit).map((w) => (
                <li key={w.id} className="surface-card flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{formatBRL(w.amount_cents)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(w.created_at)} · {w.pix_key}
                    </p>
                    {w.note && <p className="mt-1 text-xs text-muted-foreground">{w.note}</p>}
                  </div>
                  <Badge variant={w.status === "paid" ? "default" : "secondary"}>
                    {WD_LABEL[w.status] ?? w.status}
                  </Badge>
                </li>
              ))}
            </ul>
            <LoadMore
              shown={wdLimit}
              total={wdList.length}
              onMore={() => setWdLimit((n) => n + 10)}
              noun="saques"
            />
          </>
        ) : (
          <p className="surface-card p-4 text-center text-sm text-muted-foreground">
            Nenhum saque solicitado.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Extrato</h2>
        <FilterChips
          value={txFilter}
          onChange={(v) => { setTxFilter(v); setTxLimit(10); }}
          options={[
            { value: "all", label: "Todos" },
            { value: "in", label: "Comissões recebidas" },
            { value: "out", label: "Saques" },
          ]}
        />
        {txs.isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : txList.length > 0 ? (
          <>
            <ul className="surface-card divide-y divide-border">
              {txList.slice(0, txLimit).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{TX_LABEL[t.type] ?? t.type}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.description} · {formatDate(t.created_at)}
                    </p>
                  </div>
                  <span
                    className={
                      t.amount_cents >= 0
                        ? "text-sm font-bold text-primary"
                        : "text-sm font-bold text-destructive"
                    }
                  >
                    {t.amount_cents >= 0 ? "+" : "−"} {formatBRL(Math.abs(t.amount_cents))}
                  </span>
                </li>
              ))}
            </ul>
            <LoadMore
              shown={txLimit}
              total={txList.length}
              onMore={() => setTxLimit((n) => n + 10)}
              noun="lançamentos"
            />
          </>
        ) : (
          <p className="surface-card p-4 text-center text-sm text-muted-foreground">
            Nenhuma movimentação ainda.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={highlight ? "text-xl font-extrabold text-primary" : "text-xl font-bold"}>
        {loading ? "—" : formatBRL(value)}
      </p>
    </div>
  );
}

function traduzir(msg: string): string {
  if (msg.includes("saldo insuficiente")) return "Saldo insuficiente para este saque.";
  if (msg.includes("minimo")) return "Valor abaixo do mínimo permitido.";
  if (msg.includes("chave PIX")) return "Cadastre uma chave PIX no seu perfil antes de sacar.";
  if (msg.includes("conta inativa")) return "Sua conta está bloqueada para saques.";
  return "Não foi possível solicitar o saque.";
}
