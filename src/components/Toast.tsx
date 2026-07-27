import { cn } from "../utils/cn";

export type ToastKind = "info" | "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

const styles: Record<ToastKind, string> = {
  info: "border-ext-200 bg-ext-50 text-ext-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
};

export function ToastStack({ items }: { items: ToastItem[] }) {
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "animate-fade-in pointer-events-auto rounded-xl border px-3.5 py-2.5 text-sm shadow-lg shadow-ink-950/10",
            styles[t.kind]
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
