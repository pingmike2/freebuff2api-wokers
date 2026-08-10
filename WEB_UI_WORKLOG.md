# Web Console — Worklog & Status (handoff document)

> Read this first if you are a new agent picking up the freebuff2api web console work.
> Last updated: 2026-08-10 (v1.8.0). All changes are **local only** — nothing is deployed live from this environment.

## Goal

Landing page + admin dashboard for the `freebuff2api` proxy (Deno Deploy edge worker),
plus persistent usage, per-key limits, model management, and account alerts.

## What exists now (code-complete, locally tested)

`worker.js` and `deno_deploy/worker.js` are **byte-identical** (`cmp` verified). `VERSION = "1.8.0"`.

### Public routes (all before the auth check)
| Route | Response |
|---|---|
| `GET /` | Landing page (dark theme, health dot, curl quickstart, link to `/admin`) |
| `GET /admin` | Admin dashboard HTML (client-side authenticated) |
| `GET /admin/status` | JSON: status, version, `auth {mode, api_key_set}`, `key_count`, accounts, models, default_model, uptime |
| `GET /admin/models` | JSON: `{object:"list", data:[{id,agent,session,upstream,disabled}]}` (public, no secrets) |

### Auth'd routes
`GET /admin/usage`, `GET /admin/accounts`, `POST /admin/models/toggle`, `GET /v1/models`, chat/responses/messages — require a configured key (`FREEBUFF_API_KEY` / `FREEBUFF_API_KEYS` / default key).

### v1.8.0 features
- **Persistent usage (KV)**: totals, per-model, per-day, per-key counters flushed from
  in-memory deltas to Deno KV (Deno Deploy), `env.FREEBUFF_KV` (Cloudflare), or in-memory fallback.
  Flush on 30s cadence / admin reads. `/admin/usage` returns `days` (last 14) and `keys` (today).
- **Multi-key + daily limits**: `FREEBUFF_API_KEYS="key1:100,key2"` — `:limit` = daily request cap;
  429 `rate_limit_error` when exhausted. `key_count` in `/admin/status`.
- **Model management**: `POST /admin/models/toggle` persists disabled state in KV;
  `FREEBUFF_DISABLED_MODELS` (env) hard-disables; disabled models are filtered from `/v1/models`
  and rejected with 404 `model_not_found` on chat.
- **Env default model**: `FREEBUFF_DEFAULT_MODEL` overrides the hardcoded default.
- **Accounts history**: per-account `requests`, `last_used_at`, `last_error`/`last_error_at`
  (last 5 errors kept); 401/403 on chat marks the account dead.
- **Dead-account alerts**: `FREEBUFF_ALERT_WEBHOOK` (JSON `{text}`) or Telegram
  (`FREEBUFF_TG_BOT_TOKEN` + `FREEBUFF_TG_CHAT_ID`), deduped 6h per account.
- **Playground removed** (per user decision). Tabs: Overview / Accounts / Models.
  Overview now has usage cards, a 14-day SVG bar chart, per-key table, per-model table.

### Data shapes
- `/admin/usage` → `{version, auth, started_at, uptime_seconds, requests, successes, errors,
  input_characters, output_characters, by_model, days:[{date,requests,successes,errors,inputChars,outputChars}],
  keys:[{prefix,limit,today_requests,today_successes,today_errors}]}`
- `/admin/accounts` → per-account `{token_prefix, alive, uid, requests, last_used_at,
  last_error, last_error_at, quota}`

## Gotchas fixed this session (important for future edits)

1. **Template-literal backslash drop**: in the worker's `adminBody()` template literal, `\'`
   is a *valid template escape* that produces `'` (backslash dropped). To send `\'` to the
   browser you must write `\\'` in the worker source. The `renderModels` toggle buttons hit
   this; they now use `\\''+esc(x.id)+'\\'`.
2. **Memory-store key truncation**: the in-memory KV fallback's `list()` previously did
   `kk.slice(0,-1)` which chopped the final character off field names ("request", "successe").
   Fixed to plain `kk.split("\u0000")`. Only the memory backend had this bug; Deno/CF use real key arrays.
3. **Editor/JSON backslash decoding** (carried over): a payload `\\` in the editor becomes `\`
   in the file. Double the backslashes you want to reach the browser.
4. **curl line continuations** (carried over): JS source `\`+newline is a line continuation and
   is stripped; display real `\`+newline via `\\\n` in the client source (six backslashes + `n`
   in the worker template literal).
5. **Data-source of truth**: edit `worker.js`, then `cp worker.js deno_deploy/worker.js` and
   `cmp` to keep them in sync.

## Skeptik review (2026-08-10) — findings & fixes

Two review agents (code + security) ran against the v1.8.0 surface. All actionable findings fixed and regression-tested (25/25):

| Finding | Fix |
|---|---|
| CF KV `list()` split on `/` mangled model ids (all contain `/`) | CF adapter percent-encodes each key component (`encodeURIComponent`) and decodes on list |
| CF KV `sum()` non-atomic read-modify-write (multi-isolate loss) | Documented in adapter comment; Deno KV (atomic `sum`) unaffected — CF is the fallback path |
| `openAIStreamToAnthropic` dropped SSE lines split across chunks | Added `buf` accumulator across chunks (matches the other four SSE readers) |
| Upstream non-OK responses never counted as errors | `errors` now bumps once per failed request (final 502), so `requests = successes + errors` reconciles |
| `flushDeltas` restore-on-failure could double-count partially committed sums | `Promise.allSettled` + per-op restore (`restoreDelta`); only uncommitted ops return to memory |
| Degenerate `FREEBUFF_API_KEYS` (whitespace/stray commas) caused total lockout; whitespace-only `API_KEY` shadowed real key | `if (list.length === 0) add(DEFAULT_API_KEY, 0)`; candidates evaluated trimmed independently |
| Per-key counters keyed by 8-char prefix → shared-prefix keys shared quotas | Counters keyed by 64-bit FNV-1a hash of the full key (`keyAccountId`); prefix kept for display only |
| Composite `date:key` / `date:model` strings re-split on `:` corrupted keys containing `:` | In-memory map keys now use `\u0000` separator (`date\u0000keyId`), split on `lastIndexOf("\u0000")` |
| Any valid key had admin powers (model toggle = global DoS, usage/accounts = cross-tenant disclosure) | New `FREEBUFF_ADMIN_KEY`: when set, `/admin/*` routes require it; customers keep `/v1/*` only. Backward compatible (unset → any key is admin) |
| Public `/healthz` could fire webhook/Telegram alerts (unauthenticated side effect) | Alerts moved off the public probe path; now fire only on authenticated account probe and chat 401/403 |
| CF `KVNamespace.put` rejects numeric values (model-disable 500 on CF) | CF adapter stringifies `put` values |

## Verification (all green, 2026-08-10)

- `node --check worker.js` / `deno_deploy/worker.js` → PASS; `cmp` identical.
- `git diff --check` → clean.
- **Test harness `/tmp/test_v18.mjs`: 25/25 PASS** (upstream `codebuff.com` stubbed via global
  fetch): public/auth routes, no-Playground UI, chart/keys/toggle presence, chat (non-stream,
  stream, Anthropic, Responses), usage counters + flush idempotency, per-key 429 limit,
  shared-prefix key independence (KV-001), colon-key limits (KV-002), admin-key gating (AUTHZ-001),
  degenerate-config fallback, default-key rejection, disabled-model toggle + env precedence,
  env default model, dead-account alert via chat 401 + cooldown dedupe + silent /healthz
  (ABUSE-001), accounts history, client JS in `vm` sandbox (boot/loadAll/chart/toggleModel/landing curl).

## UI upgrade (v1.8.1, 2026-08-10) — terminal-themed dashboard

Design (agent-researched, WCAG-verified): **Catppuccin Mocha** palette (bg `#1e1e2e`, accent teal `#94e2d5`, status green/yellow/red from the family), **IBM Plex Mono** single family (Google Fonts link in pageShell), base type 14→15px, card numbers 26px, radius 3px, signature = terminal prompt header `$ freebuff2api█` with blinking block cursor, bar-grow chart animation (all `prefers-reduced-motion` guarded).

New dashboard features (from agent brainstorm, all additive to existing responses — no new routes):
- Health cards: success/error rate + day-over-day delta chips (client-side from `days`)
- Traffic chart with **per-model selector** (server now returns `by_day_model`, the KV space that was written but never read)
- Per-key table: today counters + 14-day **sparkline** + UTC reset countdown for limited keys (`keys[].days`)
- **Quota matrix** (account × model, used/limit, ok/warn/exhaust coloring) — client-side
- Account error timeline (`last_errors` array added to `/admin/accounts`)
- CSV export button (client-side from `/admin/usage`)
- Header badges: `store: deno_kv|cf_kv|memory` + flush health + alert channels (`adminStatus` additive fields)
- `readDays` removed (inlined into handleAdminUsage single KV pass)

## Live status (2026-08-10, DEPLOYED)

- **v1.8.0 CANLI**: `https://freebuff2api-prod.hknerdr.deno.net`
  - `/healthz` → `1.8.0`, 5/5 hesap canlı; `/admin`, `/` → 200 HTML; `/admin/status` → custom auth, key_count 1
  - `/admin/usage` key'li → 200 (sayaçlar canlı trafiği sayıyor); key'siz → 401
- Deploy artık **eski deployctl/dash.deno.com ile DEĞİL**: Deno Deploy Classic (dash.deno.com) 2026-07-20'de kapatıldı.
  **Yeni yol: deno'ya gömülü `deno deploy`** (console.deno.com platformu):
  ```bash
  deno deploy --json --non-interactive --token="$DENO_DEPLOY_TOKEN" \
    --org=hknerdr --app=freebuff2api-prod --prod --ignore=.git
  ```
  Token: console.deno.com hesap token'ları; `--token` veya `DENO_DEPLOY_TOKEN` env. `deno deploy whoami` ile doğrulanır.
- Env'ler (FREEBUFF_TOKEN / FREEBUFF_API_KEY) yeni platformda korundu; `deno deploy env list` ile görülür.

## NEXT STEPS (for the next agent / the user)

1. ✅ Deploy done (2026-08-10, revision `3rpw3fnw6y4t`) via `deno deploy` (new console.deno.com CLI).
2. Manual UI pass: Overview cards + 14-day chart + keys table; Accounts columns; Models toggle;
   auth card (wrong key → banner).
3. Optional: run `/tmp/test_v18.mjs` again after any further worker edits, then redeploy with the
   command above (`--prod`; no `--env` flags → project env preserved).

## Known limitations

- Per-key daily limits are enforced per isolate (in-memory delta + KV baseline); with multiple
  Deno Deploy isolates the limit is best-effort, not a hard global cap.
- Usage counters flush debounced (30s) — a hard crash can lose up to ~30s of deltas.
- KV writes use one `sum` per field per flush; fine at this request volume.
- Real Anthropic Claude models/billing are not provided by Freebuff; `anthropic/claude-fable-5`
  is a Freebuff alias.
- Dashboard auth is per-tab: the key lives only in the browser; no server-side session.

## Files touched

- `worker.js` (root) + `deno_deploy/worker.js` — v1.8.0: KV store, flush, multi-key, model
  toggle, alerts, accounts history, dashboard rewrite (Playground removed, chart/keys added).
- `README.md` — env vars table, dashboard description, usage persistence note, version 1.8.0.
- `WEB_UI_WORKLOG.md` — this file.
