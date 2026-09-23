import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/money";
import { ADMIN_STATUS_LABEL, CATEGORY_LABEL, statusBadge } from "@/lib/support";

export const Route = createFileRoute("/_authenticated/admin/suporte/")({
  head: () => ({
    meta: [
      { title: "Suporte — Administração IndicaPro" },
      { name: "description", content: "Atenda os chamados de suporte dos indicadores." },
      { property: "og:title", content: "Suporte — Administração IndicaPro" },
      { property: "og:description", content: "Atenda os chamados de suporte dos indicadores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSupport,
});

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "open", label: "Abertos" },
  { key: "in_progress", label: "Em atendimento" },
  { key: "waiting_user", label: "Aguardando usuário" },
  { key: "resolved", label: "Resolvidos" },
  { key: "closed", label: "Encerrados" },
] as const;

function AdminSupport() {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const list = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_support_tickets");
      if (error) throw error;
      return data ?? [];
    },
  });

  const term = search.trim().toLowerCase();
  const rows = (list.data ?? []).filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (!term) return true;
    return [t.user_name, t.user_email, t.protocol, t.subject]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term));
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nome, e-mail, protocolo ou assunto"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">
          Nenhum chamado encontrado.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((t) => {
            const badge = statusBadge(t.status);
            return (
              <li key={t.id}>
                <Link
                  to="/admin/suporte/$ticketId"
                  params={{ ticketId: t.id }}
                  className="surface-card block p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.subject}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {t.protocol} · {CATEGORY_LABEL[t.category] ?? t.category} ·{" "}
                        {t.user_name || t.user_email}
                      </p>
                    </div>
                    <Badge className={badge.className}>
                      {ADMIN_STATUS_LABEL[t.status] ?? badge.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Aberto {formatDate(t.created_at)} · Atualizado {formatDate(t.updated_at)}
                    </span>
                    {t.unread_count > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        {t.unread_count} não lida{t.unread_count > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
