import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { traduzErro } from "@/lib/authErrors";
import { useAuth } from "@/hooks/useAuth";
import { useAppName } from "@/hooks/useAppName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — IndicaPro" },
      { name: "description", content: "Acesse sua conta IndicaPro para indicar produtos e receber comissões." },
      { property: "og:title", content: "Entrar — IndicaPro" },
      { property: "og:description", content: "Acesse sua conta para indicar produtos e receber comissões." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const appName = useAppName();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "recover">("signin");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setBusy(false);
    if (error) { toast.error(traduzErro(error, "Não foi possível entrar. Verifique seu e-mail e senha.")); return; }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (form.password.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: form.name.trim(), phone: form.phone.trim() },
      },
    });
    setBusy(false);
    if (error) { toast.error(traduzErro(error, "Não foi possível criar sua conta.")); return; }
    if (!data.session) {
      toast.success("Conta criada! Confirme seu e-mail para entrar.");
      setMode("signin");
      return;
    }
    navigate({ to: "/", replace: true });
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { toast.error(traduzErro(error, "Não foi possível enviar o link de recuperação.")); return; }
    toast.success("Enviamos um link de recuperação para seu e-mail.");
    setMode("signin");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">{appName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Indique produtos e receba comissões via PIX.
          </p>
        </div>

        <div className="surface-card p-5 shadow-sm">
          {mode === "recover" ? (
            <form onSubmit={handleRecover} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rec-email">E-mail</Label>
                <Input id="rec-email" type="email" required value={form.email} onChange={set("email")} />
              </div>
              <Button type="submit" className="h-12 w-full" disabled={busy}>
                {busy ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("signin")}>
                Voltar
              </Button>
            </form>
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={form.email} onChange={set("email")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <PasswordInput id="password" required value={form.password} onChange={set("password")} />
                  </div>
                  <Button type="submit" className="h-12 w-full" disabled={busy}>
                    {busy ? "Entrando..." : "Entrar"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center text-sm text-muted-foreground underline"
                    onClick={() => setMode("recover")}
                  >
                    Esqueci minha senha
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input id="name" required value={form.name} onChange={set("name")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" type="email" required value={form.email} onChange={set("email")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" inputMode="tel" value={form.phone} onChange={set("phone")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Senha</Label>
                    <PasswordInput id="su-password" required value={form.password} onChange={set("password")} />
                  </div>
                  <Button type="submit" className="h-12 w-full" disabled={busy}>
                    {busy ? "Criando..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ao criar uma conta você concorda com os{" "}
          <Link to="/termos" className="underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link to="/privacidade" className="underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
