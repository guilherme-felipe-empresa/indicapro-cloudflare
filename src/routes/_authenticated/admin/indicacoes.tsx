import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Paperclip, FileCheck2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL, formatDate } from "@/lib/money";
import { FilterChips, LoadMore } from "@/components/ListControls";

export const Route = createFileRoute("/_authenticated/admin/indicacoes")({
  head: () => ({
    meta: [
      { title: "Indicações — Administração IndicaPro" },
      { name: "description", content: "Aprove ou reprove indicações e libere comissões." },
      { property: "og:title", content: "Indicações — Administração IndicaPro" },
      { property: "og:description", content: "Aprove ou reprove indicações e libere comissões." },
    ],
  }),
  component: AdminIntents,
});

const LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  failed: "Não aprovada",
};

type Intent = {
  id: string;
  code: string;
  product_name: string;
  referrer_id: string | null;
  price_cents: number;
  commission_cents: number;
  status: string;
  created_at: string;
  proof_path: string | null;
  proof_name: string | null;
  proof_ref: string | null;
};

function AdminIntents() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "failed" | "direct" | "all">("pending");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const [approving, setApproving] = useState<Intent | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofRef, setProofRef] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const intents = useQuery({
    queryKey: ["admin-intents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_intents")
        .select(
          "id, code, product_name, referrer_id, price_cents, commission_cents, status, created_at, proof_path, proof_name, proof_ref",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Intent[];
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

  const nameOf = (id: string | null) => {
    if (!id) return "Compra direta (sem indicação)";
    const p = profiles.data?.find((x) => x.id === id);
    return p ? p.name || p.email : "—";
  };

  async function reject(id: string) {
    if (busyId) return;
    setBusyId(id);
    const { error } = await supabase.rpc("set_intent_status", { _id: id, _status: "failed" });
    setBusyId(null);
    if (error) {
      toast.error(
        error.message.includes("ja processada")
          ? "Esta indicação já foi processada."
          : "Não foi possível atualizar a indicação.",
      );
    } else {
      toast.success("Indicação marcada como não aprovada.");
    }
    qc.invalidateQueries({ queryKey: ["admin-intents"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  function startApprove(i: Intent) {
    setApproving(i);
    setProofFile(null);
    setProofRef("");
  }

  async function confirmApprove() {
    if (!approving || saving) return;
    if (!proofFile && !proofRef.trim()) {
      toast.error("Anexe um comprovante ou informe o código da transação.");
      return;
    }
    setSaving(true);

    let path: string | null = null;
    let name: string | null = null;
    if (proofFile) {
      if (proofFile.size > 10 * 1024 * 1024) {
        setSaving(false);
        toast.error("O comprovante deve ter no máximo 10 MB.");
        return;
      }
      const ext = (proofFile.name.split(".").pop() || "dat").toLowerCase().replace(/[^a-z0-9]/g, "");
      path = `${approving.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from("intent-proofs")
        .upload(path, proofFile, { contentType: proofFile.type || "application/octet-stream" });
      if (up.error) {
        setSaving(false);
        toast.error("Não foi possível enviar o comprovante.");
        return;
      }
      name = proofFile.name;
    }

    const { error } = await supabase.rpc("set_intent_status", {
      _id: approving.id,
      _status: "approved",
      ...(path ? { _proof_path: path, _proof_name: name ?? "" } : {}),
      ...(proofRef.trim() ? { _proof_ref: proofRef.trim() } : {}),
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("comprovante")
          ? "Informe um comprovante para confirmar."
          : error.message.includes("ja processada")
            ? "Esta venda já foi processada."
            : error.message.includes("conta de recebimento")
              ? "Escolha em Ajustes a conta que recebe as vendas diretas."
              : "Não foi possível confirmar.",
      );
      return;
    }
    toast.success("Comissão liberada!");
    setApproving(null);
    qc.invalidateQueries({ queryKey: ["admin-intents"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  async function openProof(i: Intent) {
    if (!i.proof_path) return;
    const { data, error } = await supabase.storage
      .from("intent-proofs")
      .createSignedUrl(i.proof_path, 300);
    if (error || !data) {
      toast.error("Não foi possível abrir o comprovante.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  if (intents.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const all = intents.data ?? [];
  const q = search.trim().toLowerCase();
  const base =
    tab === "all"
      ? all
      : tab === "direct"
        ? all.filter((i) => !i.referrer_id)
        : all.filter((i) => i.status === tab);
  const list = q
    ? base.filter((i) =>
        [i.code, i.product_name, nameOf(i.referrer_id), i.proof_ref ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : base;

  return (
    <div className="space-y-3">
      <FilterChips
        value={tab}
        onChange={(v) => { setTab(v); setLimit(10); }}
        options={[
          { value: "pending", label: "Aguardando aprovação", count: all.filter((i) => i.status === "pending").length },
          { value: "approved", label: "Aprovadas" },
          { value: "failed", label: "Não aprovadas" },
          { value: "direct", label: "Vendas diretas" },
          { value: "all", label: "Todas", count: all.length },
        ]}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setLimit(10); }}
          placeholder="Buscar por código, produto ou indicador"
          className="h-11 pl-9 pr-9"
          aria-label="Buscar indicação"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {q && (
        <p className="text-xs text-muted-foreground">
          {list.length} resultado{list.length === 1 ? "" : "s"} para "{search.trim()}"
        </p>
      )}

      {list.length > 0 ? (
        <>
          {list.slice(0, limit).map((i) => (
          <div key={i.id} className="surface-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{i.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {i.code} · {formatDate(i.created_at)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Indicador: {nameOf(i.referrer_id)}</p>
              </div>
              <Badge variant={i.status === "approved" ? "default" : "secondary"}>
                {LABEL[i.status] ?? i.status}
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Venda {formatBRL(i.price_cents)}</span>
              <span className="font-bold text-primary">Comissão {formatBRL(i.commission_cents)}</span>
            </div>

            {(i.proof_path || i.proof_ref) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <FileCheck2 className="size-4 text-primary" />
                {i.proof_ref && <span>Código: {i.proof_ref}</span>}
                {i.proof_path && (
                  <button
                    type="button"
                    className="font-semibold text-primary underline"
                    onClick={() => openProof(i)}
                  >
                    Ver comprovante{i.proof_name ? ` (${i.proof_name})` : ""}
                  </button>
                )}
              </div>
            )}

            {i.status === "pending" && (
              <div className="mt-3 flex gap-2">
                <Button className="h-11 flex-1" disabled={busyId === i.id} onClick={() => startApprove(i)}>
                  Aprovar
                </Button>
                <Button
                  variant="outline"
                  className="h-11 flex-1"
                  disabled={busyId === i.id}
                  onClick={() => reject(i.id)}
                >
                  Reprovar
                </Button>
              </div>
            )}
          </div>
          ))}
          <LoadMore
            shown={limit}
            total={list.length}
            onMore={() => setLimit((n) => n + 10)}
            noun="indicações"
          />
        </>
      ) : (
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">
          {all.length > 0
            ? "Nenhuma indicação encontrada com esses filtros."
            : "Nenhuma indicação registrada ainda."}
        </p>
      )}

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approving?.referrer_id ? "Liberar comissão" : "Confirmar venda direta"}
            </DialogTitle>
            <DialogDescription>
              {approving?.referrer_id
                ? "Anexe o comprovante da venda ou informe o código da transação para confirmar."
                : `Anexe o comprovante ou informe o código da transação. O valor de ${formatBRL(approving?.price_cents ?? 0)} entra na carteira da conta configurada.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comprovante (foto, print ou PDF)</Label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="size-4" />
                {proofFile ? proofFile.name : "Escolher arquivo"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proof-ref">Código / ID da transação</Label>
              <Input
                id="proof-ref"
                value={proofRef}
                onChange={(e) => setProofRef(e.target.value)}
                placeholder="Ex.: E12345678202609211530"
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-11" onClick={() => setApproving(null)}>
              Cancelar
            </Button>
            <Button
              className="h-11"
              onClick={confirmApprove}
              disabled={saving || (!proofFile && !proofRef.trim())}
            >
              {saving
                ? "Confirmando..."
                : approving?.referrer_id
                  ? "Liberar comissão"
                  : "Confirmar venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
