export const SUPPORT_CATEGORIES = [
  { value: "commission", label: "Comissão" },
  { value: "referral", label: "Indicação" },
  { value: "withdrawal", label: "Saque / PIX" },
  { value: "product", label: "Produto" },
  { value: "account", label: "Conta" },
  { value: "technical", label: "Problema técnico" },
  { value: "other", label: "Outros" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  SUPPORT_CATEGORIES.map((c) => [c.value, c.label]),
);

export const SUPPORT_STATUS: Record<string, { label: string; className: string }> = {
  open: { label: "Aberto", className: "bg-secondary text-secondary-foreground" },
  in_progress: { label: "Em atendimento", className: "bg-primary text-primary-foreground" },
  waiting_user: { label: "Aguardando sua resposta", className: "bg-amber-500 text-white" },
  resolved: { label: "Resolvido", className: "bg-primary/15 text-primary" },
  closed: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
};

export const ADMIN_STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  waiting_user: "Aguardando usuário",
  resolved: "Resolvido",
  closed: "Encerrado",
};

export function statusBadge(status: string) {
  return SUPPORT_STATUS[status] ?? SUPPORT_STATUS["open"]!;
}
