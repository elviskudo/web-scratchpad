import { AppSettings, DEFAULT_SETTINGS } from "../types";

const STORAGE_KEY = "wsvs-settings-v1";
const ANALYSIS_KEY = "wsvs-last-analysis-v1";

function isExtension(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}

export function loadSettings(): AppSettings {
  // Sync path: always use localStorage for immediate render.
  // In extension, also hydrate from chrome.storage.local in background.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      ai: { ...DEFAULT_SETTINGS.ai, ...parsed.ai, model: parsed.ai?.model || DEFAULT_SETTINGS.ai.model },
      skipConfirmDomains: parsed.skipConfirmDomains ?? [],
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: AppSettings): void {
  const json = JSON.stringify(settings);
  localStorage.setItem(STORAGE_KEY, json);
  // Also persist to chrome.storage.local if available
  if (isExtension()) {
    chrome.storage.local.set({ [STORAGE_KEY]: json }).catch(() => {});
  }
}

// Async hydration: call on mount to pull chrome.storage values into localStorage
export async function hydrateSettingsFromStorage(): Promise<void> {
  if (!isExtension()) return;
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (typeof raw === "string") {
      localStorage.setItem(STORAGE_KEY, raw);
    }
  } catch {
    /* ignore */
  }
}

export function loadLastAnalysis<T>(): T | null {
  try {
    const raw = localStorage.getItem(ANALYSIS_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveLastAnalysis<T>(data: T): void {
  localStorage.setItem(ANALYSIS_KEY, JSON.stringify(data));
}
