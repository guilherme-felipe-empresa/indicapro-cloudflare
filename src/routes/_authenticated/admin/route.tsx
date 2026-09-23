import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Painel" },
  { to: "/admin/produtos", label: "Produtos" },
  { to: "/admin/indicacoes", label: "Indicações" },
  { to: "/admin/saques", label: "Saques" },
  { to: "/admin/usuarios", label: "Usuários" },
  { to: "/admin/suporte", label: "Suporte" },
  { to: "/admin/configuracoes", label: "Ajustes" },
] as const;

function AdminLayout() {
  const { pathname } = useRouterState({ select: (s) => s.location });
  const check = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) throw error;
      return !!data;
    },
  });

  if (check.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!check.data) {
    return (
      <div className="surface-card p-8 text-center">
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é exclusiva para administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold tracking-tight">Administração</h1>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              (t.to === "/admin" ? pathname === "/admin" : pathname.startsWith(t.to))
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
