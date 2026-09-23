import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel do administrador — IndicaPro" },
      { name: "description", content: "Acompanhe usuários, produtos, indicações, comissões e saques." },
      { property: "og:title", content: "Painel do administrador — IndicaPro" },
      { property: "og:description", content: "Acompanhe usuários, indicações, comissões e saques." },
    ],
  }),
  component: AdminDashboard,
});

type Stats = {
  total_users: number;
  active_products: number;
  pending_intents: number;
  approved_commissions_cents: number;
  pending_withdrawals: number;
  total_commissions_cents: number;
  total_paid_cents: number;
};

function AdminDashboard() {
  const q = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  if (q.isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (q.error || !q.data)
    return <p className="text-sm text-destructive">Não foi possível carregar os dados.</p>;

  const s = q.data;
  const cards = [
    { label: "Usuários", value: String(s.total_users) },
    { label: "Produtos ativos", value: String(s.active_products) },
    { label: "Indicações pendentes", value: String(s.pending_intents) },
    { label: "Saques pendentes", value: String(s.pending_withdrawals) },
    { label: "Comissões liberadas", value: formatBRL(s.approved_commissions_cents) },
    { label: "Total em comissões", value: formatBRL(s.total_commissions_cents) },
    { label: "Total pago", value: formatBRL(s.total_paid_cents) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-xl font-extrabold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
