# Codex Login Bypass Phone Ver

A small Chrome extension that exports the current ChatGPT web session into JSON formats commonly used by Codex wrappers and 9router.

The extension runs locally in your browser. It does not send tokens to any external server. You choose a format, it reads `https://chatgpt.com/api/auth/session` with your existing ChatGPT cookies, then downloads a JSON file.

## Export Formats

### `auth.json`

Use this when a tool expects the original Codex-style auth file:

```json
{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "id_token": "...",
    "access_token": "...",
    "refresh_token": "...",
    "account_id": "..."
  },
  "last_refresh": "2026-07-06T00:00:00.000Z"
}
```

### `9router-codex-bulkadd.json`

Use this with the 9router Codex provider Bulk Add modal:

```json
[
  {
    "accessToken": "...",
    "refreshToken": "...",
    "idToken": "...",
    "email": "you@example.com"
  }
]
```

## Install

1. Download or clone this repository.
2. Open Chrome or a Chromium-based browser.
3. Go to `chrome://extensions`.
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select this repository folder.
7. Log in to `https://chatgpt.com`.
8. Click the extension icon and choose the export format you need.

## How It Works

The extension calls:

```js
fetch("https://chatgpt.com/api/auth/session", { credentials: "include" })
```

Then it builds:

- a synthetic `id_token` with the ChatGPT account id, plan type, user id, email, issue time, and expiry
- an `auth.json` file for Codex-style tools
- a 9router-compatible Bulk Add array

## Security Notes

The downloaded JSON contains active session credentials. Treat it like a password.

- Do not commit exported JSON files.
- Do not share exported JSON files publicly.
- Remove old exports when you no longer need them.
- Re-export after logging in again if a token expires.

## Files

```text
manifest.json  Chrome extension manifest
popup.html     Extension popup UI
popup.js       Session fetch, JSON builders, and download logic
```

## Development

This project has no build step and no dependencies. Edit the files, then reload the extension from `chrome://extensions`.
