# freebuff2api-workers

OpenAI-compatible and Anthropic Messages-compatible edge bridge for Freebuff models.

## Production

- Base URL: `https://freebuff2api-prod.hknerdr.deno.net`
- OpenAI API: `/v1/chat/completions`, `/v1/responses`, `/v1/models`
- Anthropic API: `POST /v1/messages`
- Health check: `GET /healthz` (public)
- Landing page: `GET /` (public, dark theme, curl quickstart)
- Admin dashboard: `GET /admin` (public HTML; data calls require the API key)
- Public admin data: `GET /admin/status`, `GET /admin/models` (no secrets, no auth)

Set `FREEBUFF_TOKEN` to one or more Freebuff tokens (comma or newline separated). Set `FREEBUFF_API_KEY` to the key accepted by the bridge. If it is unset, the development default is `freebuff-default-key`; set it explicitly in production.

Optional configuration (all env vars):

| Variable | Meaning |
|---|---|
| `FREEBUFF_API_KEYS` | Extra API keys, comma/newline separated, each optionally `key:limit` (limit = daily request cap). Keys from `FREEBUFF_API_KEY` and `FREEBUFF_API_KEYS` are all accepted. |
| `FREEBUFF_ADMIN_KEY` | When set, `/admin/usage`, `/admin/accounts` and `/admin/models/toggle` require this key; `FREEBUFF_API_KEYS` holders keep access only to `/v1/*` proxy endpoints. When unset (single-operator setup), any accepted key keeps admin powers. |
| `FREEBUFF_DEFAULT_MODEL` | Overrides the default model id used when a request omits `model`. |
| `FREEBUFF_DISABLED_MODELS` | Comma-separated model ids hard-disabled via config (panel toggle cannot re-enable these). |
| `FREEBUFF_ALERT_WEBHOOK` | URL receiving `{"text": ...}` JSON when an account is detected dead (fires on authenticated account probes and chat 401/403 responses — not on the public `/healthz` path). |
| `FREEBUFF_TG_BOT_TOKEN` + `FREEBUFF_TG_CHAT_ID` | Telegram fallback for the same dead-account alerts. |
| `FREEBUFF_DEBUG` | `true` enables per-request upstream logging. |

### Anthropic client example

```bash
curl https://freebuff2api-prod.hknerdr.deno.net/v1/messages \
  -H 'x-api-key: YOUR_FREEBUFF_API_KEY' \
  -H 'anthropic-version: 2023-06-01' \
  -H 'content-type: application/json' \
  -d '{"model":"deepseek/deepseek-v4-flash","max_tokens":256,"messages":[{"role":"user","content":"Hello"}]}'
```

The admin page itself must be opened without an API key. Enter a configured key in the page, then press Refresh. `/admin/usage` and `/admin/accounts` are authenticated endpoints (401 `Invalid API key` without the key). The dashboard has Overview / Accounts / Models tabs; Overview shows runtime cards, a 14-day usage chart, per-key daily usage, and the per-model table; Models lets you enable/disable models (persisted in KV); Accounts shows per-account alive status, quotas, request counts, last used time, and last error.

`GET /admin/status` reports `auth.mode` (`custom` when any `FREEBUFF_API_KEY`/`FREEBUFF_API_KEYS`/`API_KEY` is set, `default` otherwise) and `auth.api_key_set`, so you can confirm which key policy the deployed revision actually uses. If `/admin` returns `{"error":{"message":"Invalid API key"...}}`, the deployed revision is old or the deployment entrypoint is wrong; deploy `deno_deploy/entry.js` and verify `/healthz.version` shows `1.8.0`.

## Anthropic compatibility

The bridge translates the Anthropic Messages shape to the upstream OpenAI chat shape. It supports text, system prompts, stop sequences, streaming, tool definitions, tool calls, tool results, Anthropic-style errors, and image blocks where the upstream model accepts OpenAI image parts.

Image input shapes accepted by the translator:

```json
{"type":"image","source":{"type":"base64","media_type":"image/png","data":"..."}}
```

or:

```json
{"type":"image","source":{"type":"url","url":"https://example.com/image.png"}}
```

The following are translated on a best-effort basis, not guaranteed as native Anthropic features:

- `cache_control`: retained only when the upstream provides an equivalent; no persistent prompt cache is created by this worker.
- `thinking: {"type":"enabled","budget_tokens":...}`: mapped to upstream reasoning effort where available; no Anthropic signature or budget guarantee.
- Tool round trips: `tool_use` and `tool_result` are converted to OpenAI tool calls and tool messages, including subsequent turns. Provider-specific edge cases may differ.
- Usage: `input_tokens` and `output_tokens` are copied from upstream token fields. If upstream does not return token counts, the bridge returns zero; it never invents billing data.
- Real Anthropic Claude models, official Claude quotas, Anthropic billing, prompt-cache accounting, and provider-specific advanced thinking are not supplied by Freebuff and cannot be created by a format proxy.

Model IDs are Freebuff/upstream IDs. `anthropic/claude-fable-5` is a Freebuff model alias, not an official Anthropic Claude model.

## Admin usage

Usage counters are accumulated in-memory and flushed to persistent storage (Deno KV on Deno Deploy, `FREEBUFF_KV` binding on Cloudflare, or in-memory otherwise), so totals survive isolate restarts. They are operational counters, not billing or token metrics; per-key limits are enforced per isolate and are best-effort across multiple isolates. Account quota data comes from Freebuff account probes and may be unavailable during upstream errors.

## Local checks

```bash
node --check worker.js
node --check deno_deploy/worker.js
git diff --check
```

## Deployment

The production deployment configuration is in `deploy.json` and uses `deno_deploy/entry.js`. Configure `FREEBUFF_TOKEN` and `FREEBUFF_API_KEY` as Deno Deploy environment variables, deploy the project, then verify:

```bash
curl -i https://freebuff2api-prod.hknerdr.deno.net/healthz
curl -i https://freebuff2api-prod.hknerdr.deno.net/admin
curl -i https://freebuff2api-prod.hknerdr.deno.net/admin/usage \
  -H 'Authorization: Bearer YOUR_FREEBUFF_API_KEY'
```

## License

MIT.
