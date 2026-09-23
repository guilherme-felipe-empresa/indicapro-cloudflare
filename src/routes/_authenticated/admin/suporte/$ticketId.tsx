import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { traduzErro } from "@/lib/authErrors";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SupportThread, type SupportMessage } from "@/components/SupportThread";
import { formatBRL, formatDate } from "@/lib/money";
import { ADMIN_STATUS_LABEL, CATEGORY_LABEL, statusBadge } from "@/lib/support";

export const Route = createFileRoute("/_authenticated/admin/suporte/$ticketId")({
  head: () => ({
    meta: [
      { title: "Atendimento — Administração IndicaPro" },
      { name: "description", content: "Responda e gerencie um chamado de suporte." },
      { property: "og:title", content: "Atendimento — Administração IndicaPro" },
      { property: "og:description", content: "Responda e gerencie um chamado de suporte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminTicket,
});

const STATUSES = ["open", "in_progress", "waiting_user", "resolved", "closed"] as const;

function AdminTicket() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  const ticket = useQuery({
    queryKey: ["admin-ticket", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const profile = useQuery({
    queryKey: ["admin-ticket-profile", ticket.data?.user_id],
    enabled: !!ticket.data?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, status")
        .eq("id", ticket.data!.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const related = useQuery({
    queryKey: ["admin-ticket-related", ticket.data?.id],
    enabled: !!ticket.data,
    queryFn: async () => {
      const uid = ticket.data!.user_id;
      const cat = ticket.data!.category;
      if (cat === "withdrawal") {
        const { data } = await supabase
          .from("withdrawals")
          .select("id, amount_cents, status, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(5);
        return { kind: "withdrawals" as const, rows: data ?? [] };
      }
      if (cat === "commission" || cat === "referral") {
        const { data } = await supabase
          .from("purchase_intents")
          .select("id, code, product_name, commission_cents, status, created_at")
          .eq("referrer_id", uid)
          .order("created_at", { ascending: false })
          .limit(5);
        return { kind: "intents" as const, rows: data ?? [] };
      }
      return null;
    },
  });

  const messages = useQuery({
    queryKey: ["admin-ticket-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select(
          "id, sender_type, message, is_internal, attachment_path, attachment_name, created_at",
        )
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupportMessage[];
    },
  });

  useEffect(() => {
    if (!messages.data?.length) return;
    void supabase.rpc("mark_support_read", { _ticket_id: ticketId }).then(() => {
      void qc.invalidateQueries({ queryKey: ["support-unread"] });
      void qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    });
  }, [messages.data?.length, ticketId, qc]);

  const reply = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Escreva uma mensagem.");
      const { error } = await supabase.rpc("post_support_message", {
        _ticket_id: ticketId,
        _message: text,
        _is_internal: internal,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["admin-ticket-messages", ticketId] });
      void qc.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
      void qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: Error) => {
      toast.error(traduzErro(e, "Não foi possível enviar a resposta."));
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.rpc("admin_set_ticket_status", {
        _ticket_id: ticketId,
        _status: status as (typeof STATUSES)[number],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      void qc.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
      void qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: Error) => {
      toast.error(traduzErro(e, "Não foi possível alterar o status."));
    },
  });

  const removeTicket = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_delete_ticket", { _ticket_id: ticketId });
      if (error) throw error;
      const paths = (data ?? []) as string[];
      if (paths.length > 0) {
        await supabase.storage.from("support-attachments").remove(paths);
      }
    },
    onSuccess: () => {
      setConfirmDelete(false);
      toast.success("Chamado excluído.");
      void qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      void qc.invalidateQueries({ queryKey: ["support-unread"] });
      void navigate({ to: "/admin/suporte" });
    },
    onError: (e: Error) => {
      setConfirmDelete(false);
      toast.error(
        e.message?.includes("finalizado")
          ? "Só é possível excluir chamados resolvidos ou encerrados."
          : "Não foi possível excluir o chamado.",
      );
    },
  });

  if (ticket.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!ticket.data)
    return (
      <p className="surface-card p-6 text-center text-sm text-muted-foreground">
        Chamado não encontrado.
      </p>
    );

  const t = ticket.data;
  const badge = statusBadge(t.status);

  return (
    <div className="space-y-4">
      <Link
        to="/admin/suporte"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Todos os chamados
      </Link>

      <div className="surface-card space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">{t.subject}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.protocol} · {CATEGORY_LABEL[t.category] ?? t.category} ·{" "}
              {formatDate(t.created_at)}
            </p>
          </div>
          <Badge className={badge.className}>{ADMIN_STATUS_LABEL[t.status] ?? badge.label}</Badge>
        </div>
        {profile.data && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs">
            <p className="font-semibold">{profile.data.name || "Sem nome"}</p>
            <p className="text-muted-foreground">{profile.data.email}</p>
            {profile.data.phone && <p className="text-muted-foreground">{profile.data.phone}</p>}
            <p className="text-muted-foreground">
              Conta: {profile.data.status === "active" ? "ativa" : "bloqueada"}
            </p>
          </div>
        )}
        {related.data && related.data.rows.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold">
              {related.data.kind === "withdrawals"
                ? "Saques recentes deste usuário"
                : "Indicações recentes deste usuário"}
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {related.data.kind === "withdrawals"
                ? related.data.rows.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span>{formatDate(r.created_at)}</span>
                      <span>
                        {formatBRL(r.amount_cents)} · {r.status}
                      </span>
                    </li>
                  ))
                : related.data.rows.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {r.code} · {r.product_name}
                      </span>
                      <span>
                        {formatBRL(r.commission_cents)} · {r.status}
                      </span>
                    </li>
                  ))}
            </ul>
            <Link
              to={related.data.kind === "withdrawals" ? "/admin/saques" : "/admin/indicacoes"}
              className="mt-2 inline-block text-xs font-medium text-primary"
            >
              {related.data.kind === "withdrawals" ? "Abrir saques" : "Abrir indicações"}
            </Link>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">Status</Label>
          <Select
            value={t.status}
            onValueChange={(v) => setStatus.mutate(v)}
            disabled={setStatus.isPending}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ADMIN_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(t.status === "resolved" || t.status === "closed") && (
            <Button
              variant="destructive"
              size="sm"
              className="h-9 gap-2"
              disabled={removeTicket.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
              Excluir chamado
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este chamado?</AlertDialogTitle>
            <AlertDialogDescription>
              Todo o histórico de mensagens e os anexos do chamado {t.protocol} serão apagados de
              vez. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeTicket.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeTicket.isPending}
              onClick={(e) => {
                e.preventDefault();
                removeTicket.mutate();
              }}
            >
              {removeTicket.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {messages.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <SupportThread messages={messages.data ?? []} viewer="admin" />
      )}

      <div className="surface-card space-y-3 p-4">
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={internal ? "Observação interna (o usuário não verá)" : "Responder ao usuário..."}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Switch id="internal" checked={internal} onCheckedChange={setInternal} />
            <Label htmlFor="internal" className="text-xs">
              Observação interna
            </Label>
          </div>
          <Button
            className="gap-2"
            disabled={reply.isPending || !text.trim()}
            onClick={() => reply.mutate()}
          >
            <Send className="size-4" />
            {reply.isPending ? "Enviando..." : internal ? "Salvar nota" : "Responder"}
          </Button>
        </div>
      </div>
    </div>
  );
}
