import { Button } from "@/components/ui/button";

export type FilterOption<T extends string> = { value: T; label: string; count?: number };

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              active
                ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {o.label}
            {typeof o.count === "number" && ` (${o.count})`}
          </button>
        );
      })}
    </div>
  );
}

export function LoadMore({
  shown,
  total,
  onMore,
  noun = "registros",
  step = 10,
}: {
  shown: number;
  total: number;
  onMore: () => void;
  noun?: string;
  step?: number;
}) {
  if (total === 0) return null;
  return (
    <div className="space-y-2 pt-1">
      <p className="text-center text-xs text-muted-foreground">
        Mostrando {Math.min(shown, total)} de {total} {noun}
      </p>
      {shown < total && (
        <Button variant="outline" className="h-11 w-full" onClick={onMore}>
          Carregar mais (+{Math.min(step, total - shown)})
        </Button>
      )}
    </div>
  );
}
