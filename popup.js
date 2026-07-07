const copyBulkAddButton = document.getElementById("copy-bulkadd");
const downloadBulkAddButton = document.getElementById("download-bulkadd");
const downloadAuthButton = document.getElementById("download-auth");
const convertJsonInput = document.getElementById("convert-json");
const copyConvertedButton = document.getElementById("copy-converted");
const downloadConvertedButton = document.getElementById("download-converted");
const statusEl = document.getElementById("status");
const buttons = [
  copyBulkAddButton,
  downloadBulkAddButton,
  downloadAuthButton,
  copyConvertedButton,
  downloadConvertedButton
];

function setStatus(message) {
  statusEl.textContent = message;
}

function buildSyntheticIdToken(session) {
  return bulkAddConverter.buildSyntheticIdToken({
    accountId: session.account?.id || "",
    userId: session.user?.id || "",
    planType: session.account?.planType || "free",
    email: session.user?.email || "",
    exp: session.expires
  });
}

function buildAuthConfig(session) {
  return {
    auth_mode: "chatgpt",
    OPENAI_API_KEY: null,
    tokens: {
      id_token: buildSyntheticIdToken(session),
      access_token: session.accessToken,
      refresh_token: session.sessionToken || "placeholder",
      account_id: session.account?.id || ""
    },
    last_refresh: new Date().toISOString()
  };
}

function buildBulkAdd(session) {
  const authConfig = buildAuthConfig(session);

  return [
    {
      accessToken: authConfig.tokens.access_token,
      refreshToken: authConfig.tokens.refresh_token,
      idToken: authConfig.tokens.id_token,
      email: session.user?.email || ""
    }
  ];
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
}

async function copyJson(data) {
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
}

function setBusy(isBusy) {
  buttons.forEach((button) => {
    button.disabled = isBusy;
  });
}

function convertedBulkAddFromInput() {
  const input = convertJsonInput.value.trim();
  if (!input) {
    throw new Error("Paste JSON to convert first.");
  }
  return bulkAddConverter.convertToBulkAdd(input);
}

async function fetchSession() {
  const res = await fetch("https://chatgpt.com/api/auth/session", {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Session request failed: HTTP ${res.status}`);
  }

  const session = await res.json();
  if (!session?.accessToken) {
    throw new Error("Login ChatGPT first, then try again.");
  }

  return session;
}

async function exportJson(kind) {
  setBusy(true);
  setStatus("Fetching ChatGPT session...");

  try {
    const session = await fetchSession();
    const email = session.user?.email || "current account";

    if (kind === "copy-bulkadd") {
      await copyJson(buildBulkAdd(session));
      setStatus(`Copied 9router bulkadd for ${email}.`);
    } else if (kind === "auth") {
      downloadJson("auth.json", buildAuthConfig(session));
      setStatus(`Exported auth.json for ${email}.`);
    } else {
      downloadJson("9router-codex-bulkadd.json", buildBulkAdd(session));
      setStatus(`Exported 9router bulkadd for ${email}.`);
    }
  } catch (error) {
    setStatus(error.message || "Export failed.");
  } finally {
    setBusy(false);
  }
}

async function convertJson(kind) {
  setBusy(true);

  try {
    const bulkAdd = convertedBulkAddFromInput();
    if (kind === "copy") {
      await copyJson(bulkAdd);
      setStatus(`Copied ${bulkAdd.length} converted account(s).`);
    } else {
      downloadJson("9router-codex-bulkadd-converted.json", bulkAdd);
      setStatus(`Exported ${bulkAdd.length} converted account(s).`);
    }
  } catch (error) {
    setStatus(error.message || "Convert failed.");
  } finally {
    setBusy(false);
  }
}

copyBulkAddButton.addEventListener("click", () => exportJson("copy-bulkadd"));
downloadBulkAddButton.addEventListener("click", () => exportJson("bulkadd"));
downloadAuthButton.addEventListener("click", () => exportJson("auth"));
copyConvertedButton.addEventListener("click", () => convertJson("copy"));
downloadConvertedButton.addEventListener("click", () => convertJson("download"));
