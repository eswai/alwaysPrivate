const BROWSER = typeof browser !== 'undefined' ? browser : chrome;

const domainInput = document.getElementById("domain-input");
const addButton = document.getElementById("add-button");
const whitelistEl = document.getElementById("whitelist");

async function getWhitelist() {
  const result = await BROWSER.storage.local.get("whitelist");
  return result.whitelist || [];
}

async function saveWhitelist(whitelist) {
  await BROWSER.storage.local.set({ whitelist });
}

async function renderWhitelist() {
  const whitelist = await getWhitelist();
  whitelistEl.innerHTML = "";
  for (const domain of whitelist) {
    const li = document.createElement("li");
    li.textContent = domain;
    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
      const newWhitelist = whitelist.filter((d) => d !== domain);
      await saveWhitelist(newWhitelist);
      renderWhitelist();
    });
    li.appendChild(removeButton);
    whitelistEl.appendChild(li);
  }
}

const addCurrentDomainButton = document.getElementById("add-current-domain-button");
const importButton = document.getElementById("import-button");
const exportButton = document.getElementById("export-button");
const importFileInput = document.getElementById("import-file-input");

async function addDomainToWhitelist(domain) {
  if (domain) {
    const whitelist = await getWhitelist();
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      await saveWhitelist(whitelist);
      renderWhitelist();
    }
  }
}

addButton.addEventListener("click", async () => {
  const domain = domainInput.value.trim();
  await addDomainToWhitelist(domain);
  domainInput.value = "";
});

addCurrentDomainButton.addEventListener("click", async () => {
  const tabs = await BROWSER.tabs.query({ active: true, currentWindow: true });
  if (tabs[0] && tabs[0].url) {
    try {
      const url = new URL(tabs[0].url);
      if (url.hostname) {
        await addDomainToWhitelist(url.hostname);
      }
    } catch (e) {
      console.error(`Invalid URL: ${tabs[0].url}`, e);
    }
  }
});

exportButton.addEventListener("click", async () => {
  const whitelist = await getWhitelist();
  const blob = new Blob([JSON.stringify(whitelist, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "always-private-whitelist.json";
  a.click();
  URL.revokeObjectURL(url);
});

importButton.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async (event) => {
  console.log("Importing file:", event.target.files);
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedDomains = JSON.parse(e.target.result);
      if (!Array.isArray(importedDomains)) {
        throw new Error("Invalid format: not an array.");
      }

      const currentWhitelist = await getWhitelist();
      const merged = new Set([...currentWhitelist, ...importedDomains]);
      await saveWhitelist(Array.from(merged));
      renderWhitelist();
    } catch (error) {
      alert(`Error importing whitelist: ${error.message}`);
    }
  };
  reader.readAsText(file);
  // Reset file input to allow importing the same file again
  importFileInput.value = "";
});


document.addEventListener("DOMContentLoaded", renderWhitelist);
