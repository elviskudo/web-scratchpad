/// <reference types="chrome" />

// Content script: runs in the context of web pages.
// Handles scan, read values, simulate fill, highlight — all DOM operations.

import {
  scanDocument,
  readFieldValues,
  applySimulation,
  highlightField,
  clearHighlights,
} from "./services/scanner";

type Msg =
  | { action: "ping" }
  | { action: "scan"; url?: string; title?: string }
  | { action: "read-values"; uids: string[] }
  | { action: "apply-simulation"; mapping: Array<{ uid: string; value: string | boolean }> }
  | { action: "highlight"; uid: string }
  | { action: "clear-highlights" };

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  try {
    switch (msg.action) {
      case "ping": {
        sendResponse({ ok: true });
        break;
      }
      case "scan": {
        const doc = document;
        const result = scanDocument(doc, msg.url || location.href, msg.title || doc.title);
        sendResponse({ ok: true, data: result });
        break;
      }
      case "read-values": {
        const values = readFieldValues(document, msg.uids);
        sendResponse({ ok: true, data: values });
        break;
      }
      case "apply-simulation": {
        applySimulation(document, msg.mapping).then((applied) => {
          sendResponse({ ok: true, data: applied });
        });
        return true; // keep message channel open for async response
      }
      case "highlight": {
        const ok = highlightField(document, msg.uid);
        sendResponse({ ok });
        break;
      }
      case "clear-highlights": {
        clearHighlights(document);
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ error: "Unknown action" });
    }
  } catch (e) {
    sendResponse({ error: e instanceof Error ? e.message : String(e) });
  }
});
