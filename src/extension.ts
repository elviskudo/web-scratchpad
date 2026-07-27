/// <reference types="chrome" />

// Messaging layer: side panel ↔ content script communication.

export function isExtension(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}

export interface ActiveTab {
  tabId: number;
  url?: string;
  title?: string;
}

export async function getActiveTab(): Promise<ActiveTab | null> {
  if (!isExtension()) return null;
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) { resolve(null); return; }
      resolve({ tabId: tab.id, url: tab.url, title: tab.title });
    });
  });
}

export async function ensureContentScript(tabId: number): Promise<void> {
  if (!isExtension()) return;

  // Try sending a ping first — if content script is already there, it'll respond
  const alreadyInjected = await new Promise<boolean>((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
      resolve(Boolean(response?.ok));
    });
  });
  if (alreadyInjected) return;

  // Inject content script directly via scripting API (no round-trip to background)
  await new Promise<void>((resolve, reject) => {
    chrome.scripting.executeScript(
      { target: { tabId }, files: ["content.js"] },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      }
    );
  });

  // Wait a tick for the script to initialize its message listener
  await new Promise((r) => setTimeout(r, 50));
}

async function sendToContent<T>(tabId: number, payload: unknown): Promise<T> {
  if (!isExtension()) throw new Error("Not in extension context");
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

/** Send message to content script, auto-injecting if needed. */
async function sendWithInject<T>(tabId: number, payload: unknown): Promise<T> {
  await ensureContentScript(tabId);
  return sendToContent<T>(tabId, payload);
}

export async function scanViaContent(tabId: number, url?: string, title?: string) {
  return sendWithInject<{ ok: boolean; data: import("./types").ScanResult }>(tabId, {
    action: "scan",
    url,
    title,
  });
}

export async function readValuesViaContent(tabId: number, uids: string[]) {
  return sendWithInject<{ ok: boolean; data: Record<string, { value: string; checked?: boolean }> }>(
    tabId,
    { action: "read-values", uids }
  );
}

export async function applySimulationViaContent(
  tabId: number,
  mapping: Array<{ uid: string; value: string | boolean }>
) {
  return sendWithInject<{ ok: boolean; data: string[] }>(tabId, {
    action: "apply-simulation",
    mapping,
  });
}

export async function highlightViaContent(tabId: number, uid: string) {
  return sendWithInject<{ ok: boolean }>(tabId, { action: "highlight", uid });
}

export async function clearHighlightsViaContent(tabId: number) {
  return sendWithInject<{ ok: boolean }>(tabId, { action: "clear-highlights" });
}
