const copyBulkAddButton = document.getElementById("copy-bulkadd");
const downloadBulkAddButton = document.getElementById("download-bulkadd");
const downloadAuthButton = document.getElementById("download-auth");
const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message;
}

function base64UrlEncode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function buildSyntheticIdToken(session) {
  const accountId = session.account?.id || "";
  const userId = session.user?.id || "";
  const planType = session.account?.planType || "free";
  const email = session.user?.email || "";
  const iat = Math.floor(Date.now() / 1000);
  const exp = session.expires
    ? Math.floor(new Date(session.expires).getTime() / 1000)
    : iat + 30 * 24 * 3600;

  const header = { alg: "none", typ: "JWT", cpa_synthetic: true };
  const payload = {
    iat,
    exp,
    "https://api.openai.com/auth": {
      chatgpt_account_id: accountId,
      chatgpt_plan_type: planType,
      chatgpt_user_id: userId,
      user_id: userId
    },
    email
  };

  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.synthetic`;
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
  copyBulkAddButton.disabled = true;
  downloadBulkAddButton.disabled = true;
  downloadAuthButton.disabled = true;
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
    copyBulkAddButton.disabled = false;
    downloadBulkAddButton.disabled = false;
    downloadAuthButton.disabled = false;
  }
}

copyBulkAddButton.addEventListener("click", () => exportJson("copy-bulkadd"));
downloadBulkAddButton.addEventListener("click", () => exportJson("bulkadd"));
downloadAuthButton.addEventListener("click", () => exportJson("auth"));
