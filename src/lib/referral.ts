// Guarda o código de indicação (?ref=) no navegador do visitante,
// para não se perder quando ele precisa entrar/criar conta antes de comprar.
const PREFIX = "indicapro:ref:";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export function saveRef(slug: string, ref: string) {
  if (typeof window === "undefined" || !ref) return;
  try {
    localStorage.setItem(PREFIX + slug, JSON.stringify({ ref, at: Date.now() }));
  } catch {
    /* navegador sem localStorage */
  }
}

export function getRef(slug: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(PREFIX + slug);
    if (!raw) return undefined;
    const { ref, at } = JSON.parse(raw) as { ref?: string; at?: number };
    if (!ref || !at || Date.now() - at > VALIDADE_MS) {
      localStorage.removeItem(PREFIX + slug);
      return undefined;
    }
    return ref;
  } catch {
    return undefined;
  }
}

// Só aceita caminhos internos, nunca outro site.
export function safeRedirect(path: unknown): string {
  if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) return path;
  return "/";
}
