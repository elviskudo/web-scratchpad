import { FieldStatus } from "../types";
import { cn } from "../utils/cn";

const styles: Record<FieldStatus, string> = {
  unknown: "bg-ink-100 text-ink-600 ring-ink-200",
  valid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  invalid: "bg-rose-50 text-rose-700 ring-rose-200",
  missing: "bg-amber-50 text-amber-800 ring-amber-200",
};

const labels: Record<FieldStatus, string> = {
  unknown: "Unknown",
  valid: "Valid",
  invalid: "Invalid",
  missing: "Missing",
};

export function StatusBadge({ status }: { status: FieldStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}
