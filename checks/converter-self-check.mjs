import assert from "node:assert/strict";
import converter from "../converter.js";

const sub2api = {
  exported_at: "2026-07-06T14:32:17Z",
  proxies: [],
  accounts: [
    {
      name: "sample@example.com",
      platform: "openai",
      type: "oauth",
      credentials: {
        access_token: "access-sub2api",
        chatgpt_account_id: "acct_123",
        chatgpt_user_id: "user_123",
        email: "sample@example.com",
        expires_at: "2026-08-01T00:00:00Z",
        plan_type: "plus",
        web_session: {
          session_token: "web-session-token",
          session_expires_at: "2026-08-02T00:00:00Z"
        }
      }
    }
  ]
};

const sub2apiBulk = converter.convertToBulkAdd(sub2api);
assert.equal(sub2apiBulk.length, 1);
assert.equal(sub2apiBulk[0].accessToken, "access-sub2api");
assert.equal(sub2apiBulk[0].refreshToken, "web-session-token");
assert.equal(sub2apiBulk[0].email, "sample@example.com");
assert.equal(sub2apiBulk[0].idToken.split(".").length, 3);

const cpaBulk = converter.convertToBulkAdd([
  {
    access_token: "access-cpa",
    refresh_token: "refresh-cpa",
    id_token: "id.cpa.token",
    email: "cpa@example.com"
  }
]);
assert.deepEqual(cpaBulk[0], {
  accessToken: "access-cpa",
  refreshToken: "refresh-cpa",
  idToken: "id.cpa.token",
  email: "cpa@example.com"
});

const authBulk = converter.convertToBulkAdd({
  auth_mode: "chatgpt",
  tokens: {
    access_token: "access-auth",
    refresh_token: "refresh-auth",
    id_token: "id.auth.token",
    account_id: "acct_auth"
  }
});
assert.equal(authBulk[0].accessToken, "access-auth");
assert.equal(authBulk[0].refreshToken, "refresh-auth");
assert.equal(authBulk[0].idToken, "id.auth.token");

assert.throws(
  () => converter.convertToBulkAdd([{ email: "missing@example.com" }]),
  /missing access token/,
);

console.log("converter self-check passed");
