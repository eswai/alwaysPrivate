const BROWSER = typeof browser !== 'undefined' ? browser : chrome;
let lastEventTime = 0;

async function getWhitelist() {
  const result = await BROWSER.storage.local.get("whitelist");
  return result.whitelist || [];
}

BROWSER.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.frameId !== 0 || details.type !== "main_frame") {
      return;
    }

    // Ignore events within 10ms of the last event
    const now = Date.now();
    if (now - lastEventTime < 10) {
      return;
    }
    lastEventTime = now;

    // Check if the request is from an incognito tab
    try {
      const tab = await BROWSER.tabs.get(details.tabId);
      if (tab && tab.incognito) {
        return;
      }
    } catch (e) {
      // Tab might not exist, continue processing
    }

    const url = new URL(details.url);
    const domain = url.hostname;
    const whitelist = await getWhitelist();

    if (whitelist.includes(domain)) {
      return;
    }

    const windows = await BROWSER.windows.getAll();
    const privateWindow = windows.find(w => w.incognito);

    if (privateWindow) {
      // If a private window already exists, create a new tab in it.
      BROWSER.tabs.create({
        windowId: privateWindow.id,
        url: details.url,
        active: true
      });
    } else {
      // Otherwise, create a new private window.
      BROWSER.windows.create({
        url: details.url,
        incognito: true,
      });
    }

    // If the request came from a newly opened blank tab, close it.
    try {
      const tab = await BROWSER.tabs.get(details.tabId);
      if (tab && (tab.url === "about:blank" || !tab.url)) {
        await BROWSER.tabs.remove(details.tabId);
      }
    } catch (e) {
      // Tab may have already been closed.
    }

    return { cancel: true };
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking"]
);
