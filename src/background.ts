// ponytail: minimal service worker — routes messages between side panel and content scripts.

try {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
} catch {}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "wsvs-get-active-tab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      sendResponse(tab ? { tabId: tab.id, url: tab.url, title: tab.title } : null);
    });
    return true;
  }

  if (msg?.type === "wsvs-inject-content") {
    chrome.scripting.executeScript(
      { target: { tabId: msg.tabId }, files: ["content.js"] },
      () => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true });
        }
      }
    );
    return true;
  }

  if (msg?.type === "wsvs-to-content") {
    chrome.tabs.sendMessage(msg.tabId, msg.payload, (response: unknown) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse(response);
      }
    });
    return true;
  }
});
