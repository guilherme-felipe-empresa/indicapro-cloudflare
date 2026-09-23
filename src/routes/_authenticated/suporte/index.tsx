import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { traduzErro } from "@/lib/authErrors";
import { Plus, MessageCircle, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/money";
import {
  CATEGORY_LABEL,
  SUPPORT_CATEGORIES,
  statusBadge,
  type SupportCategory,
} from "@/lib/support";

export const Route = createFileRoute("/_authenticated/suporte/")({
  head: () => ({
    meta: [
      { title: "Central de Suporte — IndicaPro" },
      {
        name: "description",
        content: "Abra chamados e acompanhe o atendimento da equipe IndicaPro.",
      },
      { property: "og:title", content: "Central de Suporte — IndicaPro" },
      {
        property: "og:description",
        content: "Abra chamados e acompanhe o atendimento da equipe IndicaPro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportList,
});

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "open", label: "Abertos" },
  { key: "in_progress", label: "Em atendimento" },
  { key: "resolved", label: "Resolvidos" },
] as const;

function SupportList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const list = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_my_support_tickets");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!subject.trim() || !message.trim()) throw new Error("Preencha assunto e mensagem.");
      let path: string | null = null;
      let name: string | null = null;
      if (file && user) {
        const key = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("support-attachments").upload(key, file);
        if (up.error) throw up.error;
        path = key;
        name = file.name;
      }
      const { data, error } = await supabase.rpc("create_support_ticket", {
        _category: category,
        _subject: subject,
        _message: message,
        ...(path ? { _attachment_path: path } : {}),
        ...(name ? { _attachment_name: name } : {}),
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (row) => {
      toast.success(`Chamado criado: ${row?.protocol ?? ""}`);
      setOpen(false);
      setSubject("");
      setMessage("");
      setFile(null);
      setCategory("other");
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
      void qc.invalidateQueries({ queryKey: ["support-unread"] });
    },
    onError: (e: Error) => {
      toast.error(traduzErro(e, "Não foi possível criar o chamado."));
    },
  });

  const tickets = (list.data ?? []).filter((t) =>
    filter === "all" ? true : t.status === filter,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Central de Suporte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Está com alguma dúvida ou pendência? Envie uma mensagem para nossa equipe e acompanhe o
          atendimento por aqui.
        </p>
      </div>

      <Button className="w-full gap-2 md:w-auto" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nova solicitação
      </Button>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
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
      ) : list.error ? (
        <p className="text-sm text-destructive">Não foi possível carregar seus chamados.</p>
      ) : tickets.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <MessageCircle className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum chamado por aqui. Crie uma nova solicitação para falar com a equipe.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => {
            const badge = statusBadge(t.status);
            return (
              <li key={t.id}>
                <Link
                  to="/suporte/$ticketId"
                  params={{ ticketId: t.id }}
                  className="surface-card block p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.protocol} · {CATEGORY_LABEL[t.category] ?? t.category}
                      </p>
                    </div>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Atualizado em {formatDate(t.updated_at)}
                    </span>
                    {t.unread_count > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        Nova resposta
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as SupportCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-subject">Assunto</Label>
              <Input
                id="sup-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Resumo do que você precisa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-message">Mensagem</Label>
              <Textarea
                id="sup-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Conte os detalhes para a equipe te ajudar"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-file" className="flex items-center gap-1.5">
                <Paperclip className="size-3.5" /> Anexo (opcional)
              </Label>
              <Input
                id="sup-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
