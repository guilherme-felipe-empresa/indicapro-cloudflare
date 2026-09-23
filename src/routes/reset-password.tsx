import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { traduzErro } from "@/lib/authErrors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova senha — IndicaPro" },
      { name: "description", content: "Defina uma nova senha para sua conta IndicaPro." },
      { property: "og:title", content: "Nova senha — IndicaPro" },
      { property: "og:description", content: "Defina uma nova senha para sua conta." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(traduzErro(error, "Não foi possível atualizar sua senha.")); return; }
    toast.success("Senha atualizada!");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="surface-card w-full max-w-md space-y-4 p-6">
        <h1 className="text-xl font-bold">Definir nova senha</h1>
        <div className="space-y-2">
          <Label htmlFor="np">Nova senha</Label>
          <PasswordInput id="np" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={busy}>
          {busy ? "Salvando..." : "Salvar senha"}
        </Button>
      </form>
    </div>
  );
}
