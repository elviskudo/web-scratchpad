import {
  AiAnalysis,
  AiModel,
  AppSettings,
  FieldStatus,
  PanelTab,
  ScanResult,
  ValidationResult,
} from "../types";
import { cn } from "../utils/cn";
import { StatusBadge } from "./StatusBadge";
import {
  AlertIcon,
  CheckIcon,
  ClipboardIcon,
  ExternalIcon,
  FillIcon,
  LinkIcon,
  LoaderIcon,
  LockIcon,
  PlayIcon,
  RefreshIcon,
  ScanIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
} from "./Icons";

interface Props {
  tab: PanelTab;
  onTabChange: (t: PanelTab) => void;
  settings: AppSettings;
  draftSettings: AppSettings;
  onDraftChange: (s: AppSettings) => void;
  onSaveSettings: () => void;
  targetUrlInput: string;
  onTargetUrlChange: (v: string) => void;
  targetOpen: boolean;
  urlError: string | null;
  onOpenTarget: () => void;
  scan: ScanResult | null;
  analysis: AiAnalysis | null;
  validation: ValidationResult | null;
  loading: string | null;
  settingsError: string | null;
  onScan: () => void;
  onAnalyze: () => void;
  onValidate: () => void;
  onSimulatePreview: () => void;
  simulationPreview: Array<{ uid: string; label: string; nameOrId: string; value: string | boolean }> | null;
  onApplySimulation: () => void;
  onCancelSimulation: () => void;
  onFieldClick: (uid?: string, nameOrId?: string) => void;
  aiReady: boolean;
  models: AiModel[];
  modelsLoading: boolean;
  modelsError: string | null;
  onFetchModels: () => void;
}

export function ExtensionPanel(props: Props) {
  const {
    tab,
    onTabChange,
    settings,
    draftSettings,
    onDraftChange,
    onSaveSettings,
    targetUrlInput,
    onTargetUrlChange,
    targetOpen,
    urlError,
    onOpenTarget,
    scan,
    analysis,
    validation,
    loading,
    settingsError,
    onScan,
    onAnalyze,
    onValidate,
    onSimulatePreview,
    simulationPreview,
    onApplySimulation,
    onCancelSimulation,
    onFieldClick,
    aiReady,
    models,
    modelsLoading,
    modelsError,
    onFetchModels,
  } = props;

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "controls", label: "Controls", icon: <PlayIcon className="h-3.5 w-3.5" /> },
    { id: "scratchpad", label: "Scratchpad", icon: <ClipboardIcon className="h-3.5 w-3.5" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <aside className="flex h-full w-full flex-col border-l border-ink-800 bg-ink-950 text-ink-100 shadow-2xl">
      <header className="shrink-0 border-b border-ink-800 bg-gradient-to-br from-ink-900 to-ink-950 px-4 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ext-400 to-ext-700 text-white shadow-lg shadow-ext-900/40">
            <ShieldIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight text-white">
              Web Screening Scratchpad
            </h1>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-400">
              Scan · AI analysis · validate — never auto-submit
            </p>
          </div>
        </div>

        <nav className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-ink-900 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition",
                tab === t.id
                  ? "bg-ink-700 text-white shadow"
                  : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "controls" && (
          <ControlsTab
            targetUrlInput={targetUrlInput}
            onTargetUrlChange={onTargetUrlChange}
            targetOpen={targetOpen}
            urlError={urlError}
            onOpenTarget={onOpenTarget}
            scan={scan}
            analysis={analysis}
            validation={validation}
            loading={loading}
            aiReady={aiReady}
            aiEnabled={settings.ai.enabled}
            aiModel={settings.ai.model}
            simulateEnabled={settings.simulateFillEnabled}
            onScan={onScan}
            onAnalyze={onAnalyze}
            onValidate={onValidate}
            onSimulatePreview={onSimulatePreview}
            simulationPreview={simulationPreview}
            onApplySimulation={onApplySimulation}
            onCancelSimulation={onCancelSimulation}
          />
        )}
        {tab === "scratchpad" && (
          <ScratchpadTab
            scan={scan}
            analysis={analysis}
            validation={validation}
            onFieldClick={onFieldClick}
            onValidate={onValidate}
            loading={loading}
            aiModel={settings.ai.model}
          />
        )}
        {tab === "settings" && (
          <SettingsTab
            draft={draftSettings}
            onChange={onDraftChange}
            onSave={onSaveSettings}
            error={settingsError}
            models={models}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            onFetchModels={onFetchModels}
          />
        )}
      </div>

      <footer className="shrink-0 border-t border-ink-800 bg-ink-900/80 px-4 py-3">
        <div className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-400">
          <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <p>
            Extension ini <span className="font-semibold text-ink-200">tidak akan pernah mengirim form</span>.
            Submit selalu dilakukan manual oleh Anda.
          </p>
        </div>
      </footer>
    </aside>
  );
}

function ControlsTab(props: {
  targetUrlInput: string;
  onTargetUrlChange: (v: string) => void;
  targetOpen: boolean;
  urlError: string | null;
  onOpenTarget: () => void;
  scan: ScanResult | null;
  analysis: AiAnalysis | null;
  validation: ValidationResult | null;
  loading: string | null;
  aiReady: boolean;
  aiEnabled: boolean;
  aiModel: string;
  simulateEnabled: boolean;
  onScan: () => void;
  onAnalyze: () => void;
  onValidate: () => void;
  onSimulatePreview: () => void;
  simulationPreview: Array<{ uid: string; label: string; nameOrId: string; value: string | boolean }> | null;
  onApplySimulation: () => void;
  onCancelSimulation: () => void;
}) {
  const isValidUrl = validateUrl(props.targetUrlInput);
  const busy = Boolean(props.loading);

  return (
    <div className="animate-fade-in space-y-5">
      {props.aiEnabled && props.aiModel && (
        <div className="flex items-center gap-2 rounded-xl border border-violet-800/40 bg-violet-950/30 px-3 py-2 text-[11px] text-violet-200">
          <SparklesIcon className="h-3.5 w-3.5 shrink-0" />
          <span>
            Model: <span className="font-mono font-semibold text-violet-100">{props.aiModel}</span>
          </span>
        </div>
      )}

      <section className="space-y-3">
        <SectionLabel icon={<LinkIcon className="h-3.5 w-3.5" />} title="Target URL" />
        <div className="space-y-2">
          <input
            value={props.targetUrlInput}
            onChange={(e) => props.onTargetUrlChange(e.target.value)}
            placeholder="https://... or sandbox://coretax-spt-masa"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 font-mono text-xs text-ink-100 outline-none placeholder:text-ink-500 focus:border-ext-500 focus:ring-2 focus:ring-ext-500/20"
          />
          {props.urlError && <p className="text-xs text-rose-400">{props.urlError}</p>}
          {!isValidUrl && props.targetUrlInput.trim() && (
            <p className="text-xs text-rose-400">URL tidak valid. Gunakan http://, https://, atau sandbox://</p>
          )}
          <button
            type="button"
            disabled={!isValidUrl}
            onClick={props.onOpenTarget}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ext-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-ext-500 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400"
          >
            <ExternalIcon className="h-4 w-4" />
            Open Target
          </button>
          {props.targetOpen && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckIcon className="h-3.5 w-3.5" /> Target tab aktif (sandbox / panel kanan)
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel icon={<ScanIcon className="h-3.5 w-3.5" />} title="Screening Actions" />
        <div className="grid gap-2">
          <ActionButton
            icon={props.loading === "scan" ? <LoaderIcon /> : <ScanIcon />}
            label="Scan Page"
            hint="Baca DOM, form, dan field di tab target"
            onClick={props.onScan}
            disabled={!props.targetOpen || busy}
          />
          <ActionButton
            icon={props.loading === "analyze" ? <LoaderIcon /> : <SparklesIcon />}
            label="Analyze with AI"
            hint={
              !props.aiEnabled
                ? "AI dimatikan — aktifkan di Settings"
                : !props.aiReady
                  ? "AI URL + Model wajib — Fetch Models di Settings"
                  : `Kirim struktur ke AI · ${props.aiModel || "no model"}`
            }
            onClick={props.onAnalyze}
            disabled={!props.targetOpen || !props.scan || busy || !props.aiEnabled || !props.aiReady}
            variant="ai"
          />
          {props.simulateEnabled && (
            <ActionButton
              icon={props.loading === "simulate" ? <LoaderIcon /> : <FillIcon />}
              label="Simulate Fill"
              hint="Isi field dengan data dummy — tanpa submit"
              onClick={props.onSimulatePreview}
              disabled={!props.targetOpen || !props.scan || busy}
              variant="soft"
            />
          )}
          <ActionButton
            icon={props.loading === "validate" ? <LoaderIcon /> : <RefreshIcon />}
            label="Run Validation"
            hint="Validasi field berdasarkan nilai terkini"
            onClick={props.onValidate}
            disabled={!props.targetOpen || !props.scan || busy || !props.aiEnabled}
          />
        </div>
      </section>

      {props.simulationPreview && (
        <section className="animate-fade-in rounded-2xl border border-emerald-800/50 bg-emerald-950/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Preview Simulate Fill
          </h3>
          <p className="mt-1 text-[11px] text-emerald-200/70">
            Review mapping berikut, lalu Apply. Tidak ada submit form.
          </p>
          <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto text-xs">
            {props.simulationPreview.map((row) => (
              <li
                key={row.uid}
                className="flex items-start justify-between gap-2 rounded-lg bg-ink-950/50 px-2.5 py-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink-100">{row.label}</span>
                  <span className="font-mono text-[10px] text-ink-500">{row.nameOrId}</span>
                </span>
                <span className="shrink-0 font-mono text-emerald-300">
                  {String(row.value)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={props.onCancelSimulation}
              className="flex-1 rounded-lg border border-ink-700 px-2 py-2 text-xs font-medium text-ink-300 hover:bg-ink-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={props.onApplySimulation}
              className="flex-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Apply Simulation
            </button>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <SectionLabel icon={<ClipboardIcon className="h-3.5 w-3.5" />} title="Scan Snapshot" />
        {!props.scan ? (
          <EmptyCard text="Belum ada hasil scan. Buka target lalu klik Scan Page." />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Forms" value={String(props.scan.forms.length)} />
            <StatCard label="Fields" value={String(props.scan.fields.length)} />
            <StatCard
              label="Title"
              value={props.scan.pageInfo.title}
              className="col-span-2"
              mono={false}
            />
            <StatCard
              label="URL"
              value={props.scan.pageInfo.url}
              className="col-span-2"
            />
          </div>
        )}
      </section>

      {props.validation && (
        <div
          className={cn(
            "rounded-2xl border px-3 py-3 text-sm",
            props.validation.overall === "pass"
              ? "border-emerald-700/50 bg-emerald-950/50 text-emerald-200"
              : "border-rose-700/50 bg-rose-950/40 text-rose-100"
          )}
        >
          <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
            Hasil Validasi
          </div>
          <p className="mt-1 font-medium">{props.validation.summary}</p>
        </div>
      )}
    </div>
  );
}

function ScratchpadTab(props: {
  scan: ScanResult | null;
  analysis: AiAnalysis | null;
  validation: ValidationResult | null;
  onFieldClick: (uid?: string, nameOrId?: string) => void;
  onValidate: () => void;
  loading: string | null;
  aiModel: string;
}) {
  if (!props.analysis) {
    return (
      <div className="animate-fade-in space-y-3">
        <EmptyCard text="Scratchpad kosong. Jalankan Scan Page lalu Analyze with AI untuk mengisi summary dan field penting." />
        {props.scan && (
          <p className="text-center text-[11px] text-ink-500">
            Scan siap · {props.scan.forms.length} form · {props.scan.fields.length} fields
          </p>
        )}
      </div>
    );
  }

  const fields = mergeFieldStatuses(props.analysis, props.validation);

  return (
    <div className="animate-fade-in space-y-5">
      {props.aiModel && (
        <div className="text-[11px] text-ink-400">
          Dianalisis dengan model{" "}
          <span className="font-mono text-ext-300">{props.aiModel}</span>
        </div>
      )}
      <section className="space-y-2">
        <SectionLabel icon={<SparklesIcon className="h-3.5 w-3.5" />} title="Page Summary" />
        <div className="rounded-2xl border border-ink-700 bg-ink-900/80 p-3 text-sm leading-relaxed text-ink-200">
          {props.analysis.page_summary}
        </div>
      </section>

      <section className="space-y-2">
        <SectionLabel icon={<CheckIcon className="h-3.5 w-3.5" />} title="Detected Purpose" />
        <div className="rounded-2xl border border-ext-800/60 bg-ext-950/40 px-3 py-2.5 text-sm text-ext-100">
          {props.analysis.detected_purpose}
        </div>
      </section>

      {props.analysis.warnings && props.analysis.warnings.length > 0 && (
        <section className="space-y-2">
          <SectionLabel icon={<AlertIcon className="h-3.5 w-3.5" />} title="Warnings" />
          <ul className="space-y-2">
            {props.analysis.warnings.map((w) => (
              <li
                key={w}
                className="rounded-xl border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-100"
              >
                <span className="font-semibold text-amber-300">Warning: </span>
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.validation && (
        <div
          className={cn(
            "rounded-2xl border px-3 py-2.5 text-sm font-medium",
            props.validation.overall === "pass"
              ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-200"
              : "border-rose-700/40 bg-rose-950/30 text-rose-100"
          )}
        >
          {props.validation.overall === "pass" ? "Validasi LULUS" : props.validation.summary}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel icon={<ClipboardIcon className="h-3.5 w-3.5" />} title="Important Fields" />
          <button
            type="button"
            onClick={props.onValidate}
            disabled={Boolean(props.loading) || !props.scan}
            className="rounded-lg border border-ink-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-300 hover:bg-ink-800 disabled:opacity-40"
          >
            {props.loading === "validate" ? "Validating…" : "Re-scan with Values"}
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-ink-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-900 text-[10px] uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-2.5 py-2 font-semibold">Field</th>
                <th className="px-2.5 py-2 font-semibold">Type</th>
                <th className="px-2.5 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {fields.map((f) => (
                <tr
                  key={`${f.nameOrId}-${f.label}`}
                  className="cursor-pointer bg-ink-950/40 transition hover:bg-ink-900"
                  onClick={() => props.onFieldClick(f.uid, f.nameOrId)}
                  title={f.reason}
                >
                  <td className="px-2.5 py-2.5 align-top">
                    <div className="font-medium text-ink-100">{f.label}</div>
                    <div className="font-mono text-[10px] text-ink-500">{f.nameOrId}</div>
                    <div className="mt-1 text-[11px] leading-snug text-ink-400">{f.reason}</div>
                    {f.message && (
                      <div className="mt-1 text-[11px] text-amber-300/90">{f.message}</div>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5 align-top font-mono text-[10px] text-ink-400">
                    {f.type || "—"}
                  </td>
                  <td className="px-2.5 py-2.5 align-top">
                    <StatusBadge status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-ink-500">Klik baris field untuk highlight di halaman target.</p>
      </section>

      {props.analysis.validation_rules && props.analysis.validation_rules.length > 0 && (
        <section className="space-y-2">
          <SectionLabel icon={<ShieldIcon className="h-3.5 w-3.5" />} title="Validation Rules" />
          <ul className="space-y-1.5">
            {props.analysis.validation_rules.map((r) => (
              <li key={`${r.field}-${r.rule}`} className="rounded-xl bg-ink-900/70 px-3 py-2 text-xs">
                <div className="font-mono text-[10px] text-ext-300">
                  {r.field} · {r.rule}
                </div>
                <div className="mt-0.5 text-ink-300">{r.description}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SettingsTab(props: {
  draft: AppSettings;
  onChange: (s: AppSettings) => void;
  onSave: () => void;
  error: string | null;
  models: AiModel[];
  modelsLoading: boolean;
  modelsError: string | null;
  onFetchModels: () => void;
}) {
  const { draft, onChange } = props;
  const selectedMeta = props.models.find((m) => m.id === draft.ai.model);

  return (
    <div className="animate-fade-in space-y-5">
      <section className="space-y-3">
        <SectionLabel icon={<SparklesIcon className="h-3.5 w-3.5" />} title="AI Settings" />
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5">
          <span className="text-sm text-ink-200">Enable AI Analysis</span>
          <input
            type="checkbox"
            checked={draft.ai.enabled}
            onChange={(e) =>
              onChange({ ...draft, ai: { ...draft.ai, enabled: e.target.checked } })
            }
            className="h-4 w-4 rounded border-ink-500 text-ext-500 focus:ring-ext-500"
          />
        </label>

        <Field
          label="AI API URL"
          required={draft.ai.enabled}
          value={draft.ai.apiUrl}
          onChange={(v) => onChange({ ...draft, ai: { ...draft.ai, apiUrl: v } })}
          placeholder="https://api.example.com/v1 atau demo://local"
          mono
        />
        <Field
          label="API Key"
          value={draft.ai.apiKey}
          onChange={(v) => onChange({ ...draft, ai: { ...draft.ai, apiKey: v } })}
          placeholder="Bearer token / API key"
          mono
          type="password"
        />
        <Field
          label="API Secret"
          value={draft.ai.apiSecret}
          onChange={(v) => onChange({ ...draft, ai: { ...draft.ai, apiSecret: v } })}
          placeholder="Optional secret"
          mono
          type="password"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-300">
              AI Model{draft.ai.enabled && <span className="text-rose-400"> *</span>}
            </span>
            <button
              type="button"
              onClick={props.onFetchModels}
              disabled={props.modelsLoading || !draft.ai.apiUrl.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11px] font-semibold text-ink-100 transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {props.modelsLoading ? (
                <LoaderIcon className="h-3.5 w-3.5" />
              ) : (
                <RefreshIcon className="h-3.5 w-3.5" />
              )}
              {props.modelsLoading ? "Fetching…" : "Fetch Models"}
            </button>
          </div>

          {props.models.length > 0 ? (
            <select
              value={draft.ai.model}
              onChange={(e) =>
                onChange({ ...draft, ai: { ...draft.ai, model: e.target.value } })
              }
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 font-mono text-xs text-ink-100 outline-none focus:border-ext-500 focus:ring-2 focus:ring-ext-500/20"
            >
              {!props.models.some((m) => m.id === draft.ai.model) && draft.ai.model && (
                <option value={draft.ai.model}>{draft.ai.model} (saved)</option>
              )}
              {props.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.ownedBy ? ` · ${m.ownedBy}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={draft.ai.model}
              onChange={(e) =>
                onChange({ ...draft, ai: { ...draft.ai, model: e.target.value } })
              }
              placeholder="Klik Fetch Models atau ketik model id manual"
              className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-xs text-ink-100 outline-none placeholder:text-ink-500 focus:border-ext-500 focus:ring-2 focus:ring-ext-500/20"
            />
          )}

          {selectedMeta?.description && (
            <p className="rounded-lg bg-ink-900/80 px-2.5 py-2 text-[11px] leading-relaxed text-ink-400">
              {selectedMeta.description}
            </p>
          )}

          {props.modelsError && (
            <p className="text-xs text-rose-400">{props.modelsError}</p>
          )}

          {props.models.length > 0 && (
            <p className="text-[11px] text-ink-500">
              {props.models.length} model diambil dari API · auth via API Key / Secret
            </p>
          )}
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2 text-[11px] leading-relaxed text-ink-400">
          <strong className="text-ink-300">Fetch Models</strong> memanggil endpoint models di AI API
          URL (mis. <code className="text-ink-300">/v1/models</code>) dengan header{" "}
          <code className="text-ink-300">Authorization: Bearer &lt;key&gt;</code>,{" "}
          <code className="text-ink-300">X-API-Key</code>, <code className="text-ink-300">X-API-Secret</code>.
          Model terpilih dikirim di body request analyze/validate sebagai{" "}
          <code className="text-ink-300">model</code>. Gunakan{" "}
          <code className="text-ext-300">demo://local</code> untuk daftar model bawaan.
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel icon={<FillIcon className="h-3.5 w-3.5" />} title="Safety & Simulation" />
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5">
          <div>
            <div className="text-sm text-ink-200">Enable Simulate Fill</div>
            <div className="text-[11px] text-ink-500">Hanya mengisi field, tidak pernah submit</div>
          </div>
          <input
            type="checkbox"
            checked={draft.simulateFillEnabled}
            onChange={(e) => onChange({ ...draft, simulateFillEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-ink-500 text-ext-500 focus:ring-ext-500"
          />
        </label>
      </section>

      {props.error && (
        <div className="rounded-xl border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
          {props.error}
        </div>
      )}

      <button
        type="button"
        onClick={props.onSave}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-ink-100"
      >
        <CheckIcon className="h-4 w-4" />
        Save Settings
      </button>
    </div>
  );
}

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
      {icon}
      {title}
    </div>
  );
}

function ActionButton(props: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "ai" | "soft";
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
        props.variant === "ai"
          ? "border-violet-700/50 bg-violet-950/40 hover:bg-violet-900/40"
          : props.variant === "soft"
            ? "border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-950/40"
            : "border-ink-700 bg-ink-900 hover:bg-ink-800"
      )}
    >
      <span className="mt-0.5 text-ink-200">{props.icon}</span>
      <span>
        <span className="block text-sm font-semibold text-ink-50">{props.label}</span>
        <span className="mt-0.5 block text-[11px] text-ink-400">{props.hint}</span>
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  className,
  mono = true,
}: {
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-2", className)}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={cn("mt-0.5 truncate text-sm text-ink-100", mono && "font-mono text-xs")}>
        {value}
      </div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-3 py-6 text-center text-xs leading-relaxed text-ink-400">
      {text}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-300">
        {props.label}
        {props.required && <span className="text-rose-400"> *</span>}
      </span>
      <input
        type={props.type || "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={cn(
          "w-full rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-ext-500 focus:ring-2 focus:ring-ext-500/20",
          props.mono && "font-mono text-xs"
        )}
      />
    </label>
  );
}

function validateUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("sandbox://")) return v.length > "sandbox://".length;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function mergeFieldStatuses(
  analysis: AiAnalysis,
  validation: ValidationResult | null
): Array<{
  uid?: string;
  label: string;
  nameOrId: string;
  type?: string;
  reason: string;
  status: FieldStatus;
  message?: string;
}> {
  return analysis.important_fields.map((f) => {
    const match = validation?.fields.find((vf) => {
      const a = (vf.nameOrId || "").toLowerCase();
      const b = (f.nameOrId || "").toLowerCase();
      const c = (f.label || "").toLowerCase();
      return a === b || a === c || b.includes(a) || a.includes(b);
    });
    return {
      ...f,
      status: match?.status || f.status || "unknown",
      message: match?.message || f.message,
    };
  });
}
