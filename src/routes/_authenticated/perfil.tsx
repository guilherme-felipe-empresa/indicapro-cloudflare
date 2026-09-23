import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — IndicaPro" },
      { name: "description", content: "Atualize seus dados de contato e sua chave PIX para receber comissões." },
      { property: "og:title", content: "Perfil — IndicaPro" },
      { property: "og:description", content: "Atualize seus dados e sua chave PIX." },
    ],
  }),
  component: Perfil,
});

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Aleatória" },
] as const;

function Perfil() {
  const { user, isAdmin, signOut } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", pix_key: "", pix_key_type: "" });

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        name: profile.data.name ?? "",
        phone: profile.data.phone ?? "",
        pix_key: profile.data.pix_key ?? "",
        pix_key_type: profile.data.pix_key_type ?? "",
      });
    }
  }, [profile.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !user) return;
    if (form.pix_key.trim() && !form.pix_key_type) {
      toast.error("Selecione o tipo da chave PIX.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        pix_key: form.pix_key.trim() || null,
        pix_key_type: (form.pix_key_type || null) as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) { toast.error("Não foi possível salvar seus dados."); return; }
    toast.success("Dados atualizados!");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  if (profile.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold tracking-tight">Perfil</h1>

      <form onSubmit={save} className="surface-card space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            className="h-12"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input className="h-12" value={profile.data?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            inputMode="tel"
            className="h-12"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pix">Chave PIX</Label>
          <Input
            id="pix"
            className="h-12"
            value={form.pix_key}
            onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo da chave</Label>
          <Select
            value={form.pix_key_type}
            onValueChange={(v) => setForm({ ...form, pix_key_type: v })}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {PIX_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="h-12 w-full" disabled={busy}>
          {busy ? "Salvando..." : "Salvar alterações"}
        </Button>
      </form>

      <div className="surface-card space-y-1 p-4 text-xs text-muted-foreground">
        <p>Conta: {profile.data?.status === "active" ? "Ativa" : "Bloqueada"}</p>
        <p>Perfil: {isAdmin ? "Administrador" : "Usuário"}</p>
        <p>
          Cadastro em{" "}
          {profile.data?.created_at
            ? new Date(profile.data.created_at).toLocaleDateString("pt-BR")
            : "—"}
        </p>
      </div>

      <Button variant="outline" className="h-12 w-full" onClick={signOut}>
        <LogOut className="size-4" /> Sair da conta
      </Button>
    </div>
  );
}
