import { ConfirmAction } from "../types";
import { AlertIcon } from "./Icons";

interface Props {
  action: ConfirmAction;
  domain?: string;
  showSkipOption?: boolean;
  skipChecked: boolean;
  onSkipChange: (v: boolean) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  action,
  domain,
  showSkipOption,
  skipChecked,
  onSkipChange,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/55 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        className="animate-fade-in w-full max-w-md overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl shadow-ink-950/20"
      >
        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertIcon />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink-900">{action.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{action.description}</p>
            </div>
          </div>
        </div>

        {action.details && action.details.length > 0 && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Detail aksi
            </p>
            <ul className="space-y-1.5 rounded-xl bg-ink-50 p-3 text-sm text-ink-700">
              {action.details.map((d) => (
                <li key={d} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ext-500" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showSkipOption && domain && (
          <div className="px-5 pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={skipChecked}
                onChange={(e) => onSkipChange(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-ext-600 focus:ring-ext-500"
              />
              Jangan tampilkan lagi untuk domain ini ({domain})
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/80 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={action.onConfirm}
            className="rounded-lg bg-ext-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-ext-700"
          >
            {action.confirmLabel || "Proceed"}
          </button>
        </div>
      </div>
    </div>
  );
}
