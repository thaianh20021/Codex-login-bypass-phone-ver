(function initBulkAddConverter(root) {
  function toRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function str(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  }

  function base64UrlEncode(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    let base64;
    if (typeof btoa === "function") {
      const bytes = new TextEncoder().encode(text);
      let binary = "";
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      base64 = btoa(binary);
    } else {
      base64 = Buffer.from(text, "utf8").toString("base64");
    }
    return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function decodeJwtPayload(token) {
    const parts = str(token).split(".");
    if (parts.length < 2) return null;

    const base64 = `${parts[1]}${"=".repeat((4 - (parts[1].length % 4)) % 4)}`
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    try {
      const json =
        typeof atob === "function"
          ? new TextDecoder().decode(
              Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)),
            )
          : Buffer.from(base64, "base64").toString("utf8");
      return toRecord(JSON.parse(json));
    } catch {
      return null;
    }
  }

  function parseExpiry(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
    }
    const text = str(value);
    if (!text) return 0;
    const asNumber = Number(text);
    if (Number.isFinite(asNumber)) return parseExpiry(asNumber);
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
  }

  function buildSyntheticIdToken(fields) {
    const now = Math.floor(Date.now() / 1000);
    const accountId = str(fields.accountId);
    const userId = str(fields.userId);
    const planType = str(fields.planType) || "free";
    const email = str(fields.email);
    const exp = parseExpiry(fields.exp) || now + 30 * 24 * 3600;
    const header = { alg: "none", typ: "JWT", cpa_synthetic: true };
    const payload = {
      iat: now,
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

  function candidateContainers(input) {
    if (Array.isArray(input)) return input;

    const rootObject = toRecord(input);
    if (!rootObject) return [];

    if (Array.isArray(rootObject.accounts)) {
      return rootObject.accounts;
    }
    if (Array.isArray(rootObject.items)) {
      return rootObject.items;
    }

    return [rootObject];
  }

  function unwrapAccount(account) {
    const rootObject = toRecord(account) || {};
    const credentials = toRecord(rootObject.credentials) || {};
    const tokens = toRecord(rootObject.tokens) || {};
    const auth = toRecord(rootObject.auth) || {};
    const webSession = toRecord(credentials.web_session) || {};
    return { rootObject, credentials, tokens, auth, webSession };
  }

  function firstString(...values) {
    for (const value of values) {
      const text = str(value);
      if (text) return text;
    }
    return "";
  }

  function accountToBulkAdd(account, index) {
    const { rootObject, credentials, tokens, auth, webSession } = unwrapAccount(account);

    const accessToken = firstString(
      rootObject.accessToken,
      rootObject.access_token,
      credentials.accessToken,
      credentials.access_token,
      webSession.accessToken,
      webSession.access_token,
      tokens.accessToken,
      tokens.access_token,
      auth.accessToken,
      auth.access_token,
    );

    if (!accessToken) {
      throw new Error(`Account ${index + 1} is missing access token.`);
    }

    const jwtPayload = decodeJwtPayload(firstString(rootObject.idToken, rootObject.id_token, credentials.idToken, credentials.id_token, tokens.idToken, tokens.id_token));
    const authPayload = toRecord(jwtPayload?.["https://api.openai.com/auth"]) || {};
    const email = firstString(rootObject.email, credentials.email, tokens.email, auth.email, jwtPayload?.email);
    const refreshToken = firstString(
      rootObject.refreshToken,
      rootObject.refresh_token,
      credentials.refreshToken,
      credentials.refresh_token,
      credentials.web_session,
      credentials.session_token,
      webSession.refreshToken,
      webSession.refresh_token,
      webSession.sessionToken,
      webSession.session_token,
      tokens.refreshToken,
      tokens.refresh_token,
      auth.refreshToken,
      auth.refresh_token,
      "placeholder",
    );

    const idToken =
      firstString(
        rootObject.idToken,
        rootObject.id_token,
        credentials.idToken,
        credentials.id_token,
        tokens.idToken,
        tokens.id_token,
        auth.idToken,
        auth.id_token,
      ) ||
      buildSyntheticIdToken({
        accountId: firstString(
          rootObject.account_id,
          rootObject.chatgpt_account_id,
          credentials.account_id,
          credentials.chatgpt_account_id,
          tokens.account_id,
          authPayload.chatgpt_account_id,
          authPayload.account_id,
        ),
        userId: firstString(
          rootObject.user_id,
          rootObject.chatgpt_user_id,
          credentials.user_id,
          credentials.chatgpt_user_id,
          authPayload.chatgpt_user_id,
          authPayload.user_id,
        ),
        planType: firstString(
          rootObject.plan_type,
          credentials.plan_type,
          authPayload.chatgpt_plan_type,
        ),
        email,
        exp: firstString(
          rootObject.expires_at,
          rootObject.expired,
          credentials.expires_at,
          credentials.expired,
          webSession.session_expires_at,
        ),
      });

    return {
      accessToken,
      refreshToken,
      idToken,
      email
    };
  }

  function convertToBulkAdd(input) {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    const accounts = candidateContainers(parsed);
    if (accounts.length === 0) {
      throw new Error("No accounts found.");
    }

    return accounts.map(accountToBulkAdd);
  }

  const api = { buildSyntheticIdToken, convertToBulkAdd };
  root.bulkAddConverter = api;
  if (typeof module !== "undefined") {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
