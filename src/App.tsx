import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ExtensionPanel } from "./components/ExtensionPanel";
import { SandboxHandle, SandboxPage } from "./components/SandboxPage";
import { ToastItem, ToastStack } from "./components/Toast";
import {
  analyzePage,
  AiConfigError,
  buildSimulationPreview,
  fetchAiModels,
  isLocalDemoUrl,
  LOCAL_DEMO_MODELS,
  validatePage,
} from "./services/ai";
import {
  applySimulation,
  clearHighlights,
  highlightField,
  readFieldValues,
  scanDocument,
} from "./services/scanner";
import { hydrateSettingsFromStorage, loadSettings, saveSettings } from "./services/storage";
import {
  isExtension,
  getActiveTab,
  scanViaContent,
  readValuesViaContent,
  applySimulationViaContent,
  highlightViaContent,
  clearHighlightsViaContent,
} from "./extension";
import {
  AiAnalysis,
  AiModel,
  AppSettings,
  ConfirmAction,
  PanelTab,
  SANDBOX_TITLE,
  SANDBOX_URL,
  ScanResult,
  ValidationResult,
} from "./types";

function isValidTargetUrl(value: string): boolean {
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

function domainFromUrl(url: string): string {
  if (url.startsWith("sandbox://")) return url;
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

let toastCounter = 0;

export default function App() {
  const ext = useMemo(() => isExtension(), []);
  const sandboxRef = useRef<SandboxHandle>(null);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [draftSettings, setDraftSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("controls");
  const [targetUrlInput, setTargetUrlInput] = useState(settings.targetUrl);
  const [targetOpen, setTargetOpen] = useState(true);
  const [activeTargetUrl, setActiveTargetUrl] = useState(settings.targetUrl || SANDBOX_URL);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [externalFrameUrl, setExternalFrameUrl] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [skipChecked, setSkipChecked] = useState(false);
  const [simulationPreview, setSimulationPreview] = useState<Array<{
    uid: string;
    label: string;
    nameOrId: string;
    value: string | boolean;
  }> | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [models, setModels] = useState<AiModel[]>(() => {
    const s = loadSettings();
    return s.ai.apiUrl.includes("demo") || s.ai.apiUrl.includes("local")
      ? LOCAL_DEMO_MODELS
      : [];
  });
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  // Extension: active tab info
  const [activeTab, setActiveTab] = useState<{ tabId: number; url?: string; title?: string } | null>(null);

  const pushToast = useCallback((message: string, kind: ToastItem["kind"] = "info") => {
    const id = `t-${++toastCounter}`;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  // Extension: hydrate settings from chrome.storage and detect active tab
  useEffect(() => {
    if (ext) {
      hydrateSettingsFromStorage().then(() => {
        const s = loadSettings();
        setSettings(s);
        setDraftSettings(s);
        setTargetUrlInput(s.targetUrl);
      });
      getActiveTab().then((t) => {
        if (t) {
          setActiveTab(t);
          if (t.url) {
            setActiveTargetUrl(t.url);
            setTargetUrlInput(t.url);
            setTargetOpen(true);
          }
        }
      });
    }
  }, [ext]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ext) {
      // Web dev mode: restore last target
      setTargetUrlInput(settings.targetUrl);
      setActiveTargetUrl(settings.targetUrl || SANDBOX_URL);
      if ((settings.targetUrl || "").startsWith("sandbox://") || !settings.targetUrl) {
        setExternalFrameUrl(null);
        setTargetOpen(true);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aiReady = useMemo(() => {
    if (!settings.ai.enabled) return false;
    if (!settings.ai.apiUrl.trim()) return false;
    if (!settings.ai.model.trim()) return false;
    return true;
  }, [settings.ai.enabled, settings.ai.apiUrl, settings.ai.model]);

  const handleFetchModels = useCallback(async () => {
    const cfg = draftSettings.ai;
    if (!cfg.apiUrl.trim()) {
      setModelsError("Isi AI API URL terlebih dahulu.");
      pushToast("AI API URL wajib diisi untuk fetch models", "error");
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const list = await fetchAiModels(cfg);
      setModels(list);
      if (list.length === 0) {
        setModelsError("API tidak mengembalikan model.");
        pushToast("Tidak ada model dari API", "warning");
        return;
      }
      const current = draftSettings.ai.model;
      const exists = list.some((m) => m.id === current);
      if (!current || !exists) {
        setDraftSettings((prev) => ({
          ...prev,
          ai: { ...prev.ai, model: list[0].id },
        }));
      }
      pushToast(`${list.length} model berhasil di-fetch`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal fetch models";
      setModelsError(msg);
      pushToast(msg, "error");
    } finally {
      setModelsLoading(false);
    }
  }, [draftSettings.ai, pushToast]);

  useEffect(() => {
    const s = loadSettings();
    if (s.ai.apiUrl.includes("demo") || s.ai.apiUrl.includes("local")) {
      setModels(LOCAL_DEMO_MODELS);
    }
  }, []);

  const isSandboxTarget = useMemo(() => {
    const u = activeTargetUrl || "";
    return u.startsWith("sandbox://") || u.includes("coretax") && !u.startsWith("http");
  }, [activeTargetUrl]);

  const getTargetDocument = useCallback((): Document | null => {
    if (ext) return null; // extension mode uses content script messaging
    if (externalFrameUrl) return null;
    const container = sandboxRef.current?.getContainer();
    return container?.ownerDocument ?? document;
  }, [ext, externalFrameUrl]);

  const getScanRoot = useCallback((): ParentNode | null => {
    if (ext) return null;
    if (externalFrameUrl) return null;
    return sandboxRef.current?.getContainer() ?? null;
  }, [ext, externalFrameUrl]);

  const requestConfirm = useCallback(
    (
      action: Omit<ConfirmAction, "onConfirm"> & { onConfirm: () => void },
      domain: string
    ) => {
      if (settings.skipConfirmDomains.includes(domain)) {
        action.onConfirm();
        return;
      }
      setSkipChecked(false);
      setConfirm({
        ...action,
        onConfirm: () => {
          if (skipCheckedRef.current) {
            setSettings((prev) => {
              const next = {
                ...prev,
                skipConfirmDomains: Array.from(
                  new Set([...prev.skipConfirmDomains, domain])
                ),
              };
              saveSettings(next);
              setDraftSettings(next);
              return next;
            });
          }
          setConfirm(null);
          action.onConfirm();
        },
      });
    },
    [settings.skipConfirmDomains]
  );

  const skipCheckedRef = useRef(false);
  useEffect(() => {
    skipCheckedRef.current = skipChecked;
  }, [skipChecked]);

  const handleOpenTarget = () => {
    if (ext) {
      // Extension mode: the target IS the active browser tab
      getActiveTab().then((t) => {
        if (t) {
          setActiveTab(t);
          const url = t.url || "";
          setActiveTargetUrl(url);
          setTargetUrlInput(url);
          setTargetOpen(true);
          setScan(null);
          setAnalysis(null);
          setValidation(null);
          setSimulationPreview(null);
          pushToast(`Target: ${t.title || url}`, "success");
        } else {
          pushToast("Tidak ada tab aktif", "error");
        }
      });
      return;
    }

    const url = targetUrlInput.trim();
    if (!isValidTargetUrl(url)) {
      setUrlError("URL tidak valid. Gunakan http://, https://, atau sandbox://");
      pushToast("URL tidak valid", "error");
      return;
    }
    setUrlError(null);

    const nextSettings = { ...settings, targetUrl: url };
    setSettings(nextSettings);
    setDraftSettings(nextSettings);
    saveSettings(nextSettings);
    setActiveTargetUrl(url);
    setScan(null);
    setAnalysis(null);
    setValidation(null);
    setSimulationPreview(null);

    if (url.startsWith("sandbox://")) {
      setExternalFrameUrl(null);
      setTargetOpen(true);
      pushToast("Tab sandbox dibuka di panel target", "success");
      return;
    }

    setExternalFrameUrl(url);
    setTargetOpen(true);
    pushToast("Target URL dibuka (iframe). Scan DOM dibatasi CORS pada situs eksternal.", "warning");
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* ignore */
    }
  };

  const runScan = async () => {
    if (ext && activeTab?.tabId) {
      setLoading("scan");
      try {
        const resp = await scanViaContent(activeTab.tabId, activeTab.url, activeTab.title);
        setScan(resp.data);
        setValidation(null);
        pushToast(
          `Scan selesai: ${resp.data.forms.length} form, ${resp.data.fields.length} fields`,
          "success"
        );
      } catch (e) {
        pushToast(e instanceof Error ? e.message : "Gagal scan halaman", "error");
      } finally {
        setLoading(null);
      }
      return;
    }

    // Web dev mode (iframe/sandbox)
    if (!targetOpen) {
      pushToast("Buka Target URL terlebih dahulu", "error");
      return;
    }
    if (externalFrameUrl) {
      pushToast(
        "Extension tidak punya akses ke tab ini (CORS / cross-origin). Gunakan sandbox://coretax-spt-masa untuk demo penuh.",
        "error"
      );
      return;
    }
    const root = getScanRoot();
    const doc = getTargetDocument();
    if (!root || !doc) {
      pushToast("Extension tidak punya akses ke tab ini", "error");
      return;
    }

    setLoading("scan");
    try {
      const title =
        root.querySelector("h1")?.textContent?.trim() ||
        SANDBOX_TITLE;
      const result = scanDocument(doc, activeTargetUrl || SANDBOX_URL, title);
      const scopedFields = result.fields.filter((f) => {
        const el = doc.querySelector(`[data-wsvs-uid="${f.uid}"]`);
        return el && root.contains(el);
      });
      const scopedForms = result.forms.filter((form) => {
        const formEl = root.querySelectorAll("form")[form.index];
        return Boolean(formEl);
      });
      const forms = Array.from(root.querySelectorAll("form")).map((form, index) => ({
        index,
        id: form.id || "",
        name: form.getAttribute("name") || "",
        action: form.getAttribute("action") || "",
        method: (form.getAttribute("method") || "get").toUpperCase(),
        fieldCount: form.querySelectorAll("input, select, textarea").length,
      }));

      const scoped: ScanResult = {
        ...result,
        pageInfo: {
          ...result.pageInfo,
          title,
          url: activeTargetUrl || SANDBOX_URL,
          headings: Array.from(root.querySelectorAll("h1, h2, h3"))
            .map((h) => h.textContent?.trim() || "")
            .filter(Boolean),
          descriptions: Array.from(root.querySelectorAll("p, .form-hint, [data-description]"))
            .map((p) => p.textContent?.trim().replace(/\s+/g, " ") || "")
            .filter((t) => t.length > 20 && t.length < 280)
            .slice(0, 8),
        },
        forms: forms.length ? forms : scopedForms,
        fields: scopedFields.length
          ? scopedFields
          : rescanInContainer(root as HTMLElement, activeTargetUrl || SANDBOX_URL, title),
        scannedAt: new Date().toISOString(),
      };

      if (scoped.fields.length === 0) {
        scoped.fields = rescanInContainer(
          root as HTMLElement,
          activeTargetUrl || SANDBOX_URL,
          title
        );
      }

      setScan(scoped);
      setValidation(null);
      pushToast(
        `Scan selesai: ${scoped.forms.length} form, ${scoped.fields.length} fields`,
        "success"
      );
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Gagal scan halaman", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleScan = () => {
    requestConfirm(
      {
        title: "Konfirmasi Scan Page",
        description:
          "Extension akan membaca struktur DOM/form pada tab target (title, URL, nama field, label). Nilai sensitif tidak dikirim ke AI pada langkah ini.",
        details: [
          `URL: ${activeTargetUrl}`,
          "Data: title, headings, form metadata, field names/ids/types/labels",
          "Aksi: scan lokal di content script (tanpa submit)",
        ],
        confirmLabel: "Proceed Scan",
        onConfirm: () => { void runScan(); },
      },
      domainFromUrl(activeTargetUrl)
    );
  };

  const runAnalyze = async () => {
    if (!settings.ai.enabled || !settings.ai.apiUrl.trim()) {
      pushToast("AI belum dikonfigurasi dengan benar.", "error");
      setTab("settings");
      return;
    }
    if (!settings.ai.model.trim()) {
      pushToast("Pilih AI Model terlebih dahulu (Fetch Models di Settings).", "error");
      setTab("settings");
      return;
    }
    if (!scan) {
      pushToast("Scan halaman terlebih dahulu", "warning");
      return;
    }
    setLoading("analyze");
    try {
      const forceLocal =
        isLocalDemoUrl(settings.ai.apiUrl);
      const result = await analyzePage(settings.ai, scan, { forceLocal });
      setAnalysis(result);
      setValidation(null);
      setTab("scratchpad");
      pushToast(
        `Analisis AI selesai · model ${settings.ai.model}`,
        "success"
      );
    } catch (e) {
      if (e instanceof AiConfigError) {
        pushToast(e.message, "error");
        setTab("settings");
      } else {
        pushToast(e instanceof Error ? e.message : "Gagal analisis AI", "error");
      }
    } finally {
      setLoading(null);
    }
  };

  const handleAnalyze = () => {
    if (!settings.ai.enabled || !settings.ai.apiUrl.trim()) {
      pushToast("AI belum dikonfigurasi dengan benar.", "error");
      setTab("settings");
      return;
    }
    if (!settings.ai.model.trim()) {
      pushToast("Pilih AI Model terlebih dahulu (Fetch Models di Settings).", "error");
      setTab("settings");
      return;
    }
    if (!scan) {
      pushToast("Scan halaman terlebih dahulu", "warning");
      return;
    }
    requestConfirm(
      {
        title: "Kirim data scan ke AI?",
        description:
          "Struktur halaman (bukan password) akan dikirim ke AI API yang Anda konfigurasi untuk mendapatkan summary, field penting, dan aturan validasi.",
        details: [
          `AI API: ${settings.ai.apiUrl}`,
          `Model: ${settings.ai.model}`,
          `Page: ${scan.pageInfo.title}`,
          `URL: ${scan.pageInfo.url}`,
          `Forms: ${scan.forms.length}, Fields: ${scan.fields.length}`,
          `Field names: ${scan.fields
            .slice(0, 8)
            .map((f) => f.name || f.id || f.label)
            .join(", ")}${scan.fields.length > 8 ? "…" : ""}`,
          "Nilai input saat ini tidak disertakan pada analisis awal.",
        ],
        confirmLabel: "Proceed Analyze",
        onConfirm: () => {
          void runAnalyze();
        },
      },
      domainFromUrl(activeTargetUrl)
    );
  };

  const runValidate = async () => {
    if (!settings.ai.enabled) {
      pushToast("AI belum diaktifkan.", "error");
      return;
    }
    if (!scan) {
      pushToast("Scan halaman terlebih dahulu", "warning");
      return;
    }

    setLoading("validate");
    try {
      let fieldsWithValues = scan.fields;

      if (ext && activeTab?.tabId) {
        // Extension: read values via content script
        const resp = await readValuesViaContent(
          activeTab.tabId,
          scan.fields.map((f) => f.uid)
        );
        fieldsWithValues = scan.fields.map((f) => ({
          ...f,
          value: resp.data[f.uid]?.value ?? f.value,
          checked: resp.data[f.uid]?.checked ?? f.checked,
        }));
      } else {
        // Web dev: read directly from DOM
        const doc = getTargetDocument();
        if (!doc) {
          pushToast("Extension tidak punya akses ke tab ini", "error");
          setLoading(null);
          return;
        }
        const values = readFieldValues(
          doc,
          scan.fields.map((f) => f.uid)
        );
        fieldsWithValues = scan.fields.map((f) => ({
          ...f,
          value: values[f.uid]?.value ?? f.value,
          checked: values[f.uid]?.checked ?? f.checked,
        }));
      }

      const scanWithValues: ScanResult = {
        ...scan,
        fields: fieldsWithValues,
        scannedAt: new Date().toISOString(),
      };
      setScan(scanWithValues);

      const forceLocal =
        isLocalDemoUrl(settings.ai.apiUrl) ||
        !settings.ai.apiUrl.trim();
      const result = await validatePage(settings.ai, scanWithValues, analysis, {
        forceLocal: forceLocal || !settings.ai.apiUrl.trim(),
      });
      setValidation(result);

      if (analysis) {
        setAnalysis({
          ...analysis,
          important_fields: analysis.important_fields.map((f) => {
            const match = result.fields.find((vf) => {
              const a = (vf.nameOrId || "").toLowerCase();
              const b = (f.nameOrId || "").toLowerCase();
              const c = (f.label || "").toLowerCase();
              return a === b || a === c || a.includes(b) || b.includes(a);
            });
            return match
              ? { ...f, status: match.status, message: match.message, value: match.value }
              : f;
          }),
        });
      }

      setTab("scratchpad");
      pushToast(result.summary, result.overall === "pass" ? "success" : "warning");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Gagal validasi", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleValidate = () => {
    if (!scan) {
      pushToast("Scan halaman terlebih dahulu", "warning");
      return;
    }
    requestConfirm(
      {
        title: "Jalankan validasi nilai field?",
        description:
          "Extension akan membaca nilai field saat ini dan mengirimnya ke AI/engine validasi. Tidak ada submit form.",
        details: [
          `URL: ${activeTargetUrl}`,
          `Fields terdeteksi: ${scan.fields.length}`,
          "Aksi: read values + validate (no submit)",
        ],
        confirmLabel: "Proceed Validation",
        onConfirm: () => {
          void runValidate();
        },
      },
      domainFromUrl(activeTargetUrl)
    );
  };

  const handleSimulatePreview = () => {
    if (!scan) {
      pushToast("Scan halaman terlebih dahulu", "warning");
      return;
    }
    const preview = buildSimulationPreview(scan, analysis);
    if (!preview.length) {
      pushToast("Tidak ada nilai simulasi yang bisa dipetakan", "warning");
      return;
    }
    setSimulationPreview(preview);
    pushToast("Preview simulasi siap — review lalu Apply", "info");
  };

  const handleApplySimulation = () => {
    if (!simulationPreview || !scan) return;
    requestConfirm(
      {
        title: "Terapkan Simulate Fill?",
        description:
          "Nilai dummy akan diisikan ke field di halaman target dan men-trigger event input/change. Form TIDAK akan di-submit.",
        details: [
          `URL: ${activeTargetUrl}`,
          ...simulationPreview.slice(0, 6).map((r) => `${r.label} → ${String(r.value)}`),
          simulationPreview.length > 6 ? `…dan ${simulationPreview.length - 6} field lain` : "",
          "Tidak ada klik tombol submit / navigasi.",
        ].filter(Boolean),
        confirmLabel: "Apply Simulation",
        onConfirm: async () => {
          setLoading("simulate");
          try {
            if (ext && activeTab?.tabId) {
              await clearHighlightsViaContent(activeTab.tabId);
              const mapping = simulationPreview.map((p) => ({ uid: p.uid, value: p.value }));
              await applySimulationViaContent(activeTab.tabId, mapping);
              // Re-read values
              const resp = await readValuesViaContent(
                activeTab.tabId,
                scan.fields.map((f) => f.uid)
              );
              setScan({
                ...scan,
                fields: scan.fields.map((f) => ({
                  ...f,
                  value: resp.data[f.uid]?.value ?? f.value,
                  checked: resp.data[f.uid]?.checked ?? f.checked,
                })),
              });
            } else {
              const doc = getTargetDocument();
              if (!doc) {
                pushToast("Extension tidak punya akses ke tab ini", "error");
                setLoading(null);
                return;
              }
              clearHighlights(doc);
              applySimulation(
                doc,
                simulationPreview.map((p) => ({ uid: p.uid, value: p.value }))
              );
              const values = readFieldValues(
                doc,
                scan.fields.map((f) => f.uid)
              );
              setScan({
                ...scan,
                fields: scan.fields.map((f) => ({
                  ...f,
                  value: values[f.uid]?.value ?? f.value,
                  checked: values[f.uid]?.checked ?? f.checked,
                })),
              });
            }
            setSimulationPreview(null);
            pushToast(
              `Simulasi diterapkan ke ${simulationPreview.length} field (tanpa submit)`,
              "success"
            );
          } finally {
            setLoading(null);
          }
        },
      },
      domainFromUrl(activeTargetUrl)
    );
  };

  const handleFieldClick = async (uid?: string, nameOrId?: string) => {
    let targetUid = uid;
    if (!targetUid && scan && nameOrId) {
      const f = scan.fields.find(
        (x) =>
          x.name === nameOrId ||
          x.id === nameOrId ||
          x.label === nameOrId ||
          x.uid === nameOrId
      );
      targetUid = f?.uid;
    }
    if (!targetUid && analysis && nameOrId) {
      const f = analysis.important_fields.find((x) => x.nameOrId === nameOrId);
      targetUid = f?.uid;
    }
    if (!targetUid) {
      pushToast("Field tidak ditemukan di DOM", "warning");
      return;
    }

    if (ext && activeTab?.tabId) {
      try {
        const resp = await highlightViaContent(activeTab.tabId, targetUid);
        if (!resp.ok) pushToast("Field tidak ditemukan di DOM", "warning");
      } catch {
        pushToast("Gagal highlight field", "warning");
      }
      return;
    }

    const doc = getTargetDocument();
    if (!doc) {
      pushToast("Tidak bisa highlight field pada tab eksternal", "warning");
      return;
    }
    const ok = highlightField(doc, targetUid);
    if (!ok) pushToast("Field tidak ditemukan di DOM", "warning");
  };

  const handleSaveSettings = () => {
    if (draftSettings.ai.enabled && !draftSettings.ai.apiUrl.trim()) {
      setSettingsError("AI diaktifkan tetapi AI API URL kosong. Setting tidak disimpan.");
      pushToast("AI API URL wajib diisi jika AI aktif", "error");
      return;
    }
    if (draftSettings.ai.enabled && !draftSettings.ai.model.trim()) {
      setSettingsError(
        "AI diaktifkan tetapi AI Model belum dipilih. Klik Fetch Models lalu pilih model."
      );
      pushToast("AI Model wajib dipilih jika AI aktif", "error");
      return;
    }
    setSettingsError(null);
    const next = {
      ...draftSettings,
      targetUrl: targetUrlInput.trim() || draftSettings.targetUrl,
    };
    setSettings(next);
    setDraftSettings(next);
    saveSettings(next);
    pushToast(
      next.ai.model
        ? `Settings disimpan · model ${next.ai.model}`
        : "Settings disimpan ke storage",
      "success"
    );
  };

  // Extension mode: render only the side panel (no iframe target area)
  if (ext) {
    return (
      <div className="flex h-screen min-h-[640px] overflow-hidden bg-ink-950">
        <div className="flex w-full flex-col">
          <ExtensionPanel
            tab={tab}
            onTabChange={setTab}
            settings={settings}
            draftSettings={draftSettings}
            onDraftChange={setDraftSettings}
            onSaveSettings={handleSaveSettings}
            targetUrlInput={activeTab?.url || ""}
            onTargetUrlChange={() => {}}
            targetOpen={targetOpen}
            urlError={urlError}
            onOpenTarget={handleOpenTarget}
            scan={scan}
            analysis={analysis}
            validation={validation}
            loading={loading}
            settingsError={settingsError}
            onScan={handleScan}
            onAnalyze={handleAnalyze}
            onValidate={handleValidate}
            onSimulatePreview={handleSimulatePreview}
            simulationPreview={simulationPreview}
            onApplySimulation={handleApplySimulation}
            onCancelSimulation={() => setSimulationPreview(null)}
            onFieldClick={handleFieldClick}
            aiReady={aiReady}
            models={models}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            onFetchModels={() => {
              void handleFetchModels();
            }}
          />
        </div>
        {confirm && (
          <ConfirmDialog
            action={confirm}
            domain={domainFromUrl(activeTargetUrl)}
            showSkipOption
            skipChecked={skipChecked}
            onSkipChange={setSkipChecked}
            onCancel={() => setConfirm(null)}
          />
        )}
        <ToastStack items={toasts} />
      </div>
    );
  }

  // Web dev mode: original layout with target area + extension panel
  return (
    <div className="flex h-screen min-h-[640px] overflow-hidden bg-ink-950">
      {/* Main / target area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-900 px-4 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ext-400">
              Target Tab
            </div>
            <div className="truncate font-mono text-xs text-ink-300">
              {targetOpen ? activeTargetUrl : "Tidak ada tab target"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-ink-800 px-2.5 py-1 text-[10px] font-medium text-ink-300 sm:inline">
              Chrome extension simulator
            </span>
            {targetOpen && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Active
              </span>
            )}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-ink-200">
          {!targetOpen ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="text-lg font-semibold text-ink-700">Belum ada tab target</div>
              <p className="max-w-md text-sm text-ink-500">
                Isi Target URL di panel extension lalu klik Open Target untuk membuka halaman yang
                akan di-screen.
              </p>
            </div>
          ) : externalFrameUrl ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                Mode eksternal: iframe mungkin diblokir (X-Frame-Options). Scan DOM cross-origin
                tidak tersedia — gunakan <strong>sandbox://coretax-spt-masa</strong> untuk demo
                lengkap. Tab baru juga dicoba dibuka via window.open.
              </div>
              <iframe
                title="External target"
                src={externalFrameUrl}
                className="min-h-0 w-full flex-1 border-0 bg-white"
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
              />
            </div>
          ) : (
            <SandboxPage ref={sandboxRef} />
          )}
        </div>
      </div>

      {/* Extension side panel */}
      <div className="flex w-full max-w-[420px] shrink-0 flex-col border-l border-ink-900 shadow-2xl shadow-black/40">
        <ExtensionPanel
          tab={tab}
          onTabChange={setTab}
          settings={settings}
          draftSettings={draftSettings}
          onDraftChange={setDraftSettings}
          onSaveSettings={handleSaveSettings}
          targetUrlInput={targetUrlInput}
          onTargetUrlChange={(v) => {
            setTargetUrlInput(v);
            setUrlError(null);
          }}
          targetOpen={targetOpen}
          urlError={urlError}
          onOpenTarget={handleOpenTarget}
          scan={scan}
          analysis={analysis}
          validation={validation}
          loading={loading}
          settingsError={settingsError}
          onScan={handleScan}
          onAnalyze={handleAnalyze}
          onValidate={handleValidate}
          onSimulatePreview={handleSimulatePreview}
          simulationPreview={simulationPreview}
          onApplySimulation={handleApplySimulation}
          onCancelSimulation={() => setSimulationPreview(null)}
          onFieldClick={handleFieldClick}
          aiReady={aiReady}
          models={models}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          onFetchModels={() => {
            void handleFetchModels();
          }}
        />
      </div>

      {confirm && (
        <ConfirmDialog
          action={confirm}
          domain={domainFromUrl(activeTargetUrl)}
          showSkipOption
          skipChecked={skipChecked}
          onSkipChange={setSkipChecked}
          onCancel={() => setConfirm(null)}
        />
      )}

      <ToastStack items={toasts} />

      {!isSandboxTarget && null}
    </div>
  );
}

function rescanInContainer(root: HTMLElement, url: string, title: string) {
  const doc = root.ownerDocument;
  const result = scanDocument(doc, url, title);
  return result.fields.filter((f) => {
    const el = doc.querySelector(`[data-wsvs-uid="${f.uid}"]`);
    return el && root.contains(el);
  });
}
