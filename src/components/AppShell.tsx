import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Share2,
  Wallet,
  User as UserIcon,
  ShieldCheck,
  LogOut,
  LifeBuoy,
} from "lucide-react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppName } from "@/hooks/useAppName";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Produtos", icon: LayoutGrid },
  { to: "/indicacoes", label: "Indicações", icon: Share2 },
  { to: "/carteira", label: "Carteira", icon: Wallet },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy },
  { to: "/perfil", label: "Perfil", icon: UserIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useRouterState({ select: (s) => s.location });
  const { isAdmin, signOut, user } = useAuth();
  const appName = useAppName();

  const unread = useQuery({
    queryKey: ["support-unread"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_unread_count");
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
  const unreadCount = unread.data ?? 0;

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const navItems = user ? NAV : NAV.filter((i) => i.to === "/");

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <div className="mx-auto flex w-full max-w-6xl">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border p-4 md:flex">
          <div className="mb-8 px-2 text-lg font-bold tracking-tight text-primary">
            {appName}
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item.to)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.to === "/suporte" && unreadCount > 0 && (
                  <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive("/admin")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <ShieldCheck className="size-4" />
                Admin
              </Link>
            )}
          </nav>
          <div className="mt-auto">
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-3"
                onClick={signOut}
              >
                <LogOut className="size-4" />
                Sair
              </Button>
            ) : (
              <Button asChild size="sm" className="w-full font-semibold">
                <Link to="/auth">Entrar</Link>
              </Button>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 md:pb-10">
          <header className="flex items-center justify-between px-4 py-4 md:hidden">
            <span className="text-base font-bold text-primary">{appName}</span>
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
              >
                <ShieldCheck className="size-3.5" /> Admin
              </Link>
            )}
            {!user && (
              <Link
                to="/auth"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Entrar
              </Link>
            )}
          </header>
          <div className="px-4 md:px-8 md:py-8">{children}</div>
          <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-6 text-[11px] text-muted-foreground">
            <Link to="/termos" className="hover:underline">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="hover:underline">
              Política de Privacidade
            </Link>
          </footer>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                isActive(item.to) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon className="size-5" />
                {item.to === "/suporte" && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 size-2.5 rounded-full bg-primary" />
                )}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
