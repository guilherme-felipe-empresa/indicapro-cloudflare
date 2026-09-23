import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { traduzErro } from "@/lib/authErrors";
import { ArrowLeft, Paperclip, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SupportThread, type SupportMessage } from "@/components/SupportThread";
import { formatDate } from "@/lib/money";
import { CATEGORY_LABEL, statusBadge } from "@/lib/support";

export const Route = createFileRoute("/_authenticated/suporte/$ticketId")({
  head: () => ({
    meta: [
      { title: "Chamado — Suporte IndicaPro" },
      { name: "description", content: "Acompanhe a conversa do seu chamado de suporte." },
      { property: "og:title", content: "Chamado — Suporte IndicaPro" },
      { property: "og:description", content: "Acompanhe a conversa do seu chamado de suporte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const ticket = useQuery({
    queryKey: ["ticket", ticketId],
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

  const messages = useQuery({
    queryKey: ["ticket-messages", ticketId],
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
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
    });
  }, [messages.data?.length, ticketId, qc]);

  const send = useMutation({
    mutationFn: async () => {
      if (!text.trim() && !file) throw new Error("Escreva uma mensagem ou anexe um arquivo.");
      let path: string | null = null;
      let name: string | null = null;
      if (file && user) {
        const key = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("support-attachments").upload(key, file);
        if (up.error) throw up.error;
        path = key;
        name = file.name;
      }
      const { error } = await supabase.rpc("post_support_message", {
        _ticket_id: ticketId,
        _message: text,
        _is_internal: false,
        ...(path ? { _attachment_path: path } : {}),
        ...(name ? { _attachment_name: name } : {}),
      });
      if (error) throw error;
    },

    onSuccess: () => {
      setText("");
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: Error) => {
      toast.error(traduzErro(e, "Não foi possível enviar a mensagem."));
    },
  });

  if (ticket.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!ticket.data)
    return (
      <div className="surface-card p-8 text-center">
        <h1 className="text-lg font-bold">Chamado não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este chamado não existe ou não pertence à sua conta.
        </p>
        <Link to="/suporte" className="mt-4 inline-block text-sm font-medium text-primary">
          Voltar para o suporte
        </Link>
      </div>
    );

  const t = ticket.data;
  const badge = statusBadge(t.status);
  const closed = t.status === "closed";

  return (
    <div className="space-y-4">
      <Link
        to="/suporte"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Meus chamados
      </Link>

      <div className="surface-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">{t.subject}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.protocol} · {CATEGORY_LABEL[t.category] ?? t.category}
            </p>
          </div>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Aberto em {formatDate(t.created_at)}</p>
      </div>

      {messages.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <SupportThread messages={messages.data ?? []} viewer="user" />
      )}

      {closed ? (
        <p className="surface-card p-4 text-center text-sm text-muted-foreground">
          Este chamado foi encerrado. Crie uma nova solicitação se precisar de ajuda.
        </p>
      ) : (
        <div className="surface-card space-y-3 p-4">
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva sua mensagem..."
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="size-3.5" />
              <Input
                type="file"
                className="h-9"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              className="gap-2"
              disabled={send.isPending || (!text.trim() && !file)}
              onClick={() => send.mutate()}

            >
              <Send className="size-4" />
              {send.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
