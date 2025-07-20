const BROWSER = typeof browser !== 'undefined' ? browser : chrome;

async function getWhitelist() {
  const result = await BROWSER.storage.local.get("whitelist");
  return result.whitelist || [];
}

BROWSER.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.frameId !== 0 || details.type !== "main_frame") {
      return;
    }

    const currentTab = (await BROWSER.tabs.query({ active: true, currentWindow: true }))[0];
    if (currentTab && currentTab.incognito) {
      return;
    }

    const url = new URL(details.url);
    const domain = url.hostname;
    const whitelist = await getWhitelist();

    if (whitelist.includes(domain)) {
      return;
    }

    // Open in a private window
    BROWSER.windows.create({
      url: details.url,
      incognito: true,
    });

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
