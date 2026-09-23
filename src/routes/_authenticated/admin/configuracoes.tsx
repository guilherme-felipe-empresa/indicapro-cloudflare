import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { parseBRLToCents } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Administração IndicaPro" },
      { name: "description", content: "Ajuste WhatsApp, saque mínimo, prazo de atribuição e suporte." },
      { property: "og:title", content: "Configurações — Administração IndicaPro" },
      { property: "og:description", content: "Ajuste WhatsApp, saque mínimo e regras de indicação." },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    app_name: "",
    whatsapp_number: "",
    min_withdrawal: "",
    attribution_days: "30",
    allow_self_referral: false,
    support_email: "",
    support_phone: "",
    direct_sales_admin_id: "",
  });

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const admins = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []).filter((u) => u.role === "admin");
    },
  });

  useEffect(() => {
    const s = settings.data;
    if (s) {
      setForm({
        app_name: s.app_name,
        whatsapp_number: s.whatsapp_number,
        min_withdrawal: (s.min_withdrawal_cents / 100).toFixed(2).replace(".", ","),
        attribution_days: String(s.attribution_days),
        allow_self_referral: s.allow_self_referral,
        support_email: s.support_email ?? "",
        support_phone: s.support_phone ?? "",
        direct_sales_admin_id: s.direct_sales_admin_id ?? "",
      });
    }
  }, [settings.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        app_name: form.app_name.trim(),
        whatsapp_number: form.whatsapp_number.replace(/\D/g, ""),
        min_withdrawal_cents: parseBRLToCents(form.min_withdrawal),
        attribution_days: Math.max(1, Number(form.attribution_days) || 30),
        allow_self_referral: form.allow_self_referral,
        support_email: form.support_email.trim(),
        support_phone: form.support_phone.trim(),
        direct_sales_admin_id: form.direct_sales_admin_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setBusy(false);
    if (error) { toast.error("Não foi possível salvar as configurações."); return; }
    toast.success("Configurações salvas!");
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["app-name"] });
  }

  if (settings.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <form onSubmit={save} className="surface-card max-w-xl space-y-4 p-4">
      <Field label="Nome da aplicação" value={form.app_name} onChange={(v) => setForm({ ...form, app_name: v })} />
      <Field
        label="Número do WhatsApp (com DDI)"
        value={form.whatsapp_number}
        onChange={(v) => setForm({ ...form, whatsapp_number: v })}
      />
      <Field
        label="Valor mínimo de saque (R$)"
        value={form.min_withdrawal}
        onChange={(v) => setForm({ ...form, min_withdrawal: v })}
      />
      <Field
        label="Prazo de atribuição da indicação (dias)"
        value={form.attribution_days}
        onChange={(v) => setForm({ ...form, attribution_days: v })}
      />
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="self">Permitir autoindicação</Label>
        <Switch
          id="self"
          checked={form.allow_self_referral}
          onCheckedChange={(v) => setForm({ ...form, allow_self_referral: v })}
        />
      </div>
      <Field label="E-mail de suporte" value={form.support_email} onChange={(v) => setForm({ ...form, support_email: v })} />
      <Field label="Telefone de suporte" value={form.support_phone} onChange={(v) => setForm({ ...form, support_phone: v })} />

      <div className="space-y-2">
        <Label htmlFor="direct-sales">Conta que recebe as vendas diretas</Label>
        <select
          id="direct-sales"
          value={form.direct_sales_admin_id}
          onChange={(e) => setForm({ ...form, direct_sales_admin_id: e.target.value })}
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Selecione uma conta</option>
          {(admins.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name || a.email}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Ao aprovar uma compra sem indicação, o valor total da venda entra nesta carteira.
        </p>
      </div>
      <Button type="submit" className="h-12 w-full" disabled={busy}>
        {busy ? "Salvando..." : "Salvar configurações"}
      </Button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input className="h-12" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
