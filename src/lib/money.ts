export function formatBRL(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseBRLToCents(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export type CommissionType = "fixed" | "percentage";

/** Mirrors the database commission_cents() function. Percentage is stored in basis points. */
export function commissionCents(
  priceCents: number,
  type: CommissionType,
  value: number,
): number {
  return type === "fixed" ? value : Math.floor((priceCents * value) / 10000);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
