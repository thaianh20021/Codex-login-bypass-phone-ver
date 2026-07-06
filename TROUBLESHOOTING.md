# Troubleshooting

This page explains the common `auth.json` refresh error and how to check a local Codex auth file without printing secrets.

## Common Error

```text
Your access token could not be refreshed. Please log out and sign in again.
```

This usually means the exported `auth.json` does not contain a real OAuth `refresh_token`, or the token has expired/revoked.

The extension can read the ChatGPT web session and export `accessToken`. It builds a synthetic `idToken`. For `refreshToken`, it uses:

```js
session.sessionToken || "placeholder"
```

That value is not guaranteed to be a real Codex OAuth refresh token. If it is missing or invalid, Codex may work only until the access token expires.

## Expected `auth.json` Shapes

API key mode:

```json
{
  "auth_mode": "apikey",
  "OPENAI_API_KEY": "..."
}
```

ChatGPT OAuth mode:

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

## Windows Check

Run this in PowerShell. It prints structure, token lengths, and expiry info only. It does not print raw tokens.

```powershell
$p = Join-Path $env:USERPROFILE ".codex\auth.json"
if (!(Test-Path $p)) {
  "missing=$p"
  exit
}

$j = Get-Content -Raw $p | ConvertFrom-Json

function JwtInfo($name, $token) {
  if ([string]::IsNullOrWhiteSpace($token)) {
    return [pscustomobject]@{
      name = $name
      present = $false
      length = 0
      parts = 0
      exp = $null
      expired = $null
    }
  }

  $parts = $token.Split(".")
  $exp = $null
  if ($parts.Count -ge 2) {
    try {
      $payload = $parts[1].Replace("-", "+").Replace("_", "/")
      $payload += "=" * ((4 - ($payload.Length % 4)) % 4)
      $claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
      if ($claims.exp) {
        $exp = [DateTimeOffset]::FromUnixTimeSeconds([int64]$claims.exp).LocalDateTime
      }
    } catch {}
  }

  [pscustomobject]@{
    name = $name
    present = $true
    length = $token.Length
    parts = $parts.Count
    exp = if ($exp) { $exp.ToString("s") } else { $null }
    expired = if ($exp) { $exp -lt (Get-Date) } else { $null }
  }
}

"path=$p"
"auth_mode=$($j.auth_mode)"
"has_OPENAI_API_KEY=$(-not [string]::IsNullOrWhiteSpace([string]$j.OPENAI_API_KEY))"
"has_tokens=$($null -ne $j.tokens)"
if ($j.tokens) {
  "token_keys=" + (($j.tokens.PSObject.Properties.Name) -join ",")
}

JwtInfo "id_token" $j.tokens.id_token
JwtInfo "access_token" $j.tokens.access_token

$rt = $j.tokens.refresh_token
"refresh_token_present=$(-not [string]::IsNullOrWhiteSpace($rt))"
"refresh_token_length=$(if ($rt) { $rt.Length } else { 0 })"
"refresh_token_placeholder=$($rt -eq "placeholder")"
"account_id_present=$(-not [string]::IsNullOrWhiteSpace($j.tokens.account_id))"
"last_refresh=$($j.last_refresh)"
```

## How To Read The Output

- `auth_mode=apikey`: Codex is using an API key, not OAuth tokens.
- `has_tokens=False`: there is no OAuth token block.
- `refresh_token_placeholder=True`: this file will likely fail refresh.
- `refresh_token_present=False`: this file cannot refresh OAuth access tokens.
- `access_token expired=True`: the access token is already expired.

## Practical Fix

For 9router Bulk Add, the extension output is useful for quick import.

For long-running official Codex OAuth use, prefer an `auth.json` produced by a real Codex OAuth login. A synthetic `idToken` plus placeholder refresh token is not enough for reliable refresh.

if some people have some problem about auth.json, i will rcm using 9router
