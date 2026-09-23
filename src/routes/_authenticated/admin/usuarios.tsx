import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatDate } from "@/lib/money";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Administração IndicaPro" },
      {
        name: "description",
        content: "Veja o nível de acesso de cada pessoa e altere permissões e status das contas.",
      },
      { property: "og:title", content: "Usuários — Administração IndicaPro" },
      { property: "og:description", content: "Gerencie níveis de acesso e status das contas." },
    ],
  }),
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const list = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list.data ?? [];
    return (list.data ?? []).filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q),
    );
  }, [list.data, search]);

  async function changeRole(id: string, role: "admin" | "user") {
    if (busyId) return;
    setBusyId(id);
    const { error } = await supabase.rpc("admin_set_user_role", { _user_id: id, _role: role });
    setBusyId(null);
    if (error) {
      toast.error(
        error.message.includes("proprio nivel")
          ? "Você não pode alterar o seu próprio nível de acesso."
          : "Não foi possível alterar o nível de acesso.",
      );
    } else {
      toast.success(role === "admin" ? "Agora é administrador." : "Agora é usuário comum.");
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function changeStatus(id: string, status: "active" | "blocked") {
    if (busyId) return;
    setBusyId(id);
    const { error } = await supabase.rpc("admin_set_user_status", { _user_id: id, _status: status });
    setBusyId(null);
    if (error) {
      toast.error(
        error.message.includes("propria conta")
          ? "Você não pode bloquear a sua própria conta."
          : "Não foi possível alterar o status da conta.",
      );
    } else {
      toast.success(status === "blocked" ? "Conta bloqueada." : "Conta reativada.");
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  if (list.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (list.isError) {
    return (
      <p className="surface-card p-6 text-center text-sm text-muted-foreground">
        Não foi possível carregar a lista de pessoas.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar por nome, e-mail ou telefone"
        className="h-11"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma pessoa encontrada.
        </p>
      ) : (
        filtered.map((u) => {
          const isSelf = u.id === user?.id;
          const isAdmin = u.role === "admin";
          return (
            <div key={u.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{u.name || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cadastro em {formatDate(u.created_at)} · Saldo {formatBRL(u.balance_cents)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={isAdmin ? "default" : "secondary"}>
                    {isAdmin ? "Administrador" : "Usuário"}
                  </Badge>
                  <Badge variant={u.status === "active" ? "outline" : "destructive"}>
                    {u.status === "active" ? "Ativa" : "Bloqueada"}
                  </Badge>
                </div>
              </div>

              {isSelf ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Esta é a sua conta — o seu próprio nível de acesso não pode ser alterado aqui.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant={isAdmin ? "outline" : "default"}
                    className="h-11 flex-1"
                    disabled={busyId === u.id}
                    onClick={() => changeRole(u.id, isAdmin ? "user" : "admin")}
                  >
                    {isAdmin ? "Tornar usuário comum" : "Tornar administrador"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 flex-1"
                    disabled={busyId === u.id}
                    onClick={() => changeStatus(u.id, u.status === "active" ? "blocked" : "active")}
                  >
                    {u.status === "active" ? "Bloquear conta" : "Reativar conta"}
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
