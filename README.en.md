# freebuff2api-workers

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

> 🎉 Issues and PRs are welcome.
>
> 🌐 **Language / 语言**: [中文](README.md) · **English**
> License: **[AGPL-3.0](#license)**

Expose **freebuff / codebuff**'s free models as an **OpenAI-compatible API**. Single file, zero dependencies, **Docker deployment recommended** (or run it on your own VPS). Works with any OpenAI SDK / client (QwenPaw, Hermes, ChatGPT-Next-Web, LobeChat, one-api, …).

> ⚠️ **Deployment warning**: Freebuff now detects Cloudflare Worker deployments (it fingerprints edge markers such as `cf-worker` / `cf-ray`), and deploying on CF **significantly raises the risk of an account ban**. Cloudflare deployment is therefore **not recommended** — use **Docker** or a VPS instead (see [🐳 Docker deployment](#docker-deployment-recommended)).

## Features

- ⭐ **Full-access models**: Cloudflare Workers egress from the US by default, which usually lands in Freebuff's full-access mode; DeepSeek V4 Flash and MiMo 2.5 are official non-Premium models
- 🛡️ **Web admin panel `/admin`**: accounts, proxies, API key and **Freebucks quota** are all editable in the browser — **save and it takes effect, no container restart** (see [🛡️ Admin panel](#admin-panel-admin))
- 💰 **Freebucks quota visibility**: a **daily wallet charged per call** (not a "N calls per model per day" allowlist); the panel shows balance, daily usage, the price table and **which models you can still afford today** (see [💰 Freebucks quota model](#freebucks-quota-model))
- 🔁 **Multi-account rotation**: on quota exhaustion the current account cools down and the next one takes over; accounts are added in the panel, **not** via the `FREEBUFF_TOKEN` env var
- 💡 **Active-session reuse**: a session lasts ~1 hour and only creation is charged; while the current session is alive the worker stays pinned to that account and only switches when it is used up, maximising quota efficiency
- 📢 **Ads and streak flow compatible**: before creating a session the worker follows the official client flow (ad request, then `GET /api/v1/freebuff/streak` check-in). Failures are silently skipped and never block the chat
- 🧩 **OpenAI-compatible**: `/v1/models`, `/v1/chat/completions`, `/v1/responses` (streaming / non-streaming depending on the endpoint)
- 📨 **Anthropic Messages API**: `/v1/messages`, `/messages` and the matching `count_tokens` routes, for Anthropic SDKs and compatible clients
- ❤️ **Health check**: `GET /healthz` (no auth), easy to hook into monitoring
- 📦 **Single-file deploy**: no dependencies, one `worker.js`, works on CF / Docker / VPS

## Anthropic Messages API support

The main code ships with an Anthropic Messages API adapter supporting:

- `POST /v1/messages`
- `POST /messages`
- `POST /v1/messages/count_tokens`
- `POST /messages/count_tokens`
- Conversion of Anthropic message format into the worker's internal OpenAI-compatible request
- Text messages, `tool_use` / `tool_result`, `tool_choice`
- Non-streaming responses and Anthropic SSE streaming
- Anthropic-style error responses

> ⚠️ **Testing caveat**: the maintainer has no real Anthropic client environment, so end-to-end testing against actual Anthropic clients has not been done. The conversion logic is covered by local stubs and regression tests, but that does not mean every Anthropic SDK, tool-call combination and client behaviour has been exercised.
>
> If you have a real Anthropic Messages API use case, feel free to test it as long as it does not disturb the OpenAI path, and report back request shape, streaming behaviour, tool-call or model compatibility issues. Please attach redacted request structures, status codes and error messages.

> The Anthropic API is an additional protocol adapter: it does not change the existing OpenAI `/v1/chat/completions` and `/v1/responses` paths, account rotation, session lifecycle or the main Freebuff call chain.

## Freebucks quota model

Freebuff's free tier is metered in **Freebucks** — a **daily wallet charged per call**, **not** a "N calls per model per day" allowlist. So a 429 after switching models usually means **the new model is more expensive and the wallet cannot cover it**, not that you were blocked.

> 📌 The data in this section was measured on **2026-09-22** (upstream `GET /session` snapshot + official `freebucks-pricing.ts` / `freebuff-spend-ceilings.ts`). Official rules change — **always trust the live `prices` shown by the "Query quota" button in the panel**.

### What is charged: session creation, not chat turns

Charging happens on `POST /api/v1/freebuff/session`:

- A session is valid for **1 hour**; reusing it during that window is **free** (the worker reuses any cached session with >60s left)
- So the real shape is "**N session slots per day**", not "N chat turns"
- `DELETE session` triggers an **asynchronous refund** (`freebucksRefundPending: true`, balance recovers a moment later); a **forged `instanceId` gets no refund** (`freebucksRefund: 0`)

### Price table (`freebucks.prices`, measured)

| Model | Unit price | Calls at a 40/day cap |
|---|---|---|
| `z-ai/glm-5.3-flash` | 5 | **8** |
| `crof/kimi-k3-eco` | 5 | **8** |
| `mimo/mimo-v2.5` | 10 | **4** |
| `upstage/solar-pro4` | 10 | **4** |
| `deepseek/deepseek-v4-flash` | 15 (10 off-peak) | **2** (off-peak **4**) |
| `deepseek/deepseek-v4-flash-max` | 15 | **2** |
| `deepseek/deepseek-v4-pro-max` | 20 | **2** |
| `openai/gpt-5.6-luna` | 20 | **2** |
| `mimo/mimo-v2.6-pro` | 30 | **1** |
| `google/gemini-3.8-flash` | 80 | **0 — not even one call per day** |

- **Off-peak** (`freebucks.offPeak`) discounts some models: `deepseek-v4-flash` drops 15 → **10** during **06:00–14:00 Beijing time**
- `deepseek-v4.1-flash` / `v4.1-pro` **can create sessions (200 active measured)** but have **no entry in the price table** yet, so the unit price is unknown — check `prices` with the quota button
- `deepseek/deepseek-v4-pro` returns `409 model_unavailable`; it has been retired upstream
- `freebucks.priceNotices` carries price-change notices, rendered in the panel as `⚠ model: message`

### Two limits coexist: trust the snapshot's `daily.limit`

The upstream reports **two different numbers** — do not mix them up:

| Source | Number (varies) | Meaning |
|---|---|---|
| **429 body** `limit` | 40 / 25 … | That day's throttle — `recentCount ≥ limit` returns 429 |
| **GET snapshot** `daily.limit` | 100 / 25 … | Wallet daily allowance (`spent` is measured against it) |

**Never derive your balance from the 429 limit minus `recentCount`** — only trust the snapshot's `daily.remaining` and `balance`.

### accessTier and "a new account only gets 25"

The quota is **tiered per account**; different `accessTier` means a different daily ceiling:

| accessTier | Daily ceiling (`daily.limit`) | Notes |
|---|---|---|
| `full` | 100 measured (429 throttle 40) | Measured on an older account before 2026-09-22; the official cap can change at any time |
| `limited` | **25** | **Default for newly registered accounts** — a fresh account really only has 25/day, it is not a bug |

Measured on 2026-09-23: a new account is `accessTier: "limited"` with `daily.limit: 25`; at 5 points per glm-5.3-flash call that is roughly 5 calls a day.

The official `freebuff-countries.ts` shows the tier is also **derived from the account's egress country** (US/CA/GB/AU and ~18 more countries = `full`; everything else, plus any VPN, = `limited`), and account trust can layer on top of that. Older accounts can also be demoted from `full` to `limited`.

### Reset time

`resetAt` is **Pacific-time midnight**, i.e. **15:00 Beijing time the next day** (e.g. `2026-09-23T07:00:00Z` = 2026-09-23 15:00 Beijing).

> 📌 **Anchor trivia (GitHub Markdown)**: when generating anchors for headings containing emoji, GitHub strips only the base emoji code point and keeps the variation selector U+FE0F. Fix anchors against the real `id` in the rendered HTML.

### Where the official cap comes from

The upstream source `freebuff-spend-ceilings.ts` says:

> Capacity is now limited per account — sustained automated abuse forced us to cap how much any one account can use.

`accessTier: "full"` means the account is **not demoted** and merely hit the generic cap.

### Scaling up

1. **Paid tier** — `$8/month` → `150 Freebucks/day` (visible in `wallet`)
2. **Multi-account rotation** — the one-account-one-SOCKS5 architecture **supports this natively**; each account has its own allowance, add them in the panel. **Note a new account defaults to the `limited` tier at 25/day**, so N accounts multiply 25, not 100
3. **Pick cheap models** — prefer `glm-5.3-flash` / `kimi-k3-eco` (unit price 5) and save expensive models for off-peak

### Common misconceptions

| Symptom | Reality |
|---|---|
| 429 after switching models | Not a model allowlist — **that model is just more expensive** than the wallet can cover |
| `HTTP 502: create session failed: 429 ...` | Upstream quota exhausted, wait for `resetAt` |
| `409 model_locked` | Session lock conflict, **not a quota problem** — the worker deletes and recreates automatically (v1.8.11.1) |
| `429` | **Not a ban**, only quota; `account_suspended` is the actual ban (terminal, irreversible) |
| Why does a new account only have 25? | New accounts default to `limited`, 25/day — **not a bug and not an IP issue** |
| Quota drains unusually fast | Repeated diagnostic session creation charges every time — **each POST is a real charge** |

## Quick start

1. Get a freebuff token (see [Get FREEBUFF_TOKEN](#get-freebuff_token))
2. Deploy the service (see [Deployment](#deployment), **Docker recommended**)
3. Open the admin panel at `http://<server-ip>:8877/admin` (initial password `admin`, **forced change on first login**), paste the token into the **account pool** and click **Save accounts**
4. Point any OpenAI client at it:
   - **Base URL**: `http://localhost:8877/v1` (Docker) or `https://<worker>.<subdomain>.workers.dev/v1` (CF, not recommended)
   - **API Key**: the value of "Service variables → API Key" in the panel (defaults to `freebuff-default-key`)

> 🌐 **Custom domain**: if `*.workers.dev` is unreachable in your region, bind your own domain to the Worker and use `https://<your-domain>/v1` as the Base URL. See [Custom domain](#custom-domain).

## Health check

Available after deployment (**no API key needed**):

```bash
curl https://<worker>.<subdomain>.workers.dev/healthz
# {"status":"ok","version":"1.8.11.1","accounts":1,"alive_accounts":1,"account_states":{"ok":1},"health_source":"worker_cache","time":"..."}
```

- `version` is the deployed **worker.js version**, useful to confirm the latest code is live (CF edge caching lags; wait a few seconds or add a random query parameter)
- `status` is `ok` / `degraded` / `critical`; `account_states` counts accounts per state (`ok` / `rate_limited` / `banned` / `model_locked` …)
- ⚠️ **Status only, no quota numbers** — for Freebucks use the "Query quota" button in the panel (see [🛡️ Admin panel](#admin-panel-admin))
- Suitable for UptimeRobot or your own monitoring

## Get FREEBUFF_TOKEN

The freebuff credential (`authToken`) is obtained with the same **auth-code polling** flow the official CLI uses. The repo ships `freebuff_tools/extract_freebuff.py`, which behaves like `cline_oauth.py`.

### Option A: GitHub Actions workflow (recommended, remote)

The repo includes `.github/workflows/extract-token.yml`. Extraction runs inside GitHub Actions; the auth link and the token are sent only to your Telegram, and the logs are masked end to end (`::add-mask::`), so nothing sensitive leaks.

**Step 1 — configure secrets** (Settings → Secrets and variables → Actions):

| Secret | Description |
|---|---|
| `TG_BOT_TOKEN` | Telegram bot token (create one with @BotFather, e.g. `123456:ABC-xxx`) |
| `TG_CHAT_ID` | Your numeric Telegram chat id (message @userinfobot) |

**Step 2 — run the workflow**:

1. Repo page → **Actions** → **Get Freebuff authToken** → **Run workflow**
2. Optionally set `poll_timeout` (seconds to wait for authorisation, default 300) and `fingerprint` (leave blank to auto-generate)
3. You receive a login link on Telegram — open it and sign in with Google
4. Once the script polls the token, the full token is delivered to your Telegram (the Actions log only shows `***`)
5. Old runs are cleaned up automatically, keeping only the latest

> Without `TG_BOT_TOKEN` / `TG_CHAT_ID` configured, the workflow fails on its first step and never starts extraction.

### Option B: extract locally

```bash
cd freebuff_tools
python3 extract_freebuff.py login   # prints the auth URL, polls after you approve in the browser
python3 extract_freebuff.py show    # all accounts: email + token + status, one per line
python3 extract_freebuff.py tgsend  # test Telegram connectivity (when TG is configured)
```

Running `login` locally **appends per key** into `freebuff_tools/freebuff_credentials.json` (existing accounts are never overwritten; Google and GitHub sign-in are both recorded). The file is git-ignored and never committed; see `freebuff_tools/freebuff_credentials.example.json` for the shape.

Other useful commands:

```bash
python3 extract_freebuff.py export           # all account tokens, one per line, ready to paste into CF Workers vars
python3 extract_freebuff.py quota            # check usage
python3 extract_freebuff.py session          # open / inspect a session
python3 extract_freebuff.py chat "hello"     # send one message through the model API
```

> 💡 `show` probes each account with `GET /api/v1/freebuff/session` (**creates no session, costs nothing**) and reports every account at once: alive + quota / invalid token / banned / region-blocked / quota exhausted. For banned accounts the upstream returns `status: banned` on every endpoint. With multiple accounts, each line `export` prints can be pasted into the Cloudflare Worker variable `FREEBUFF_TOKEN` (newline separated).

## Admin panel `/admin`

Accounts, proxies, API key and quota are **all editable in the page, applied on save, no container restart**.

```
http://<server-ip>:8877/admin
```

(The port is the **left** side of `-p host:container` — every example in this repo uses **`8877`**; `8787` is only the container-internal port `server.js` listens on (`PORT` default) and is not exposed on the host.)

### Login and first password change

- **Initial password is the fixed string `admin`** (not randomised). It is also printed in the container log: `docker logs <container> | grep 初始密码`, and written to `credentials/.initial_password`
- **First login forces a change**: the API returns `must_change_password: true` and the page shows "you must change the initial password"; the new password must be **≥ 8 characters** or you cannot enter the panel
- The password is stored in `credentials/admin.json` as `sha256(salt:password)` with a random salt — **never in plaintext**
- Login sessions last **12 hours** (`session_ttl_ms`); 5 consecutive failures lock the panel for 15 minutes
- **Forgot the password**: delete `credentials/admin.json` and restart the container → the initial password is recreated with the forced change. If the account pool is empty, accounts are migrated from the legacy credential file / env (`migrateLegacyAccounts`)

### Card ①: account pool (one independent SOCKS5 egress per account)

Fields per row:

| Field | Description |
|---|---|
| Name | Free-form label (`acct-01`, `home-isp-2`, …) |
| Token (blank = keep current) | The Freebuff `authToken`; **leaving it blank keeps the stored value** |
| SOCKS5 egress | `socks5://user:pass@host:port`; **blank means direct** |
| Enabled | Checkbox; unchecking removes the account from rotation |

Four buttons per row:

| Button | Effect |
|---|---|
| **Test proxy** | Sends a request through that SOCKS5 egress and returns **exit IP + latency** (`✅ exit IP 1.2.3.4 (856ms)`) |
| **Test account** | Calls upstream `GET /api/v1/me`, returning `HTTP <status> <body>` — `account_suspended` shows up immediately |
| **Query quota** | Retrieves that account's Freebucks snapshot (below); **GET, zero cost** |
| **Delete** | Removes the row from the pool (click "Save accounts" to persist) |

Three buttons below the pool: **+ Add account**, **Save accounts** (persist + take effect immediately), **💰 Query all quotas** (per-account, rendered as a table).

### Card ②: service variables

| Variable | Effect |
|---|---|
| API Key (client auth) | The key clients must send to `/v1/chat/completions` |
| CODEBUFF_API (blank = official) | Upstream domain; blank means `https://www.codebuff.com` |
| RELAY_KEY | Relay key (needed when `CODEBUFF_API` points at an authenticated relay) |
| DEBUG | Toggle request-level debug logging |

Click **Save variables** to apply.

### Card ③: service status

Data from `GET /admin/api/status`, returning `version` (worker.js version), `token_pool_size`, `models_count` and `accounts` (name / proxy / enabled / masked token).

### Card ④: change admin password / log out

Current password + new password (≥ 8 characters).

### The quota buttons

- Per-row **Query quota** → `POST /admin/api/quota` (body: `{index, token?, socks5?}`)
- **💰 Query all quotas** → `GET /admin/api/quotas`

Both are **server-side**: they egress through that account's SOCKS5 and call upstream `GET /api/v1/freebuff/session` with `include-unused-rate-limits: 1`, returning:

```
ok / status / access_tier / status_field
balance / wallet_balance / plan_id
daily: { limit, spent, remaining, resetAt }
prices: { model: unit price }
price_notices / off_peak / price_changes
```

When banned it returns `banned: true` plus `error: account_suspended`, and the UI shows `❌ Account banned: …`.

Rendered example:

```
💰 Freebucks 20/100 (spent 80) · resets 2026-09-23 15:00 · tier=full · plan=xxx
Affordable calls: kimi-k3-eco×4 · glm-5.3-flash×4 · mimo-v2.5×2 · deepseek-v4-flash×1 · gpt-5.6-luna×1 · gemini-3.8-flash×0
```

"Affordable calls" is `floor(daily.remaining / prices[model])` — at a glance you see **which models you can still afford today** (expensive ones show ×0).

> ⏱ `resetAt` is **Pacific-time midnight**; `fmtReset()` renders it in the browser's local timezone (UTC+8 = **15:00 the next day**).

### Panel API (scriptable)

Everything lives under `/admin/api/` and is called with the `admin_session=<sid>` cookie after login:

| Path | Method | Description |
|---|---|---|
| `/admin/api/login` | POST | `{password}` → `Set-Cookie` + `must_change_password` |
| `/admin/api/logout` | POST | Destroy the session |
| `/admin/api/accounts` | POST | `{accounts:[...]}` replace the whole pool |
| `/admin/api/settings` | POST | `{settings:{api_key,codebuff_api,relay_key,debug}}` |
| `/admin/api/config` | GET | Read the current config |
| `/admin/api/status` | GET | Service status (version / model count / account table) |
| `/admin/api/test_proxy` | POST | `{socks5}` → exit IP + latency |
| `/admin/api/test_account` | POST | `{index,token,socks5}` → upstream `/me` response |
| `/admin/api/quota` | POST | `{index,token,socks5}` → one account's Freebucks |
| `/admin/api/quotas` | GET | Freebucks for every account |
| `/admin/api/change_password` | POST | `{old_password,new_password}` |

> ⚠️ The panel API shares the port with `/v1/*` but **only accepts the `admin_session` cookie**; `Authorization: Bearer *** works for `/v1/*` only, and the reverse is equally true.

---

## Deployment

### Docker deployment (recommended)

> Ideal for long-running local / NAS / VPS use: no Cloudflare Workers limits and **no CF edge markers** (`cf-worker` / `cf-ray`), so the ban risk is significantly lower than on CF. Images are published on **Docker Hub** — **no clone, no build**, one command to deploy.
>
> Image: `pingmike/freebuff2api:latest` ([Docker Hub page](https://hub.docker.com/r/pingmike/freebuff2api))

---

#### Option 1: one-line `docker run` (fastest)

> 💡 **Accounts do not have to come from environment variables**: once the container is up, open `http://<server-ip>:8877/admin` (initial password `admin`, forced change on first login), paste the token into the **account pool** and click **Save accounts** — **effective immediately, no restart**. The `freebuff_credentials.json` mount below is the legacy path and is only auto-migrated **when the panel account pool is empty**.
> Note: `-e FREEBUFF_API_KEY` is **overridden** by the panel's "service variables" (panel wins — see [Environment variables (real precedence)](#environment-variables-real-precedence)).

```bash
# 1. Prepare freebuff_credentials.json (multi-account aggregate format, see "Get authToken")
# Generate it with: python3 freebuff_tools/extract_freebuff.py login
# Or create it by hand: {"accounts": {"<account-id>": {"email": "...", "authToken": "...", "name": "..."}}}

# 2. Start it (inline the vars, or use a .env file)
docker run -d --name freebuff2api --restart unless-stopped \
  -p 8877:8787 \
  -e PORT=8787 \
  -e HOST=0.0.0.0 \
  -e FREEBUFF_API_KEY=your-api-key \
  -e RELAY_KEY= \
  -v "$(pwd)/freebuff_credentials.json:/app/credentials/freebuff_credentials.json:ro" \
  pingmike/freebuff2api:latest

# 3. Read the initial password and open the panel
docker logs freebuff2api | grep 初始密码
```

With many variables, use a `.env` file instead (`docker run --env-file .env`):

```bash
cat > .env <<'EOF'
PORT=8787
HOST=0.0.0.0
FREEBUFF_API_KEY=your-api-key
RELAY_KEY=
EOF

docker run -d --name freebuff2api --restart unless-stopped \
  -p 8877:8787 \
  --env-file .env \
  -v "$(pwd)/freebuff_credentials.json:/app/credentials/freebuff_credentials.json:ro" \
  pingmike/freebuff2api:latest
```

---

#### Option 2: docker compose (recommended for long-running)

```bash
# 1. One command: create dir → write compose → config .env → start
mkdir -p freebuff2api && cd freebuff2api && \
cat > docker-compose.yml <<'EOF'
services:
  freebuff2api:
    image: pingmike/freebuff2api:latest
    container_name: freebuff2api
    restart: unless-stopped
    ports:
      - "8877:8787"
    environment:
      - PORT=8787
      - HOST=0.0.0.0
      - FREEBUFF_API_KEY=${FREEBUFF_API_KEY}
      - RELAY_KEY=${RELAY_KEY}
    volumes:
      - ./freebuff_credentials.json:/app/credentials/freebuff_credentials.json:ro
EOF
echo 'FREEBUFF_API_KEY=your-api-key' > .env && \
docker compose pull && docker compose up -d
```

> 💡 `${FREEBUFF_API_KEY}` / `${RELAY_KEY}` in the compose file are read automatically from the `.env` next to it.

**Credential file:** drop it in before or after startup, then restart the container:

```bash
chmod 600 freebuff_credentials.json
# freebuff_credentials.json aggregate format: {"accounts": {"<account-id>": {"email": "...", "authToken": "...", "name": "..."}}}
docker compose restart          # or: docker restart freebuff2api
```

---

#### Updating (no rebuild, no re-pull)

The image uses a **container bootstrapper** design (inspired by [fscarmen/Argo-Nezha-Service-Container](https://github.com/fscarmen/Argo-Nezha-Service-Container)): on every start the container pulls the latest `worker.js` from GitHub raw (falling back to the copy baked into the image if the fetch fails). So after pushing a server-side `worker.js` change to GitHub, **restarting the main deployment updates it automatically**; clients only need to pull a new image occasionally:

```bash
docker compose pull && docker compose up -d   # pull new image and recreate
docker compose restart                        # or just restart (auto-pulls latest worker.js)
```

> 💡 **How to confirm what is actually running**: the image tag is decoupled from the code inside the container (the tag only reflects build time; the runtime code is whatever `worker.js` was pulled at startup), so **the image tag is not a version number**. Check the auth-free health endpoint instead:
>
> ```bash
> curl -s http://localhost:8877/healthz
> # the "version" field is the real worker.js version inside the container
> ```
>
> The returned `version` is the truth, regardless of what `docker images` shows. If you worry the container fell back to the bundled copy after a failed fetch, the same command tells you (e.g. image tag 1.7.0 but healthz returns `"version":"1.8.9"` means it auto-updated).

#### Environment variables (real precedence)

> ⚠️ **"Service variables" in the panel override `.env` / `-e`**, `buildEnv()` resolves in this order: **panel account pool > panel variables > `.env` > defaults**; `PORT` / `HOST` come from `.env` only (the panel has no such field).

| Variable | Single source of truth | Description |
|---|---|---|
| `FREEBUFF_TOKEN` | ✅ **panel account pool** | `-e FREEBUFF_TOKEN=...` is absorbed into the panel **only during the first migration** (`migrateLegacyAccounts`); afterwards `buildEnv` reads `getAccounts()` and **env changes have no effect** → manage accounts in the panel |
| `FREEBUFF_API_KEY` | panel first, then `.env`, then `freebuff-default-key` | **The client-facing key comes from the panel's `settings.api_key`** |
| `CODEBUFF_API` | panel first, then `.env` | Upstream URL, default empty = `https://www.codebuff.com` |
| `RELAY_KEY` | panel first, then `.env` | Relay key (required when `CODEBUFF_API` points at an authenticated relay) |
| `FREEBUFF_DEBUG` | ✅ **panel** `settings.debug` | The env is read only when `admin.json` is **first created**; afterwards it is ignored → change it in the panel |
| `PORT` / `HOST` | ✅ `.env` | Listen port / address, default `8787` / `0.0.0.0` |
| `FREEBUFF_SESSIONS_JSON` / `WEB_CREDENTIALS_FILE` | `.env` | Web-cookie auth channel |
| `RELAY_URL` / `RELAY_METHOD` / `RELAY_HEADERS` / `RELAY_BODY` | `.env` | Relay egress, triggered by `API_READY` |

**To make a panel variable fall back to `.env`** → clear that field in the panel and save; `buildEnv` falls back to the env value.

> ⚠️ Credentials accept two shapes: the multi-account aggregate `{"accounts": {...}}` (what the extractor writes) and the single-account top-level `authToken`. A legacy `freebuff_credentials.json` is auto-migrated **when the panel account pool is empty**; after migration the panel wins.

#### Maintainers: publish a new image to Docker Hub

The repo ships `.github/workflows/docker-publish.yml` (manual trigger, multi-arch amd64/arm64). Configure `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` under GitHub Secrets, then run **Run workflow** on the Actions page.

### Cloudflare Worker deployment (not recommended)

> **Freebuff now detects Cloudflare Worker deployments** (fingerprinting `cf-worker` / `cf-ray` edge markers, and naming proxy patterns like this project in its source). Deploying on CF significantly increases ban risk, **so it is not recommended as a primary deployment**; the steps below are kept only for users who understand the risk.

The worker is a **single file** (`worker.js`). If you still want to deploy on CF:

### Option A: paste the code in the CF console

Simplest and most controllable — no local tooling, no GitHub linkage:

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Create Worker**
2. Name it anything (e.g. `freebuff2api`) and click **Deploy**
3. Open the Worker → **Edit code** → paste the **entire contents** of [worker.js](worker.js) over the default → **Deploy**
4. Go to **Settings → Variables and Secrets → Add**:

   | Type | Name | Value |
   |---|---|---|
   | Secret | `FREEBUFF_TOKEN` | your freebuff token (comma-separated for multiple accounts) |
   | Secret | `FREEBUFF_API_KEY` | custom access key (optional; defaults to `freebuff-default-key`) |

5. Verify after deployment:

   ```bash
   curl https://<worker>.<subdomain>.workers.dev/healthz          # health, no key needed
   curl https://<worker>.<subdomain>.workers.dev/v1/models \
     -H "Authorization: Bearer ***"                               # model list
   ```

> Each code change is just step 3 again: edit → paste → deploy. **GitHub auto-deploy is not recommended** (see below).
> ⚠️ **Versioning convention**: bump the version (the `version` field in healthz + the `X-Freebuff2api-Version` response header) before every deploy, otherwise you cannot tell whether production updated.

### Linking GitHub for auto-deploy (not recommended)

CF can connect a GitHub repo for auto-deploy, but **don't**:

- Every push goes straight to production; unverified local changes can hit live users
- You must configure build command / root directory, and helper files such as `freebuff_tools/` get pulled too
- Secrets and branch state become confusing, and incidents are harder to debug
- This repo contains a token extraction script, so auto-sync increases exposure

**Recommended**: edit locally → deploy with Docker on a VPS, or (if you accept the risk) paste into the CF console and deploy manually — fully under your control.

> Free models historically required a US egress IP; Cloudflare Workers exit from the US by default, so no extra configuration was needed.

### Custom domain

The default `https://<worker>.<subdomain>.workers.dev` may be unreachable in some regions (blocked / restricted). If `workers.dev` times out, bind your own domain:

1. **Add a custom domain**: CF console → your Worker → **Settings → Domains & Routes** → **Add** → **Custom domain**
2. Enter your domain (e.g. `api.example.com`); CF guides you through the DNS record (CNAME to `<worker>.<subdomain>.workers.dev`)
3. Wait for DNS (usually minutes); a free SSL certificate is issued automatically
4. Then use `https://api.example.com/v1` as the Base URL

> Requirement: the domain must be hosted on Cloudflare (or move its DNS to CF). Biding a custom domain just adds a second reachable path for restricted regions.

## Usage examples

```bash
# health check
curl https://<worker>.<subdomain>.workers.dev/healthz

# model list
curl https://<worker>.<subdomain>.workers.dev/v1/models \
  -H "Authorization: Bearer ***"

# non-streaming
curl https://<worker>.<subdomain>.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer ***" -H "Content-Type: application/json" \
  -d '{"model":"deepseek/deepseek-v4-flash","messages":[{"role":"user","content":"hello"}]}'

# streaming
curl -N https://<worker>.<subdomain>.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer ***" -H "Content-Type: application/json" \
  -d '{"model":"deepseek/deepseek-v4-flash","messages":[{"role":"user","content":"hello"}],"stream":true}'
```

## Model list

> Mapping source: Freebuff Desktop 0.0.51 (the official `FREEBUFF_ROOT_AGENT_ID_BY_MODEL` in `orchestrator.js`, synced 2026-08-07).
> The worker reaches upstream through Cloudflare Workers, which egress from the US by default and count as Freebuff full-access mode. **Quota is not a per-model allowlist but a single daily Freebucks wallet** — each model has its own **unit price**, charged when a session is created (see [💰 Freebucks quota model](#freebucks-quota-model)). Live list: `curl /v1/models` (currently 20).

| API model name | Session model | Upstream agentId | Notes |
|---|---|---|---|
| `deepseek/deepseek-v4-flash` | same | `base2-free-deepseek-flash` | primary recommendation |
| `mimo/mimo-v2.5` | same | `base2-free-mimo` | balanced |
| `minimax/minimax-m3` | same | `base2-free-minimax-m3` | - |
| `deepseek/deepseek-v4-pro` | same | `base2-free-deepseek` | - |
| `openai/gpt-5.6-luna` | same | `base2-free-luna` | - |
| `poolside/laguna-s-2.1` | same | `base2-free-laguna-s-2-1` | - |
| `openrouter/poolside/laguna-s-2.1` | same | `base2-free-laguna-s-2-1-openrouter` | - |
| `inclusionai/ling-3.0-flash:free` | same | `base2-free-ling-3-flash` | - |
| `crof/greg-2-ultra` | same | `base2-free-greg-2-ultra` | - |
| `crof/greg-2-super` | same | `base2-free-greg-2-super` | - |
| `meta/muse-spark-1.2-contributor` | same | `base2-free-muse-spark` | - |
| `z-ai/glm-5.2` | same | `base2-free-glm` | needs official eligibility (referral / streak) and uses a separate quota pool |
| `anthropic/claude-fable-5` | same | `base2-free-fable` | official capacity-limited trial, may only be open at certain hours |

> 📝 Measured notes (2026-08-08): `ling-3.0-flash:free` may return 404 upstream asking you to switch to a paid slug; `claude-fable-5` session creation may be rejected for free accounts (`session_model_mismatch`). These are upstream availability issues, not broken worker mappings.

## Multiple accounts

**Add accounts in the panel**: one row per account (name + token + its own SOCKS5 egress), click **Save accounts** to apply. On quota exhaustion (429 / empty response) the current account cools down and the next one takes over; each account has an **independent** allowance, so Freebucks wallets stack.

(The legacy comma-separated `FREEBUFF_TOKEN` env var is only absorbed into the panel during the **first migration**; afterwards the panel pool is authoritative.)

**Account selection strategy** (since v1.4.0):

1. Prefer an account with a **cached, still-active session** — a session lasts about an hour, and only creation costs quota;
2. Only rotate to the next account when no active cache exists.

This maximises Freebucks utilisation (see [💰 Freebucks quota model](#freebucks-quota-model)).

> Note: cooldown state lives in worker memory, resets on cold start and is not shared between concurrent instances. In everyday use this barely matters.

## Upstream gating

freebuff's free models cannot be called with a bare "token → chat" flow; they have a strict lifecycle:

```
session (open) → agent-runs (main + context-pruner child run) → chat/completions
```

- **session**: `POST /api/v1/freebuff/session` (with `x-freebuff-model`) returns an `instanceId`; it may queue.
- **agent-runs**: `START` the main agent (e.g. `base2-free-deepseek-flash`) plus a `context-pruner` child run, then `record_step` / `finish_run`. Chat validates that the run_id exists; without it you get a 4xx.
- **chat**: `POST /api/v1/chat/completions` with `codebuff_metadata.run_id`, `x-freebuff-instance-id`, the SDK user agent, `stop:['"cb_easp"']` and `provider.data_collection=deny`. **Upstream forces streaming**, so non-streaming requests are aggregated (timeout relaxed to 45s).

The worker handles the whole lifecycle automatically. Also: the system message must start with `You are Buffy, the strategic coding assistant.` (byte-level upstream validation) — the worker injects it for you.

### One account, one session (important)

A Freebuff account can only have **one client online at a time**. Therefore:

- ❌ Never probe quota/status via upstream `GET /api/v1/freebuff/session` inside `/v1/models` — that call occupies the session and kicks out an in-flight chat (428 `waiting_room_required`).
- ✅ `/v1/models` returns a **static list** (no upstream call).
- Upstream requests run through a **serial queue with a 300 ms gap** to avoid concurrency problems.

## Experience notes

Tested and working well:

1. **🌍 Direct US IP**: free models historically required a US egress; non-US IPs may fail. Cloudflare Workers exit from the US by default; local clients should use a US proxy.
2. **🤖 Hermes Agent (US VPS)**: run Hermes Agent on a US VPS.
3. **Local browser + page-assist extension**: works smoothly with [page-assist](https://github.com/n4ze3m/page-assist). Give it a try.

## Thanks

Thanks to the following contributors (in no particular order):

- [@yjzsg](https://github.com/yjzsg)
- [@zipei-a](https://github.com/zipei-a)
- [@hknerdr](https://github.com/hknerdr)

## Reference projects

This project learned from and references the following open-source projects:

- [freebuff2api](https://github.com/XxxXTeam/freebuff2api) — the original reverse-engineering of the freebuff desktop/API protocol (AGPL-3.0). This project is a derivative with further development and optimisation, and keeps the AGPL-3.0 licence.
- [freebuff](https://github.com/CodebuffAI/freebuff) — freebuff's official public source, studied for its protocol implementation and changelog.
- [Argo-Nezha-Service-Container](https://github.com/fscarmen/Argo-Nezha-Service-Container) — the **container bootstrapper** pattern (the Dockerfile only bootstraps; business logic is driven by remote scripts/code). This project's Docker deployment borrows that design for "edit code = update, restart = apply" lightweight management.

## Sponsors

This project is supported by the following providers:

| Sponsor | Support |
|---|---|
| [ForZTN](https://sponsorship.forztn.com/github.com/pingmike2/freebuff2api-wokers) | Free VPS and network resources |

> Sponsorship does not influence feature design, implementation or protocol adaptation, and is not an endorsement of the third-party service. Thanks for supporting open source.

## Disclaimer

This project is for **technical exchange and learning/research only**.

- It proxies freebuff by reverse-engineering the desktop/API protocol, which **violates freebuff's terms of service (ToS)**.
- Using it carries the **risk of an account ban**, and bans are terminal and unrecoverable; proceed at your own risk.
- Do not use it commercially or for large-scale abuse; respect the freebuff operators.
- Users are responsible for complying with their local laws and freebuff's terms; the author is not liable for any account loss or dispute.

## License

Licensed under the [AGPL-3.0 License](LICENSE). This project references and reworks parts of [freebuff2api](https://github.com/XxxXTeam/freebuff2api) (itself AGPL-3.0), so it is released under AGPL-3.0 as well; keep the original copyright notices. Free to use, modify and share.
