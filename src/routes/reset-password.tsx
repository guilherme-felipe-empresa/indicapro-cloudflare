import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
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
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<EmailOtpType>("recovery");
  const [verified, setVerified] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = params.get("token_hash");
    const type = params.get("type") as EmailOtpType | null;

    if (hash) {
      setTokenHash(hash);
      if (type) setTokenType(type);
      setCheckingSession(false);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setVerified(true);
        setCheckingSession(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setVerified(true);
      setCheckingSession(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function verifyRecovery() {
    if (!tokenHash || busy) return;

    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType,
    });
    setBusy(false);

    if (error) {
      toast.error(traduzErro(error, "Este link de recuperação é inválido ou expirou."));
      return;
    }

    window.history.replaceState({}, document.title, "/reset-password");
    setTokenHash(null);
    setVerified(true);
    toast.success("Link confirmado. Agora escolha sua nova senha.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      toast.error(traduzErro(error, "Não foi possível atualizar sua senha."));
      return;
    }

    toast.success("Senha atualizada!");
    navigate({ to: "/", replace: true });
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface-card w-full max-w-md p-6 text-center">
          <p className="text-sm text-muted-foreground">Validando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (tokenHash && !verified) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface-card w-full max-w-md space-y-4 p-6">
          <h1 className="text-xl font-bold">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground">
            Clique no botão abaixo para confirmar que foi você quem solicitou a recuperação.
          </p>
          <Button type="button" className="h-12 w-full" disabled={busy} onClick={verifyRecovery}>
            {busy ? "Confirmando..." : "Continuar recuperação"}
          </Button>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface-card w-full max-w-md space-y-4 p-6">
          <h1 className="text-xl font-bold">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">
            Solicite um novo link de recuperação na tela de login.
          </p>
          <Button type="button" className="h-12 w-full" onClick={() => navigate({ to: "/auth" })}>
            Voltar para entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="surface-card w-full max-w-md space-y-4 p-6">
        <h1 className="text-xl font-bold">Definir nova senha</h1>
        <div className="space-y-2">
          <Label htmlFor="np">Nova senha</Label>
          <PasswordInput
            id="np"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={busy}>
          {busy ? "Salvando..." : "Salvar senha"}
        </Button>
      </form>
    </div>
  );
}
