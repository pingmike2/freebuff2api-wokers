const CODEBUFF_API = "https://www.codebuff.com";
const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";
const DEFAULT_API_KEY = "freebuff-default-key";
const VERSION = "1.8.0";
const CONTEXT_PRUNER_AGENT = "context-pruner";

// Model mapping: session model, upstream agent id, and upstream chat model.
const MODELS = [
  { id: "deepseek/deepseek-v4-flash", session: "deepseek/deepseek-v4-flash", agent: "base2-free-deepseek-flash", upstream: "deepseek/deepseek-v4-flash" },
  { id: "deepseek/deepseek-v4-pro",   session: "deepseek/deepseek-v4-pro",   agent: "base2-free-deepseek",     upstream: "deepseek/deepseek-v4-pro" },
  { id: "minimax/minimax-m3",         session: "minimax/minimax-m3",         agent: "base2-free-minimax-m3",   upstream: "minimax/minimax-m3" },
  { id: "mimo/mimo-v2.5",             session: "mimo/mimo-v2.5",             agent: "base2-free-mimo",         upstream: "mimo/mimo-v2.5" },
  { id: "openai/gpt-5.6-luna",        session: "openai/gpt-5.6-luna",        agent: "base2-free-luna",         upstream: "openai/gpt-5.6-luna" },
  { id: "z-ai/glm-5.2",               session: "z-ai/glm-5.2",               agent: "base2-free-glm",          upstream: "z-ai/glm-5.2" },
  { id: "poolside/laguna-s-2.1",      session: "poolside/laguna-s-2.1",      agent: "base2-free-laguna-s-2-1", upstream: "poolside/laguna-s-2.1" },
  { id: "openrouter/poolside/laguna-s-2.1", session: "openrouter/poolside/laguna-s-2.1", agent: "base2-free-laguna-s-2-1-openrouter", upstream: "openrouter/poolside/laguna-s-2.1" },
  { id: "inclusionai/ling-3.0-flash:free",  session: "inclusionai/ling-3.0-flash:free",  agent: "base2-free-ling-3-flash", upstream: "inclusionai/ling-3.0-flash:free" },
  { id: "crof/greg-2-ultra",          session: "crof/greg-2-ultra",          agent: "base2-free-greg-2-ultra", upstream: "crof/greg-2-ultra" },
  { id: "crof/greg-2-super",          session: "crof/greg-2-super",          agent: "base2-free-greg-2-super", upstream: "crof/greg-2-super" },
  { id: "anthropic/claude-fable-5",   session: "anthropic/claude-fable-5",   agent: "base2-free-fable",        upstream: "anthropic/claude-fable-5" },
  { id: "meta/muse-spark-1.2-contributor", session: "meta/muse-spark-1.2-contributor", agent: "base2-free-muse-spark", upstream: "meta/muse-spark-1.2-contributor" },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

    // healthz is public so monitoring does not need an API key.
    if (request.method === "GET" && url.pathname === "/healthz") {
      const acctCount = parseAccounts(env).length;
      // Probe all accounts without creating a chat session.
      const probes = await probeAllAccounts(env);
      const aliveCount = probes.filter((p) => p.alive === true).length;
      const unknownCount = probes.filter((p) => p.alive === null).length;
      return jsonResponse({
        status: "ok",
        version: VERSION,
        accounts: acctCount,
        alive_accounts: aliveCount,
        unknown_accounts: unknownCount,
        account_details: probes.map((p) => ({
          token: p.token.slice(0, 8) + "...",
          alive: p.alive,
          uid: p.uid ? p.uid.slice(0, 8) + "..." : null,
        })),
        time: new Date().toISOString(),
      }, 200);
    }

    // The HTML panel is public. Its data requests authenticate with the key
    // entered by the user, so the key is not embedded in HTML or the URL.
    if (request.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
      return adminPageResponse();
    }

    // Landing page and console metadata are public; they contain no secrets.
    if (request.method === "GET" && url.pathname === "/") return landingPage();
    if (request.method === "GET" && url.pathname === "/admin/status") return jsonResponse(adminStatus(env), 200);
    if (request.method === "GET" && url.pathname === "/admin/models") return jsonResponse(await adminModels(env), 200, { "X-Freebuff2api-Version": VERSION });

    const key = getApiKey(request, env);
    if (!key) return jsonResponse({ error: { message: "Invalid API key", type: "auth_error" } }, 401);

    cleanCache();

    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      return handleModels(env);
    }
    if (request.method === "POST" && url.pathname === "/admin/models/toggle") {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleModelToggle(request, env);
    }
    if (request.method === "GET" && (url.pathname === "/v1/admin/accounts" || url.pathname === "/admin/accounts")) {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleAdminAccounts(env, url.searchParams.get("refresh") === "1");
    }
    if (request.method === "GET" && (url.pathname === "/v1/admin/usage" || url.pathname === "/admin/usage")) {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleAdminUsage(env);
    }
    if (request.method === "POST" && (url.pathname === "/v1/chat/completions" || url.pathname === "/chat/completions")) {
      return handleChat(request, env, key);
    }
    if (request.method === "POST" && (url.pathname === "/v1/responses" || url.pathname === "/responses")) {
      return handleResponses(request, env, key);
    }
    if (request.method === "POST" && (url.pathname === "/v1/messages" || url.pathname === "/messages")) {
      return handleMessages(request, env, key);
    }
    return jsonResponse({ error: { message: "Not found", type: "not_found" } }, 404);
  },
};

// ---------------------------------------------------------------------------
//
// ---------------------------------------------------------------------------

let accountIdx = 0;
const usageStats = {
  started: Date.now(), requests: 0, successes: 0, errors: 0, inputChars: 0, outputChars: 0,
  byModel: new Map(), byKey: new Map(), byDay: new Map(), byDayModel: new Map(),
};
const cooldowns = new Map();      // token ->  ms
const sessCache = new Map();      // `${token}:${sessionModel}` -> { instanceId, model, remainingMs, expiresAt }（ token，）

function parseAccounts(env) {
  // （）； token  "token:uid"（ user_id）
  // ："t1\nt2:u2\nt3,u4:u4" → [{token:t1,uid:null},{token:t2,uid:u2},...]
  return (env.FREEBUFF_TOKEN || "").split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .map((s) => {
      const idx = s.indexOf(":");
      if (idx > 0) return { token: s.slice(0, idx).trim(), uid: s.slice(idx + 1).trim() || null };
      return { token: s, uid: null };
    })
    .filter((a) => a.token.length > 8);
}

// ---------------------------------------------------------------------------
// （v1.6.0）：GET /api/v1/me  session/， token  uid
// ---------------------------------------------------------------------------

const acctHealth = new Map(); // token -> { alive, uid, checkedAt }
const PROBE_TTL_MS = 10 * 60 * 1000; //  10 ，

/**
 * ：GET /api/v1/me（0 ， session）
 * - 200 → { alive: true, uid: data.id }（uid =  id，）
 * - 401 → { alive: false }（token ）
 * - / → （ null ）
 *
 * ：GET /api/v1/freebuff/session  rateLimitsByModel → quota（recentCount/limit），
 *  pickToken （v1.6.2）。GET  session，0 。
 */
async function probeAccount(token) {
  const cached = acctHealth.get(token);
  if (cached && Date.now() - cached.checkedAt < PROBE_TTL_MS) return cached;
  const hist = cached
    ? { lastErrors: cached.lastErrors || [], lastUsedAt: cached.lastUsedAt || null, requests: cached.requests || 0 }
    : { lastErrors: [], lastUsedAt: null, requests: 0 };
  try {
    const r = await enqueueUp("GET", "/api/v1/me", token, undefined, undefined, SESSION_TIMEOUT_MS);
    if (r.status === 200 && r.data && typeof r.data.id === "string") {
      const info = { alive: true, uid: r.data.id, checkedAt: Date.now(), quota: null, ...hist };
      // （0 ，GET  session）
      try {
        const s = await enqueueUp("GET", "/api/v1/freebuff/session", token, undefined, undefined, SESSION_TIMEOUT_MS);
        if (s.status === 200 && s.data && s.data.rateLimitsByModel) {
          info.quota = s.data.rateLimitsByModel; // { model: { recentCount, limit, ... } }
        }
      } catch {}
      acctHealth.set(token, info);
      return info;
    }
    if (r.status === 401 || r.status === 403) {
      const info = { alive: false, uid: null, checkedAt: Date.now(), ...hist };
      acctHealth.set(token, info);
      return info;
    }
    return null; // /：
  } catch {
    return null;
  }
}

/** （healthz ） */
async function probeAllAccounts(env) {
  const pool = parseAccounts(env);
  const results = [];
  for (const acct of pool) {
    const info = await probeAccount(acct.token);
    // NOTE: no checkDeadAlert here — /healthz is public; alerting only fires on
    // authenticated paths (admin accounts probe, chat 401/403) to avoid
    // unauthenticated webhook/Telegram side effects (ABUSE-001).
    results.push({ token: acct.token, alive: info ? info.alive : null, uid: info ? info.uid : null });
  }
  return results;
}

// Admin: hesap bazında ayrıntılı durum + kota (rateLimitsByModel). Kimlik gerektirir (getApiKey sonrası).
// GET /v1/admin/accounts?refresh=1  -> yeni probe zorla
async function handleAdminAccounts(env, forceRefresh) {
  const pool = parseAccounts(env);
  const out = [];
  for (const acct of pool) {
    if (forceRefresh) acctHealth.delete(acct.token);
    const info = await probeAccount(acct.token);
    if (info && info.alive === false) checkDeadAlert(env, acct.token);
    const q = {};
    if (info && info.quota && typeof info.quota === "object") {
      for (const [model, v] of Object.entries(info.quota)) {
        if (v && typeof v === "object") {
          q[model] = {
            used: typeof v.recentCount === "number" ? v.recentCount : typeof v.used === "number" ? v.used : null,
            limit: typeof v.limit === "number" ? v.limit : null,
          };
        }
      }
    }
    out.push({
      token_prefix: acct.token.slice(0, 8),
      alive: info ? info.alive : null,
      uid: info && info.uid ? info.uid.slice(0, 12) : null,
      requests: (info && info.requests) || 0,
      last_used_at: info && info.lastUsedAt ? new Date(info.lastUsedAt).toISOString() : null,
      last_error: info && info.lastErrors && info.lastErrors.length ? info.lastErrors[info.lastErrors.length - 1].message : null,
      last_error_at: info && info.lastErrors && info.lastErrors.length ? info.lastErrors[info.lastErrors.length - 1].time : null,
      last_errors: info && info.lastErrors ? info.lastErrors.slice(-5) : [],
      quota: q,
    });
  }
  return jsonResponse({ accounts: out, version: VERSION, time: new Date().toISOString() }, 200);
}

async function handleAdminUsage(env) {
  await flushDeltas(env);
  const s = await getStore(env);
  const total = {};
  for (const f of FIELD_NAMES) total[f] = (await s.get(["usage", "total", f])) || 0;
  const byModel = {};
  for (const e of await s.list(["usage", "total", "model"])) {
    const id = String(e.key[3]);
    const m = byModel[id] = byModel[id] || { requests: 0, successes: 0, errors: 0, inputChars: 0, outputChars: 0 };
    m[e.key[4]] = (m[e.key[4]] || 0) + e.value;
  }
  const today = todayStr();
  const dayItems = await s.list(["usage", "day"]);
  const byDate = new Map();
  const byDayModel = {};
  for (const e of dayItems) {
    const key = e.key;
    if (key.length === 4 && key[3] !== "model" && key[3] !== "key") {
      const date = String(key[2]);
      let d = byDate.get(date);
      if (!d) { d = { date, requests: 0, successes: 0, errors: 0, inputChars: 0, outputChars: 0 }; byDate.set(date, d); }
      d[key[3]] = (d[key[3]] || 0) + e.value;
    } else if (key.length === 6 && key[3] === "model") {
      const date = String(key[2]), id = String(key[4]);
      const m = byDayModel[date] = byDayModel[date] || {};
      const mm = m[id] = m[id] || { requests: 0, successes: 0, errors: 0 };
      mm[key[5]] = (mm[key[5]] || 0) + e.value;
    }
  }
  let days = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const dd = usageStats.byDay.get(today);
  if (dd) {
    if (days.length && days[0].date === today) {
      for (const f of FIELD_NAMES) days[0][f] = (days[0][f] || 0) + (dd[f] || 0);
    } else {
      const row = { date: today };
      for (const f of FIELD_NAMES) row[f] = dd[f] || 0;
      days.unshift(row);
    }
  }
  for (const [k, v] of usageStats.byDayModel) {
    const idx = k.lastIndexOf("\u0000");
    const date = k.slice(0, idx), id = k.slice(idx + 1);
    const m = byDayModel[date] = byDayModel[date] || {};
    const mm = m[id] = m[id] || { requests: 0, successes: 0, errors: 0 };
    for (const f of ["requests", "successes", "errors"]) mm[f] = (mm[f] || 0) + (v[f] || 0);
  }
  const daySet = new Set(days.map((d) => d.date));
  const byDayModelTrim = {};
  for (const date of Object.keys(byDayModel)) if (daySet.has(date)) byDayModelTrim[date] = byDayModel[date];
  const keys = [];
  for (const k of parseApiKeys(env)) {
    const prefix = keyPrefixOf(k.key);
    const keyId = keyAccountId(k.key);
    const kd = { requests: 0, successes: 0, errors: 0 };
    for (const f of ["requests", "successes", "errors"]) {
      kd[f] = (await s.get(["usage", "day", today, "key", keyId, f])) || 0;
    }
    const d = usageStats.byKey.get(today + "\u0000" + keyId);
    if (d) for (const f of ["requests", "successes", "errors"]) kd[f] += d[f] || 0;
    const kDayMap = new Map();
    for (const e of dayItems) {
      if (e.key.length !== 6 || e.key[3] !== "key" || e.key[4] !== keyId) continue;
      const date = String(e.key[2]);
      let row = kDayMap.get(date);
      if (!row) { row = { date, requests: 0, successes: 0, errors: 0 }; kDayMap.set(date, row); }
      row[e.key[5]] = (row[e.key[5]] || 0) + e.value;
    }
    if (d) {
      let row = kDayMap.get(today);
      if (!row) { row = { date: today, requests: 0, successes: 0, errors: 0 }; kDayMap.set(today, row); }
      for (const f of ["requests", "successes", "errors"]) row[f] += d[f] || 0;
    }
    const keyDays = [...kDayMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
    keys.push({ prefix, limit: k.limit || null, today_requests: kd.requests, today_successes: kd.successes, today_errors: kd.errors, days: keyDays });
  }
  const customKey = (env.API_KEY || env.FREEBUFF_API_KEY || env.FREEBUFF_API_KEYS || "").trim();
  return jsonResponse({
    version: VERSION,
    auth: { mode: customKey ? "custom" : "default", api_key_set: !!customKey },
    started_at: new Date(usageStats.started).toISOString(),
    uptime_seconds: Math.floor((Date.now() - usageStats.started) / 1000),
    requests: total.requests,
    successes: total.successes,
    errors: total.errors,
    input_characters: total.inputChars,
    output_characters: total.outputChars,
    by_model: byModel,
    by_day_model: byDayModelTrim,
    days,
    keys,
    note: "Counters persist in KV across restarts; account quotas come from Freebuff.",
  }, 200);
}

// ---------------------------------------------------------------------------
// Web console: public landing page + admin dashboard (no secrets in HTML/JS).
// The dashboard authenticates with the key typed into the browser page.
// ---------------------------------------------------------------------------

const UI_CSS = `
:root{--bg:#1e1e2e;--bg-alt:#181825;--panel:#313244;--card:#45475a;--border:#585b70;--text:#cdd6f4;--muted:#a6adc8;--accent:#94e2d5;--ok:#a6e3a1;--warn:#f9e2af;--err:#f38ba8;--sel:#b4befe;--r:3px;--mono:'IBM Plex Mono',ui-monospace,'SF Mono','Cascadia Mono',Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 var(--mono);background:var(--bg);color:var(--text)}
a{color:var(--accent);text-decoration:none}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
::selection{background:rgba(148,226,213,.25)}
header{position:sticky;top:0;z-index:10;background:var(--bg-alt);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;line-height:1.2;letter-spacing:.04em}
.brand .dot{display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--warn);margin-right:2px}
.brand .dot.ok{background:var(--ok)}
.brand .dot.err{background:var(--err)}
.brand .prompt{color:var(--accent);font-weight:500}
.brand .cursor{display:inline-block;width:.55em;height:1.1em;margin-left:2px;background:var(--accent);transform:translateY(3px);animation:cursor-blink 1.06s steps(2,start) infinite}
@keyframes cursor-blink{to{visibility:hidden}}
.tag{font-size:12px;color:var(--muted);border:1px solid var(--border);border-radius:var(--r);padding:2px 8px}
.tag.accent{color:var(--accent);border-color:rgba(148,226,213,.4)}
main{max-width:1200px;margin:22px auto;padding:0 18px 60px}
section{background:var(--panel);border:1px solid var(--border);border-radius:var(--r);padding:20px;margin:16px 0}
h1{font-size:18px;margin:0 0 4px;font-weight:700}
h2{font-size:15px;margin:0 0 12px;font-weight:600}
h2::before{content:'# ';color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px}
.card b{font-size:26px;font-weight:600;display:block;line-height:1.15;font-variant-numeric:tabular-nums}
.card span{color:var(--muted);font-size:12px}
.delta{font-size:12px;display:block;margin-top:2px}
.delta.up{color:var(--ok)}
.delta.down{color:var(--err)}
.delta.flat{color:var(--muted)}
.banner{border-radius:var(--r);padding:10px 14px;margin:12px 0;font-size:13px}
.banner.warn{background:rgba(249,226,175,.12);border:1px solid rgba(249,226,175,.4)}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
input,select,textarea,button{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:9px 12px}
input[type=password]{min-width:280px;flex:1}
button{cursor:pointer;background:var(--accent);border-color:var(--accent);color:#1e1e2e;font-weight:600}
button:active{transform:translateY(1px)}
button.ghost{background:transparent;border-color:var(--border);color:var(--text)}
button.small{padding:6px 10px;font-size:12px}
button:disabled{opacity:.5;cursor:not-allowed}
textarea{width:100%;min-height:120px;resize:vertical;font-size:13px}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);font-size:15px;vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
thead th{background:var(--bg-alt)}
tr:last-child td{border-bottom:0}
tbody tr:hover{background:rgba(49,50,68,.5)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
code,pre{font-family:var(--mono)}
code{font-size:13px}
pre{background:var(--bg-alt);border:1px solid var(--border);border-radius:var(--r);padding:12px;overflow:auto;font-size:13px;white-space:pre-wrap;word-break:break-word}
.muted{color:var(--muted);font-size:12px}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 0}
.tabs button{background:transparent;border-color:var(--border);color:var(--muted)}
.tabs button.active{background:var(--card);border-color:var(--accent);color:var(--text);box-shadow:inset 0 -2px 0 var(--accent)}
.panel{display:none}
.panel.active{display:block}
.pill{display:inline-block;padding:2px 9px;border-radius:var(--r);font-size:12px;font-weight:600;border:1px solid var(--border)}
.pill.ok{color:var(--ok);border-color:rgba(166,227,161,.5)}
.pill.bad{color:var(--err);border-color:rgba(243,139,168,.5)}
.pill.warn{color:var(--warn);border-color:rgba(249,226,175,.5)}
.pill.unk{color:var(--muted)}
code.inline{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:1px 6px;font-size:13px}
.healthline{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.spinner{display:inline-block;width:12px;height:12px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.btn{display:inline-block;background:var(--accent);color:#1e1e2e;border-radius:var(--r);padding:9px 14px;font-weight:600}
.qm{overflow-x:auto}
.qm th,.qm td{white-space:nowrap;padding:6px 10px;font-size:13px}
.qcell{display:inline-block;min-width:76px;text-align:right;padding:2px 8px;border:1px solid var(--border);border-radius:var(--r);font-size:12px;font-variant-numeric:tabular-nums}
.qcell.ok{color:var(--ok);border-color:rgba(166,227,161,.35)}
.qcell.warn{color:var(--warn);border-color:rgba(249,226,175,.45)}
.qcell.exh{color:var(--err);border-color:rgba(243,139,168,.5)}
.spark{display:inline-flex;align-items:flex-end;gap:2px;height:22px}
.spark i{display:inline-block;width:4px;background:var(--accent);border-radius:1px}
.spark i.warn{background:var(--warn)}
.spark i.err{background:var(--err)}
#chart rect{transform-origin:50% 100%;animation:bar-grow .45s cubic-bezier(.22,1,.36,1) backwards}
@keyframes bar-grow{from{transform:scaleY(0)}}
@media (prefers-reduced-motion:reduce){.brand .cursor{animation:none}#chart rect{animation:none}button:active{transform:none}}
@media(max-width:640px){input[type=password]{min-width:100%}}
`;function pageShell(title, body, extraHead) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"><style>${UI_CSS}</style>${extraHead || ""}</head><body>${body}</body></html>`;
}

function landingBody() {
  return `
<header>
  <div class="brand"><span class="dot" id="dot"></span><span class="prompt">$</span>freebuff2api<span class="cursor"></span><span class="tag" id="version">console</span></div>
  <div class="tag">Freebuff -&gt; OpenAI / Anthropic format proxy</div>
  <div class="row" style="margin-left:auto"><a class="btn" href="/admin">Open console</a></div>
</header>
<main>
  <section>
    <h1>freebuff2api</h1>
    <p class="muted">Turns the free models behind Freebuff / Codebuff into an OpenAI- and Anthropic-compatible API. Use it with any OpenAI SDK, client or agent.</p>
    <div class="healthline" id="health"><span class="spinner"></span> Checking health...</div>
  </section>
  <section>
    <h2>Endpoints</h2>
    <table>
      <tr><th>Endpoint</th><th>Purpose</th></tr>
      <tr><td><code>/v1/models</code></td><td>List model ids (API key required)</td></tr>
      <tr><td><code>/v1/chat/completions</code></td><td>OpenAI-compatible chat (streaming + non-streaming)</td></tr>
      <tr><td><code>/v1/messages</code></td><td>Anthropic-compatible messages (streaming + non-streaming)</td></tr>
      <tr><td><code>/v1/responses</code></td><td>OpenAI Responses API</td></tr>
      <tr><td><code>/healthz</code></td><td>Health probe, no key required</td></tr>
      <tr><td><code>/admin</code></td><td>Console: usage, accounts, models</td></tr>
    </table>
  </section>
  <section>
    <h2>Quick start</h2>
    <pre id="curl"></pre>
    <p class="muted">Replace <code class="inline">KEY</code> with your FREEBUFF_API_KEY. If the server has no FREEBUFF_API_KEY set, the built-in default key is <code class="inline">freebuff-default-key</code>.</p>
  </section>
</main>
<script>
async function boot(){try{var s=await (await fetch('/admin/status')).json();var h=await (await fetch('/healthz')).json();var dot=document.getElementById('dot');dot.className='dot '+(h.status==='ok'?'ok':'err');var line=document.getElementById('health');line.innerHTML='<b>'+h.status+'</b><span class="muted">'+h.accounts+' accounts, '+h.alive_accounts+' alive</span><span class="muted">v'+s.version+'</span>';document.getElementById('version').textContent='v'+s.version;var k=s.auth&&s.auth.api_key_set?'YOUR_API_KEY':'freebuff-default-key';document.getElementById('curl').textContent='curl '+location.origin+'/v1/chat/completions \\\\\\n -H "Authorization: Bearer '+k+'" \\\\\\n -H "content-type: application/json" \\\\\\n -d \\'{"model":"deepseek/deepseek-v4-flash","messages":[{"role":"user","content":"Hi"}]}\\''}catch(e){document.getElementById('health').textContent='Health check failed: '+e.message;document.getElementById('dot').className='dot err'}}
boot();
</script>`;
}

function landingPage() {
  return new Response(pageShell("freebuff2api console", landingBody()), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() } });
}

function adminBody() {
  return `
<header>
  <div class="brand"><span class="dot" id="dot"></span><span class="prompt">$</span>freebuff2api<span class="cursor"></span><span class="tag" id="version">console</span></div>
  <div class="tag" id="backend">store: ...</div>
  <div class="tag accent" id="alertCfg" style="display:none"></div>
  <div class="row" style="margin-left:auto"><a class="btn" href="/">Home</a><button class="ghost small" onclick="loadAll(true)">Refresh</button></div>
</header>
<main>
<section id="authCard">
  <h2>API key</h2>
  <div class="row">
    <input id="key" type="password" autocomplete="off" placeholder="FREEBUFF_API_KEY (required for usage / accounts)" onkeydown="if(event.key==='Enter')loadAll(true)">
    <button onclick="loadAll(true)">Connect</button>
  </div>
  <div class="banner warn" id="authHint" style="display:none"></div>
  <div id="status" class="muted" style="margin-top:8px"></div>
</section>
<div class="tabs">
  <button id="tab-overview" class="active" onclick="switchTab('overview')">Overview</button>
  <button id="tab-accounts" onclick="switchTab('accounts')">Accounts</button>
  <button id="tab-models" onclick="switchTab('models')">Models</button>
</div>
<section id="panel-overview" class="panel active">
  <h2>Health <span class="muted" id="usageTime"></span></h2>
  <div id="usage" class="grid"></div>
  <h2>Traffic <span class="muted">last 14 days</span>
    <select id="chartModel" onchange="chartSel()" style="width:auto;margin-left:8px"></select>
  </h2>
  <div id="chart"></div>
  <h2>API keys <span class="muted">today + 14d history</span></h2>
  <div id="keys"></div>
  <h2>Per model <button class="ghost small" onclick="exportCsv()" style="margin-left:8px">Download CSV</button></h2>
  <div id="byModel"></div>
  <p class="muted">Counters persist in KV across restarts. Account quotas come from Freebuff.</p>
</section>
<section id="panel-accounts" class="panel">
  <h2>Quota matrix <span class="muted">used / limit per account x model</span> <button class="ghost small" onclick="loadAll(true)" style="margin-left:8px">Re-probe</button></h2>
  <div class="qm" id="quotaMatrix"><p class="muted">Enter the API key and click Connect.</p></div>
  <h2>Account errors <span class="muted">last 5 per account</span></h2>
  <div id="acctErrors"></div>
  <h2>Account detail</h2>
  <div id="accounts" class="muted">Enter the API key and click Connect.</div>
</section>
<section id="panel-models" class="panel">
  <h2>Model catalog <span class="muted">toggle enabled/disabled (persisted in KV)</span></h2>
  <div id="models">Loading...</div>
</section>
</main>
<script>
var KEY='';
var LAST_USAGE=null;
var LAST_DAYS=[];
var LAST_BDM={};
var MODEL_IDS=[];
var STORE_MODELS=null;
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function setStatus(t,kind){var b=$('status');b.textContent=t||'';b.style.color=kind==='ok'?'var(--ok)':kind==='err'?'var(--err)':'inherit'}
function banner(t){var b=$('authHint');b.textContent=t;b.style.display=t?'block':'none'}
function authHeaders(){return{Authorization:'Bearer '+KEY}}
async function get(path){var r=await fetch(path,{headers:authHeaders()});var j;try{j=await r.json()}catch(e){j={}}if(!r.ok){throw Error((j&&j.error&&j.error.message)||('HTTP '+r.status))}return j}
function switchTab(t){['overview','accounts','models'].forEach(function(n){$('panel-'+n).classList.toggle('active',n===t);$('tab-'+n).classList.toggle('active',n===t)});if(t==='models')loadModels()}
function fmtDur(sec){sec=sec||0;var h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);return h>0?(h+'h '+m+'m'):(m+'m '+(sec%60)+'s')}
function fmtPct(n){if(n==null||!isFinite(n))return '0%';return Math.round(n*100)+'%'}
function statusDot(ok){$('dot').className='dot'+(ok?' ok':'')}
function deltaChip(cur,prev){if(cur==null||prev==null||prev<=0)return '<span class="delta flat">-</span>';var d=(cur-prev)/prev;var cls=d>=0?'up':'down';var sign=d>=0?'+':'';return '<span class="delta '+cls+'">'+sign+Math.round(d*100)+'% vs prev day</span>'}
async function boot(){try{var s=await (await fetch('/admin/status')).json();$('version').textContent='v'+s.version;var a=s.auth||{};if(a.api_key_set===false){statusDot(false);banner('Warning: no FREEBUFF_API_KEY is configured on the server, so it only accepts the default key "freebuff-default-key". Set FREEBUFF_API_KEY (or FREEBUFF_API_KEYS) for your own keys.')}else{statusDot(true);banner(a.mode==='default'?'Server uses the default key "freebuff-default-key" (no custom key set).':null)}$('backend').textContent='store: '+(s.store_backend||'?')+(s.last_flush_at?' | flush ok':' | flush none');var ac=$('alertCfg');if(s.alerts){var parts=[];if(s.alerts.webhook)parts.push('webhook');if(s.alerts.telegram)parts.push('telegram');if(parts.length){ac.style.display='';ac.textContent='alerts: '+parts.join('+')}else{ac.style.display='none'}}else{ac.style.display='none'}$('status').textContent=s.accounts+' account(s), '+s.models+' model(s), '+s.key_count+' key(s), up '+fmtDur(s.uptime_seconds)}catch(e){statusDot(false);setStatus('Status probe failed: '+e.message,'err')}}
async function loadAll(refresh){var k=$('key').value.trim();if(!k){setStatus('Enter the API key first','err');return}KEY=k;setStatus('Loading...');try{var u=await get('/admin/usage'),a=await get('/admin/accounts'+(refresh?'?refresh=1':''));LAST_USAGE=u;renderUsage(u);fillChartSelect(u.by_day_model||{});renderChart(u.days||[],u.by_day_model||{});renderKeys(u.keys||[]);renderAccounts(a);renderAcctErrors(a);renderMatrix(a,MODEL_IDS);setStatus('Updated '+new Date().toLocaleTimeString(),'ok')}catch(e){setStatus(e.message,'err');$('accounts').textContent='Could not load accounts.';banner('Auth failed: '+e.message+' - check that the key matches FREEBUFF_API_KEY.')}}
function renderUsage(u){var req=u.requests||0,ok=u.successes||0,err=u.errors||0;var sr=req?(ok/req):0,er=req?(err/req):0;var d=u.days||[];var prev=d.length>1?d[1].requests:null;var cur=d.length?d[0].requests:req;var cards=[['Requests',req,deltaChip(cur,prev)],['Success rate',fmtPct(sr),''],['Error rate',fmtPct(er),''],['Input chars',u.input_characters,''],['Output chars',u.output_characters,''],['Uptime',fmtDur(u.uptime_seconds),'']];$('usage').innerHTML=cards.map(function(x){return '<div class="card"><b>'+esc(x[1])+'</b><span>'+esc(x[0])+'</span>'+x[2]+'</div>'}).join('');var rows=Object.keys(u.by_model||{}).map(function(m){var v=u.by_model[m];return '<tr><td><code>'+esc(m)+'</code></td><td class="num">'+v.requests+'</td><td class="num">'+v.successes+'</td><td class="num">'+v.errors+'</td></tr>'}).join('');$('byModel').innerHTML=rows?'<table><thead><tr><th>Model</th><th class="num">Requests</th><th class="num">OK</th><th class="num">Errors</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="muted">No requests yet.</p>';$('usageTime').textContent='('+u.version+')'}
function fillChartSelect(bdm){var ids=MODEL_IDS.length?MODEL_IDS:Object.keys(bdm||{});var cur=$('chartModel').value;var opts=['<option value="all">all models</option>'].concat(ids.map(function(id){return '<option value="'+esc(id)+'">'+esc(id)+'</option>'}));$('chartModel').innerHTML=opts.join('');$('chartModel').value=(cur&&ids.indexOf(cur)>=0)?cur:'all'}
function renderChart(days,bdm){LAST_DAYS=days;LAST_BDM=bdm;drawChart(days,bdm,$('chartModel').value)}
function drawChart(days,bdm,sel){var el=$('chart');if(!days||!days.length){el.innerHTML='<p class="muted">No daily data yet.</p>';return}var vals=days.map(function(d){if(sel&&sel!=='all'&&bdm&&bdm[d.date]){var m=bdm[d.date][sel];return m?m.requests:0}return d.requests});var max=1;vals.forEach(function(v){if(v>max)max=v});var w=560,h=120,pad=4,bw=Math.max(4,(w-pad*2)/Math.max(vals.length,1)-2);var bars=vals.map(function(v,i){var bh=Math.round((v/max)*(h-24));var x=pad+i*(bw+2);var y=h-20-bh;return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="1" fill="var(--accent)" style="animation-delay:'+(i*25)+'ms"><title>'+days[i].date+': '+v+' requests</title></rect>'}).join('');var labels=days.map(function(d,i){var x=pad+i*(bw+2);return '<text x="'+x+'" y="'+(h-6)+'" font-size="11" fill="var(--muted)">'+d.date.slice(5)+'</text>'}).join('');el.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:auto">'+bars+labels+'</svg>'}
function chartSel(){drawChart(LAST_DAYS||[],LAST_BDM||{},$('chartModel').value)}
function sparkline(days){if(!days||!days.length)return '<span class="muted">-</span>';var max=1;days.forEach(function(d){if(d.requests>max)max=d.requests});var bars=days.slice(0,14).map(function(d){var hh=Math.max(2,Math.round((d.requests/max)*20));var cls=d.errors>0?(d.errors>=d.requests?'err':'warn'):'';return '<i class="'+cls+'" style="height:'+hh+'px" title="'+d.date+': '+d.requests+' req, '+d.errors+' err"></i>'}).join('');return '<span class="spark">'+bars+'</span>'}
function resetTime(){var now=new Date();var next=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));var diff=next-now;var h=Math.floor(diff/3600000),m=Math.floor(diff%3600000/60000);return (h<10?'0'+h:h)+':'+(m<10?'0'+m:m)}
function renderKeys(keys){var el=$('keys');if(!keys||!keys.length){el.innerHTML='<p class="muted">No keys configured.</p>';return}var rt=resetTime();var rows=keys.map(function(k){var lim=k.limit?'daily limit '+k.limit:'unlimited';var res=k.limit?'<span class="muted">resets '+rt+' UTC</span>':'';return '<tr><td><code>'+esc(k.prefix)+'&hellip;</code></td><td>'+esc(lim)+'</td><td class="num">'+k.today_requests+'</td><td class="num">'+k.today_successes+'</td><td class="num">'+k.today_errors+'</td><td>'+sparkline(k.days)+'</td><td>'+res+'</td></tr>'}).join('');el.innerHTML='<table><thead><tr><th>Key</th><th>Limit</th><th class="num">Req today</th><th class="num">OK</th><th class="num">Err</th><th>14d</th><th>Reset</th></tr></thead><tbody>'+rows+'</tbody></table>'}
function renderAccounts(a){var rows=a.accounts.map(function(x){var st=x.alive===true?'<span class="pill ok">alive</span>':x.alive===false?'<span class="pill bad">invalid</span>':'<span class="pill unk">unknown</span>';var lu=x.last_used_at?new Date(x.last_used_at).toLocaleTimeString():'<span class="muted">-</span>';var le=x.last_error?esc(x.last_error)+' <span class="muted">('+((x.last_error_at||'').slice(5,19).replace('T',' '))+')</span>':'<span class="muted">-</span>';return '<tr><td><code>'+esc(x.token_prefix)+'&hellip;</code></td><td>'+st+'</td><td>'+esc(x.uid||'-')+'</td><td class="num">'+(x.requests||0)+'</td><td>'+lu+'</td><td>'+le+'</td></tr>'}).join('');$('accounts').innerHTML='<table><thead><tr><th>Account</th><th>Status</th><th>UID</th><th class="num">Req</th><th>Last used</th><th>Last error</th></tr></thead><tbody>'+rows+'</tbody></table>'}
function qcell(v){if(!v||v.used==null||v.limit==null)return '<span class="qcell">- / -</span>';var ratio=v.limit>0?v.used/v.limit:0;var cls=ratio>=1?'exh':ratio>=0.8?'warn':'ok';return '<span class="qcell '+cls+'" title="'+(v.limit-v.used)+' remaining">'+v.used+' / '+v.limit+'</span>'}
function renderMatrix(a,modelIds){var el=$('quotaMatrix');var accts=a.accounts||[];var models=modelIds&&modelIds.length?modelIds:[];if(!models.length){var seen={};accts.forEach(function(x){Object.keys(x.quota||{}).forEach(function(m){seen[m]=1})});models=Object.keys(seen)}if(!accts.length){el.innerHTML='<p class="muted">No accounts.</p>';return}var head='<thead><tr><th>Account</th>'+models.map(function(m){return '<th title="'+esc(m)+'">'+esc(m.replace(/^.*\\//,''))+'</th>'}).join('')+'</tr></thead>';var body=accts.map(function(x){var q=x.quota||{};return '<tr><td><code>'+esc(x.token_prefix)+'&hellip;</code></td>'+models.map(function(m){return '<td>'+qcell(q[m])+'</td>'}).join('')+'</tr>'}).join('');el.innerHTML='<table>'+head+'<tbody>'+body+'</tbody></table>'}
function renderAcctErrors(a){var el=$('acctErrors');var rows=[];(a.accounts||[]).forEach(function(x){var es=x.last_errors||[];es.forEach(function(e){var st=e.status?'<span class="pill '+(e.status>=500?'bad':e.status>=400?'warn':'ok')+'">'+e.status+'</span>':'<span class="pill unk">?</span>';rows.push('<tr><td><code>'+esc(x.token_prefix)+'&hellip;</code></td><td>'+st+'</td><td>'+esc((e.time||'').slice(5,19).replace('T',' '))+'</td><td>'+esc(e.message||'')+'</td></tr>')})});el.innerHTML=rows.length?'<table><thead><tr><th>Account</th><th>Status</th><th>Time</th><th>Message</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>':'<p class="muted">No recorded errors.</p>'}
async function loadModels(){try{var m=await (await fetch('/admin/models')).json();STORE_MODELS=m.data;MODEL_IDS=m.data.map(function(x){return x.id});renderModels(m.data)}catch(e){$('models').textContent='Models load failed: '+e.message}}
function renderModels(list){$('models').innerHTML='<table><thead><tr><th>API model id</th><th>Upstream agent</th><th>State</th><th></th></tr></thead><tbody>'+list.map(function(x){var pill=x.disabled?'<span class="pill bad">disabled</span>':'<span class="pill ok">enabled</span>';var btn=x.disabled?'<button class="ghost small" onclick="toggleModel(\\''+esc(x.id)+'\\',false)">Enable</button>':'<button class="ghost small" onclick="toggleModel(\\''+esc(x.id)+'\\',true)">Disable</button>';return '<tr><td><code>'+esc(x.id)+'</code></td><td><code>'+esc(x.agent)+'</code></td><td>'+pill+'</td><td>'+btn+'</td></tr>'}).join('')+'</tbody></table>'}
async function toggleModel(id,disabled){try{var r=await fetch('/admin/models/toggle',{method:'POST',headers:Object.assign(authHeaders(),{'content-type':'application/json'}),body:JSON.stringify({model:id,disabled:disabled})});var j=await r.json();if(!r.ok){throw Error((j.error&&j.error.message)||('HTTP '+r.status))}STORE_MODELS=null;MODEL_IDS=(j.data||[]).map(function(x){return x.id});renderModels(j.data||[]);setStatus('Model '+id+' '+(disabled?'disabled':'enabled'),'ok')}catch(e){setStatus(e.message,'err')}}
function csvEscape(s){s=String(s==null?'':s);return s.indexOf('"')>=0||s.indexOf(',')>=0?'"'+s.replace(/"/g,'""')+'"':s}
function exportCsv(){var u=LAST_USAGE;if(!u){setStatus('Load data first','err');return}var lines=['date,requests,successes,errors,input_chars,output_chars'];(u.days||[]).forEach(function(d){lines.push([d.date,d.requests,d.successes,d.errors,d.inputChars||0,d.outputChars||0].join(','))});lines.push('');lines.push('model,requests,successes,errors');Object.keys(u.by_model||{}).forEach(function(m){var v=u.by_model[m];lines.push([csvEscape(m),v.requests,v.successes,v.errors].join(','))});lines.push('');lines.push('key,limit,today_requests');(u.keys||[]).forEach(function(k){lines.push([csvEscape(k.prefix),k.limit||'',k.today_requests].join(','))});var blob=new Blob([lines.join(String.fromCharCode(10))],{type:'text/csv'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='freebuff2api-usage.csv';document.body.appendChild(a);a.click();a.remove();setStatus('CSV downloaded','ok')}
boot();loadModels();
</script>`;
}function adminPageResponse() {
  return new Response(pageShell("freebuff2api console - admin", adminBody()), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() } });
}

function adminStatus(env) {
  const customKey = (env.API_KEY || env.FREEBUFF_API_KEY || env.FREEBUFF_API_KEYS || "").trim();
  const mode = customKey ? "custom" : "default";
  return {
    status: "ok",
    version: VERSION,
    auth: {
      mode,
      api_key_set: !!customKey,
      hint: mode === "default"
        ? 'Server has no FREEBUFF_API_KEY set, so it only accepts the built-in default key "freebuff-default-key". Set FREEBUFF_API_KEY, FREEBUFF_API_KEYS or API_KEY for your own keys.'
        : "Server accepts the configured keys (FREEBUFF_API_KEY / FREEBUFF_API_KEYS). A wrong key returns HTTP 401 Invalid API key.",
    },
    accounts: parseAccounts(env).length,
    models: MODELS.length,
    key_count: parseApiKeys(env).length,
    store_backend: storeBackendLabel,
    last_flush_at: lastFlushAt ? new Date(lastFlushAt).toISOString() : null,
    alerts: {
      webhook: !!(env.FREEBUFF_ALERT_WEBHOOK || "").trim(),
      telegram: !!((env.FREEBUFF_TG_BOT_TOKEN || "").trim() && (env.FREEBUFF_TG_CHAT_ID || "").trim()),
    },
    default_model: defaultModel(env),
    uptime_seconds: Math.floor((Date.now() - usageStats.started) / 1000),
    time: new Date().toISOString(),
  };
}

async function adminModels(env) {
  const disabled = new Set(await disabledModels(env));
  return { object: "list", data: MODELS.map((m) => ({ id: m.id, agent: m.agent, session: m.session, upstream: m.upstream, disabled: disabled.has(m.id) })) };
}

function pickToken(env, sessionModel) {
  const pool = parseAccounts(env);
  if (pool.length === 0) return null;

  // v1.6.0：（alive=false）；/（）
  const alivePool = pool.filter((acct) => {
    const h = acctHealth.get(acct.token);
    return !(h && h.alive === false);
  });
  const usePool = alivePool.length > 0 ? alivePool : pool; // ，（ 429 ）

  // v1.6.2：（，<=0）
  // quota  probeAccount  GET /freebuff/session（rateLimitsByModel，0 ）
  const quotaSorted = [...usePool].sort((a, b) => {
    const ra = remainingQuota(a.token, sessionModel);
    const rb = remainingQuota(b.token, sessionModel);
    if (ra === null && rb === null) return 0;
    if (ra === null) return 1;  // （）
    if (rb === null) return -1;
    return rb - ra;  //
  });
  const withQuota = quotaSorted.filter((a) => {
    const r = remainingQuota(a.token, sessionModel);
    return r !== null && r > 0;
  });
  const finalPool = withQuota.length > 0 ? withQuota : quotaSorted; // （）

  //  session ： session  1 ， session
  // （ v4-pro  6 ）。、 session，
  // 。 session ，。
  if (sessionModel) {
    for (const acct of finalPool) {
      const t = acct.token;
      if (cooldowns.has(t) && cooldowns.get(t) > Date.now()) continue;
      const cached = sessCache.get(t + ":" + sessionModel);
      if (cached && cached.expiresAt && new Date(cached.expiresAt).getTime() > Date.now() + 60000) {
        return acct;
      }
    }
  }

  // （）
  for (let k = 0; k < finalPool.length; k++) {
    const acct = finalPool[accountIdx % finalPool.length];
    accountIdx = (accountIdx + 1) % finalPool.length;
    const t = acct.token;
    if (!cooldowns.has(t) || cooldowns.get(t) <= Date.now()) return acct;
  }
  const oldest = [...cooldowns.entries()].sort((a, b) => a[1] - b[1])[0];
  if (oldest) cooldowns.delete(oldest[0]);
  return pool[0];
}

function cooldown(token, ms) {
  if (ms > 0) cooldowns.set(token, Date.now() + ms);
}

/**
 *  token （limit - recentCount）。
 * -  quota  → null（，）
 * - quota  → （）
 * -  <= 0 → （）
 */
function remainingQuota(token, sessionModel) {
  const h = acctHealth.get(token);
  if (!h || !h.quota) return null;
  let entry = h.quota[sessionModel];
  if (!entry) {
    // （， recentCount ）
    const keys = Object.keys(h.quota);
    if (keys.length === 0) return null;
    entry = h.quota[keys[0]];
  }
  if (!entry || typeof entry.recentCount !== "number" || typeof entry.limit !== "number") return null;
  return entry.limit - entry.recentCount;
}

function parseCooldown(text, status) {
  //  JSON  retryAfterMs（luna  429  {"retryAfterMs": 15506639}）
  const jm = (text || "").match(/"retryAfterMs"\s*:\s*(\d+)/);
  if (jm) {
    const ms = parseInt(jm[1], 10);
    if (ms > 0) return Math.min(ms, 6 * 3600 * 1000);
  }
  const m = (text || "").match(/try again in (?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
  if (m) {
    const ms = (parseInt(m[1]||0,10)*3600 + parseInt(m[2]||0,10)*60 + parseInt(m[3]||0,10)) * 1000;
    if (ms > 0) return Math.min(ms, 6*3600*1000);
  }
  return status === 429 ? 5*60*1000 : 60*1000;
}

// ---------------------------------------------------------------------------
// （， 1 ）
// ---------------------------------------------------------------------------

let chainTail = Promise.resolve();
const CHAIN_GAP_MS = 300; //  >1 ，+；300ms
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function enqueue(fn) {
  const run = chainTail.then(() => sleep(CHAIN_GAP_MS)).then(fn);
  chainTail = run.catch(() => {});
  return run;
}

const UPSTREAM_TIMEOUT_MS = 20000; // ，
const NONSTREAM_TIMEOUT_MS = 45000; // （），
const SESSION_TIMEOUT_MS = 10000;  // session/run

async function up(method, path, token, body, extraHeaders = {}, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const headers = {
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Host": "www.codebuff.com",
    "User-Agent": "Bun/1.3.11",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  Object.assign(headers, extraHeaders);

  const resp = await fetch(CODEBUFF_API + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: resp.status, data, text };
}

function enqueueUp(method, path, token, body, extraHeaders, timeoutMs) {
  return enqueue(() => up(method, path, token, body, extraHeaders, timeoutMs));
}

// ---------------------------------------------------------------------------
// session
// ---------------------------------------------------------------------------

async function createSession(token, sessionModel, forceCreate = false) {
  // 0) （ >60s）， session
  if (!forceCreate) {
    const cached = sessCache.get(token + ":" + sessionModel);
    if (cached && cached.expiresAt && new Date(cached.expiresAt).getTime() > Date.now() + 60000) {
      return cached;
    }
  }
  // 1)  session，（forceCreate ： active session  GET ，
  //     chat  428； POST ）
  if (!forceCreate) {
    const cur = await enqueueUp("GET", "/api/v1/freebuff/session", token, undefined, undefined, SESSION_TIMEOUT_MS);
    if (cur.status === 200 && cur.data?.status === "active" && cur.data?.instanceId) {
      const cm = cur.data.model;
      if (!cm || cm === sessionModel) {
        const s = { model: cm || sessionModel, instanceId: cur.data.instanceId, remainingMs: cur.data.remainingMs, expiresAt: cur.data.expiresAt };
        sessCache.set(token + ":" + sessionModel, s);
        return s;
      }
      await enqueueUp("DELETE", "/api/v1/freebuff/session", token, undefined, undefined, SESSION_TIMEOUT_MS);
      sessCache.clear();
    }
  }

  // ad)  + streak ： CLI ， session  + 。
  //      （ XxxXTeam/freebuff2api codebuff.py _request_ads_and_streak）：
  //       GET /api/v1/freebuff/streak ， streak
  //      （limit = base + referral + streak）。、 5s，。
  try {
    await enqueueUp("POST", "/api/v1/ads", token,
      { provider: "gravity", sessionId: crypto.randomUUID(), surface: "waiting_room",
        device: { os: "windows", timezone: "Asia/Shanghai", locale: "zh-CN" },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
      { "Content-Type": "application/json" }, 5000);
    // streak （v1.6.3）：GET /api/v1/freebuff/streak，0 ，
    await enqueueUp("GET", "/api/v1/freebuff/streak", token, undefined, undefined, 5000);
  } catch {}

  // 2) create（ queue）。⚠️ (2026-08-07)：x-freebuff-multi-session:1  GET
  //    status:none、chat  428 waiting_room_required； header  session
  const r = await enqueueUp("POST", "/api/v1/freebuff/session", token, undefined,
    { "x-freebuff-model": sessionModel, "Content-Type": "application/json" }, SESSION_TIMEOUT_MS);
  if (r.status === 200 && r.data?.status === "active" && r.data?.instanceId) {
    const s = { model: r.data.model || sessionModel, instanceId: r.data.instanceId, remainingMs: r.data.remainingMs, expiresAt: r.data.expiresAt };
    sessCache.set(token + ":" + sessionModel, s);
    return s;
  }
  if (r.status === 200 && r.data?.status === "queued" && r.data?.instanceId) {
    const inst = r.data.instanceId;
    for (let i = 0; i < 8; i++) {
      await sleep(1500);
      const q = await enqueueUp("GET", "/api/v1/freebuff/session", token, undefined, { "x-freebuff-instance-id": inst }, SESSION_TIMEOUT_MS);
      if (q.status === 200 && q.data?.status === "active") {
        const s = { model: q.data.model || sessionModel, instanceId: inst, remainingMs: q.data.remainingMs, expiresAt: q.data.expiresAt };
        sessCache.set(token + ":" + sessionModel, s);
        return s;
      }
    }
    throw new Error("session stayed queued (retry later)");
  }
  if (r.status === 409) throw new Error("session_model_mismatch: " + String(r.data?.message || r.data?.error || ""));
  throw new Error("create session failed: " + r.status + " " + (r.text || "").slice(0, 300));
}

// ---------------------------------------------------------------------------
// agent-runs
// ---------------------------------------------------------------------------

function utcNow() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

async function startRun(token, agentId, ancestors = []) {
  const r = await enqueueUp("POST", "/api/v1/agent-runs", token,
    { action: "START", agentId, ancestorRunIds: ancestors }, undefined, SESSION_TIMEOUT_MS);
  if (r.status !== 200 || !r.data?.runId) throw new Error("start_run failed: " + r.status + " " + (r.text || "").slice(0, 200));
  return r.data.runId;
}

async function recordStep(token, runId, stepNumber, startTime, children = [], messageId = null) {
  await enqueueUp("POST", `/api/v1/agent-runs/${runId}/steps`, token,
    { stepNumber, credits: 0, childRunIds: children, messageId, status: "completed", startTime }, undefined, SESSION_TIMEOUT_MS);
}

async function finishRun(token, runId, totalSteps) {
  await enqueueUp("POST", "/api/v1/agent-runs", token,
    { action: "FINISH", runId, status: "completed", totalSteps, directCredits: 0, totalCredits: 0 }, undefined, SESSION_TIMEOUT_MS);
}

// deepseek ： run + context-pruner  run
// ： START  run（chat  run_id ，recordStep/finishRun ），
//  4s （ 8s）， qwenpaw check_model_connection 5s
const runCache = new Map();   // `${token}:${agentId}` -> { runId, childRunId, ts }
const RUN_CACHE_TTL_MS = 10 * 60 * 1000; //  run_id （），10min

async function startRunChain(token, agentId) {
  const key = token + ":" + agentId;
  const hit = runCache.get(key);
  if (hit && Date.now() - hit.ts < RUN_CACHE_TTL_MS) {
    return { runId: hit.runId, agentId, startedAt: utcNow(), childRunId: hit.childRunId, cached: true };
  }
  const startedAt = utcNow();
  const runId = await startRun(token, agentId);
  const childRunId = await startRun(token, CONTEXT_PRUNER_AGENT, [runId]);
  runCache.set(key, { runId, childRunId, ts: Date.now() });
  return { runId, agentId, startedAt, childRunId, cached: false };
}

// ---------------------------------------------------------------------------
//  payload （ py  build_upstream_payload）
// ---------------------------------------------------------------------------

const UPSTREAM_KEYS = [
  "frequency_penalty", "logit_bias", "logprobs", "max_completion_tokens", "max_tokens",
  "metadata", "modalities", "parallel_tool_calls", "presence_penalty", "reasoning_effort",
  "response_format", "seed", "service_tier", "stop", "store", "stream_options",
  "temperature", "tool_choice", "tools", "top_logprobs", "top_p", "top_k", "user",
];

//  free-mode marker  "You are Buffy, the strategic coding assistant."
// （ hasFreebuffRootSystemPromptOpening ， `[System Override...]`
//  403 free_mode_cli_required）。
const BUFFY = "You are Buffy, the strategic coding assistant.";

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  let hasSystem = false;
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const item = { ...m };
    if (item.role === "developer") item.role = "system";
    if (item.role === "system") {
      hasSystem = true;
      item.cache_control = { type: "ephemeral" };
      //  Buffy （ hasFreebuffRootSystemPromptOpening ）。
      // (content  [{type:'text',text}]，OpenAI SDK )。
      if (typeof item.content === "string") {
        if (!item.content.startsWith(BUFFY)) item.content = BUFFY + item.content;
      } else if (Array.isArray(item.content)) {
        const firstText = item.content.find((c) => c && c.type === "text" && typeof c.text === "string");
        if (firstText && !firstText.text.startsWith(BUFFY)) firstText.text = BUFFY + firstText.text;
      }
    }
    out.push(item);
  }
  if (!hasSystem) out.unshift({ role: "system", content: BUFFY, cache_control: { type: "ephemeral" } });
  return out;
}

function buildUpstreamPayload(params, mc, sess, runId) {
  const payload = {};
  for (const k of UPSTREAM_KEYS) if (params[k] !== undefined && params[k] !== null) payload[k] = params[k];
  payload.model = mc.upstream;
  payload.messages = normalizeMessages(params.messages);
  payload.stream = true;
  if (!payload.stop) payload.stop = ['"cb_easp"'];
  payload.provider = { data_collection: "deny" };
  // v1.6.4：。 detectForeignFreebuffClient 「 tools
  // 」 foreign_toolset， ling-3.0-tiny:free（→429）。
  // （2026-08-09）：tools （end_turn，TOOLS_WHICH_WONT_FORCE_NEXT_STEP
  // ），。end_turn
  // （「」），。
  if (Array.isArray(payload.tools) && payload.tools.length > 0) {
    const hasSignature = payload.tools.some(
      (t) => t && typeof t === "object" && t.function && typeof t.function.name === "string" && t.function.name === "end_turn",
    );
    if (!hasSignature) {
      payload.tools = [
        ...payload.tools,
        { type: "function", function: { name: "end_turn", description: "Signal the end of the current task.", parameters: { type: "object", properties: {} } } },
      ];
    }
  }
  payload.codebuff_metadata = {
    freebuff_instance_id: sess.instanceId,
    trace_session_id: crypto.randomUUID(),
    run_id: runId,
    client_id: "wf-" + Math.random().toString(36).slice(2, 10),
    cost_mode: "free",
  };
  return payload;
}

// ---------------------------------------------------------------------------
// chat
// ---------------------------------------------------------------------------

async function handleChat(request, env, apiKey) {
  let params;
  try { params = await request.json(); } catch { return jsonResponse({ error: { message: "Invalid JSON", type: "parse_error" } }, 400); }
  const isStream = !!params.stream;
  const mc = MODELS.find((m) => m.id === (params.model || defaultModel(env))) || MODELS[0];
  return executeChat(env, params, mc, isStream, "chat", apiKey);
}

// OpenAI Responses API（/v1/responses）： Responses  chat completions
async function handleResponses(request, env, apiKey) {
  let params;
  try { params = await request.json(); } catch { return jsonResponse({ error: { message: "Invalid JSON", type: "parse_error" } }, 400); }
  const isStream = !!params.stream;
  const mc = MODELS.find((m) => m.id === (params.model || defaultModel(env))) || MODELS[0];
  return executeChat(env, responsesToChatParams(params, mc), mc, isStream, "responses", apiKey);
}

// ---------------------------------------------------------------------------
// Anthropic Messages API (/v1/messages) köprüsü: Anthropic <-> OpenAI chat
// Anthropic istek formatını OpenAI chat'e çevirip handleChat hattını yeniden kullanır
// ---------------------------------------------------------------------------

function anthropicModelToOpenAI(m, env) {
  const raw = (m || "").trim();
  if (!raw) return defaultModel(env);
  if (MODELS.some((x) => x.id === raw)) return raw;
  const short = raw.replace(/^anthropic\//, "");
  const full = "anthropic/" + short;
  if (MODELS.some((x) => x.id === full)) return full;
  const hit = MODELS.find((x) => x.id.toLowerCase().endsWith("/" + short.toLowerCase()));
  return hit ? hit.id : defaultModel(env);
}

function anthropicContentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}

function anthropicContentToChat(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text" && typeof part.text === "string") {
      parts.push({ type: "text", text: part.text });
    } else if (part.type === "image" && part.source && typeof part.source === "object") {
      const source = part.source;
      if (source.type === "base64" && source.media_type && source.data) {
        parts.push({ type: "image_url", image_url: { url: `data:${source.media_type};base64,${source.data}` } });
      } else if (source.type === "url" && source.url) {
        parts.push({ type: "image_url", image_url: { url: source.url } });
      }
    }
  }
  return parts;
}

function anthropicToChatParams(body, mc) {
  const chat = { model: mc.id, stream: !!body.stream, messages: [] };
  let sysText = typeof body.system === "string" ? body.system : "";
  if (Array.isArray(body.system)) {
    sysText = body.system
      .filter((s) => s && s.type === "text" && typeof s.text === "string")
      .map((s) => s.text)
      .join("\n");
  }
  if (sysText) chat.messages.push({ role: "system", content: sysText });
  if (body.max_tokens !== undefined && body.max_tokens !== null) chat.max_completion_tokens = body.max_tokens;
  for (const k of ["temperature", "top_p", "top_k", "presence_penalty", "frequency_penalty"]) {
    if (body[k] !== undefined && body[k] !== null) chat[k] = body[k];
  }
  if (Array.isArray(body.stop_sequences) && body.stop_sequences.length) chat.stop = body.stop_sequences;
  if (body.thinking && typeof body.thinking === "object") {
    if (body.thinking.type === "enabled" && Number.isFinite(body.thinking.budget_tokens)) {
      chat.reasoning_effort = body.thinking.budget_tokens >= 16000 ? "high" : body.thinking.budget_tokens >= 8000 ? "medium" : "low";
    }
  }
  if (body.metadata && typeof body.metadata === "object") chat.metadata = body.metadata;

  if (Array.isArray(body.tools) && body.tools.length) {
    chat.tools = body.tools
      .filter((t) => t && typeof t === "object" && t.name)
      .map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description || "",
          parameters: t.input_schema || { type: "object", properties: {} },
        },
      }));
    const tc = body.tool_choice;
    if (tc) {
      if (tc.type === "auto" || tc.type === "any") chat.tool_choice = "auto";
      else if (tc.type === "none") chat.tool_choice = "none";
      else if (tc.type === "tool" && tc.name) chat.tool_choice = { type: "function", function: { name: tc.name } };
    }
  }

  for (const m of body.messages || []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "user") {
      const hasToolResult = Array.isArray(m.content) && m.content.some((c) => c && c.type === "tool_result");
      if (hasToolResult) {
        for (const part of m.content) {
          if (!part || typeof part !== "object") continue;
          if (part.type === "tool_result") {
            chat.messages.push({ role: "tool", tool_call_id: part.tool_use_id || "", content: anthropicContentToChat(part.content) });
          } else if (part.type === "text" && part.text) {
            chat.messages.push({ role: "user", content: part.text });
          }
        }
      } else {
        chat.messages.push({ role: "user", content: anthropicContentToChat(m.content) });
      }
    } else if (m.role === "assistant") {
      const toolUses = Array.isArray(m.content) ? m.content.filter((c) => c && c.type === "tool_use") : [];
      if (toolUses.length) {
        chat.messages.push({
          role: "assistant",
          content: anthropicContentToText(m.content),
          tool_calls: toolUses.map((tc) => ({
            id: tc.id || ("call_" + Math.random().toString(36).slice(2, 10)),
            type: "function",
            function: { name: tc.name || "", arguments: JSON.stringify(tc.input ?? {}) },
          })),
        });
      } else {
        chat.messages.push({ role: "assistant", content: anthropicContentToText(m.content) });
      }
    }
  }
  return chat;
}

function anthropicStopReason(fr) {
  if (fr === "tool_calls") return "tool_use";
  if (fr === "length") return "max_tokens";
  return "end_turn";
}

function anthropicFromOpenAI(oai, mc) {
  const choice = (oai.choices || [])[0] || {};
  const msg = choice.message || {};
  const content = [];
  if (msg.content) content.push({ type: "text", text: msg.content });
  for (const tc of msg.tool_calls || []) {
    let input = {};
    try {
      input = JSON.parse(tc.function?.arguments || "{}");
    } catch {
      input = {};
    }
    content.push({
      type: "tool_use",
      id: tc.id || ("toolu_" + Math.random().toString(36).slice(2, 10)),
      name: tc.function?.name || "",
      input,
    });
  }
  if (!content.length) content.push({ type: "text", text: "" });
  const u = oai.usage || {};
  return {
    id: oai.id || ("msg_" + Math.random().toString(36).slice(2, 10)),
    type: "message",
    role: "assistant",
    model: mc.id,
    content,
    stop_reason: anthropicStopReason(choice.finish_reason),
    stop_sequence: null,
    usage: { input_tokens: u.prompt_tokens ?? 0, output_tokens: u.completion_tokens ?? 0 },
  };
}

// OpenAI chat SSE akışını Anthropic Messages SSE olaylarına çevirir
function openAIStreamToAnthropic(mc, includeThinking) {
  const decoder = new TextDecoder();
  let buf = "";
  let started = false;
  let ended = false;
  let blockIndex = -1;
  let openBlock = null; // { index, kind: "thinking" | "text" }
  const toolsOpen = new Map(); // OpenAI tool index -> Anthropic block index

  function evt(ctl, event, dataObj) {
    // Anthropic spec: data içinde "type" alanı event adıyla aynı olmalı (sub2api ile birebir)
    if (dataObj && typeof dataObj === "object" && !dataObj.type) dataObj.type = event;
    ctl.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(dataObj)}\n\n`));
  }
  function closeOpen(ctl) {
    if (openBlock) {
      evt(ctl, "content_block_stop", { index: openBlock.index });
      openBlock = null;
    }
  }
  function end(ctl) {
    if (ended) return;
    ended = true;
    for (const [, bi] of toolsOpen) evt(ctl, "content_block_stop", { index: bi });
    toolsOpen.clear();
    closeOpen(ctl);
    evt(ctl, "message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 0 } });
    evt(ctl, "message_stop", {});
  }
  return new TransformStream({
    transform(chunk, ctl) {
      if (ended) return;
      buf += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") {
          end(ctl);
          break;
        }
        let obj;
        try {
          obj = JSON.parse(payload);
        } catch {
          continue;
        }
        const ch = obj.choices && obj.choices[0];
        if (!ch) continue;
        const d = ch.delta || {};
        if (!started) {
          started = true;
          evt(ctl, "message_start", {
            message: {
              id: "msg_" + Math.random().toString(36).slice(2, 12),
              type: "message",
              role: "assistant",
              model: mc.id,
              content: [],
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: (obj.usage && obj.usage.prompt_tokens) || 0, output_tokens: 0 },
            },
          });
        }
        if (d.tool_calls) {
          if (openBlock) closeOpen(ctl);
          for (const tc of d.tool_calls) {
            if (!tc || typeof tc !== "object") continue;
            const oi = tc.index ?? 0;
            if (!toolsOpen.has(oi)) {
              const bi = ++blockIndex;
              toolsOpen.set(oi, bi);
              const fn = tc.function || {};
              const tid = tc.id || ("toolu_" + Math.random().toString(36).slice(2, 10));
              evt(ctl, "content_block_start", { index: bi, content_block: { type: "tool_use", id: tid, name: fn.name || "", input: {} } });
            }
            const fn = tc.function || {};
            if (fn.arguments) evt(ctl, "content_block_delta", { index: toolsOpen.get(oi), delta: { type: "input_json_delta", partial_json: fn.arguments } });
          }
        } else {
          const reasoning = d.reasoning_content || "";
          const content = d.content || "";
          if (reasoning && includeThinking) {
            if (!openBlock || openBlock.kind !== "thinking") {
              closeOpen(ctl);
              const bi = ++blockIndex;
              openBlock = { index: bi, kind: "thinking" };
              evt(ctl, "content_block_start", { index: bi, content_block: { type: "thinking", thinking: "", signature: "" } });
            }
            evt(ctl, "content_block_delta", { index: openBlock.index, delta: { type: "thinking_delta", thinking: reasoning } });
          }
          if (content) {
            if (!openBlock || openBlock.kind !== "text") {
              closeOpen(ctl);
              const bi = ++blockIndex;
              openBlock = { index: bi, kind: "text" };
              evt(ctl, "content_block_start", { index: bi, content_block: { type: "text", text: "" } });
            }
            evt(ctl, "content_block_delta", { index: openBlock.index, delta: { type: "text_delta", text: content } });
          }
        }
        if (ch.finish_reason) {
          end(ctl);
          break;
        }
      }
    },
    flush(ctl) {
      end(ctl);
    },
  });
}

// Anthropic formatında hata gövdesi: {"type":"error","error":{"type","message"}}
function anthropicError(message, type) {
  return jsonResponse({ type: "error", error: { type: type || "api_error", message } }, type === "invalid_request_error" ? 400 : 500);
}

// Anthropic /v1/messages girişi: dönüştür → handleChat → geri çevir
async function handleMessages(request, env, apiKey) {
  let body;
  try {
    body = await request.json();
  } catch {
    return anthropicError("Invalid JSON", "invalid_request_error");
  }
  const mc = MODELS.find((m) => m.id === anthropicModelToOpenAI(body.model, env)) || MODELS[0];
  const chatParams = anthropicToChatParams(body, mc);
  const includeThinking = !!body.thinking || /thinking/i.test(request.headers.get("anthropic-beta") || "");
  // CPU optimizasyonu: fakeReq + JSON.stringify/parse yerine executeChat'i dogrudan cagir
  const resp = await executeChat(env, chatParams, mc, !!chatParams.stream, "chat", apiKey);
  if (resp.status >= 400) {
    let msg = "Upstream error", typ = "api_error";
    try {
      const j = await resp.json();
      if (j && j.error) {
        msg = j.error.message || msg;
        typ = j.error.type || typ;
      }
    } catch {}
    return anthropicError(msg, typ);
  }
  if (!chatParams.stream) {
    let oai;
    try {
      oai = await resp.json();
    } catch {
      return anthropicError("Failed to parse upstream response", "api_error");
    }
    return jsonResponse(anthropicFromOpenAI(oai, mc), resp.status);
  }
  const h = new Headers(resp.headers);
  h.set("Content-Type", "text/event-stream");
  return new Response(resp.body.pipeThrough(openAIStreamToAnthropic(mc, includeThinking)), { status: resp.status, headers: h });
}

// Responses API  → chat completions （/）
function responsesToChatParams(params, mc) {
  const chat = {};
  for (const k of ["temperature", "top_p", "tools", "tool_choice", "parallel_tool_calls", "stop", "seed", "store", "metadata", "user", "stream"]) {
    if (params[k] !== undefined && params[k] !== null) chat[k] = params[k];
  }
  if (params.max_output_tokens !== undefined && params.max_output_tokens !== null) chat.max_completion_tokens = params.max_output_tokens;
  if (params.reasoning && typeof params.reasoning === "object" && params.reasoning.effort) chat.reasoning_effort = params.reasoning.effort;
  if (params.text && typeof params.text === "object" && params.text.format && params.text.format.type && params.text.format.type !== "text") {
    chat.response_format = { type: params.text.format.type };
    if (params.text.format.json_schema) chat.response_format.json_schema = params.text.format.json_schema;
  }
  // Responses （ function）→ chat completions （function ）。
  //  type:"function"，namespace/web_search  function ，。
  if (Array.isArray(params.tools)) {
    chat.tools = params.tools
      .filter((t) => t && typeof t === "object" && t.type === "function")
      .map((t) => ({
        type: "function",
        function: {
          name: t.name || "",
          description: t.description || "",
          parameters: t.parameters || { type: "object", properties: {} },
        },
      }));
    if (chat.tools.length === 0) delete chat.tools;
  }
  // Responses tool_choice → chat ； function ， auto
  if (params.tool_choice && typeof params.tool_choice === "object") {
    if (params.tool_choice.type === "function" && params.tool_choice.name) {
      chat.tool_choice = { type: "function", function: { name: params.tool_choice.name } };
    } else {
      chat.tool_choice = "auto";
    }
  }
  chat.model = mc.id;
  chat.messages = responsesInputToMessages(params.input, params.instructions);
  return chat;
}

// Responses API input → chat messages（input ）
function responsesInputToMessages(input, instructions) {
  const messages = [];
  if (instructions) messages.push({ role: "system", content: instructions });
  if (typeof input === "string") { messages.push({ role: "user", content: input }); return messages; }
  if (!Array.isArray(input)) { messages.push({ role: "user", content: input == null ? "" : String(input) }); return messages; }
  for (const item of input) {
    if (typeof item === "string") { messages.push({ role: "user", content: item }); continue; }
    if (!item || typeof item !== "object") continue;
    if (item.type === "function_call_output") {
      messages.push({ role: "tool", tool_call_id: item.call_id || "", content: typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "") });
      continue;
    }
    // function_call / reasoning / item_reference /，
    if (item.type === "function_call" || item.type === "reasoning" || item.type === "item_reference") continue;
    const role = item.role || "user";
    const content = item.content;
    if (typeof content === "string") { messages.push({ role, content }); continue; }
    if (Array.isArray(content)) {
      const parts = [];
      for (const c of content) {
        if (!c || typeof c !== "object") continue;
        if (c.type === "input_text" || c.type === "output_text") { parts.push({ type: "text", text: c.text ?? "" }); continue; }
        if (c.type === "text" && typeof c.text === "string") { parts.push(c); continue; }
      }
      messages.push({ role, content: parts.length ? parts : "" });
      continue;
    }
    messages.push({ role, content: "" });
  }
  return messages;
}

// chat completions  responses ： + session/run  + /
async function executeChat(env, chatParams, mc, isStream, mode, apiKey) {
  if (await isModelDisabled(env, mc.id)) {
    return jsonResponse({ error: { message: "Model disabled: " + mc.id, type: "model_not_found" } }, 404);
  }
  const keyId = keyAccountId(apiKey);
  const limit = keyLimit(env, apiKey);
  if (limit > 0 && (await keyTodayUsed(env, keyId)) >= limit) {
    return jsonResponse({ error: { message: "Daily request limit reached for key " + keyPrefixOf(apiKey) + "... (limit " + limit + ")", type: "rate_limit_error" } }, 429);
  }
  await maybeFlush(env);
  const debug = env.FREEBUFF_DEBUG === "true";
  const pool = parseAccounts(env);
  if (pool.length === 0) return jsonResponse({ error: { message: " FREEBUFF_TOKEN ", type: "config_error" } }, 503);

  bump("requests", 1, mc, keyId);
  bump("inputChars", estimateInputChars(chatParams.messages), mc, keyId);

  // ：（/429/428 /run ），。
  // （>1 、），。
  let lastErrMsg = "";
  for (let acctTry = 0; acctTry < pool.length; acctTry++) {
    const acct = pickToken(env, mc.session);
    const token = acct ? acct.token : null;
    if (!token) break;
    recordAccountUse(token);
    try {
      // 1) session
      const sess = await createSession(token, mc.session);
      if (debug) console.log(`[acct ${acctTry + 1}] session=${sess.instanceId}`);

      // 2) run
      const run = await startRunChain(token, mc.agent);
      if (debug) console.log(`[acct ${acctTry + 1}] run=${run.runId}`);

      // 3) chat（428 waiting_room_required / 409 session_superseded = session ，
      //    ；）
      let resp, errText = "", sessForChat = sess;
      for (let attempt = 0; attempt < 2; attempt++) {
        const payload = buildUpstreamPayload(chatParams, mc, sessForChat, run.runId);
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-freebuff-instance-id": sessForChat.instanceId,
          "User-Agent": "ai-sdk/openai-compatible/0.0.141/codebuff",
        };
        // x-freebuff-acting-user-id： token  uid（"token:uid" ），
        // （limit 6/）—— uid 。
        //  uid  FREEBUFF_USER_ID（ 2027142c-...， 4 ）；
        // ， Authorization token 。
        const acctUid = acct && acct.uid;
        const globalUid = env.FREEBUFF_USER_ID && env.FREEBUFF_USER_ID !== "2027142c-e843-443f-b7d0-d636016d37c4" ? env.FREEBUFF_USER_ID : null;
        const actingUid = acctUid || globalUid;
        if (actingUid) headers["x-freebuff-acting-user-id"] = actingUid;
        if (debug) console.log(`[acct ${acctTry + 1}][chat] attempt=${attempt + 1}`);
        resp = await fetch(CODEBUFF_API + "/api/v1/chat/completions", {
          method: "POST", headers, body: JSON.stringify(payload),
          signal: AbortSignal.timeout(isStream ? UPSTREAM_TIMEOUT_MS : NONSTREAM_TIMEOUT_MS),
        });
        if (resp.status === 401 || resp.status === 403) markAccountDead(env, token);
        if (resp.ok) break;
        errText = await resp.text();
        // 428 waiting_room_required（ session）/ 409 session_superseded（ session ）
        //  instance  → ；，
        const staleSession =
          (resp.status === 428 && errText.includes("waiting_room_required")) ||
          (resp.status === 409 && errText.includes("session_superseded"));
        if (staleSession && attempt === 0) {
          sessCache.delete(token + ":" + mc.session);
          if (debug) console.log(`[acct ${acctTry + 1}][chat] session stale (${resp.status}), recreate…`);
          // forceCreate： GET  session， POST
          sessForChat = await createSession(token, mc.session, true);
          continue;
        }
        // ： session ，
        if (staleSession) cooldown(token, 60 * 1000);
        cooldown(token, parseCooldown(errText, resp.status));
        break;
      }
      if (!resp.ok) {
        recordAccountError(token, resp.status, errText);
        lastErrMsg = "upstream error: " + (errText || "").slice(0, 300);
        if (debug) console.log(`[acct ${acctTry + 1}] failed ${resp.status}, switch account`);
        continue;
      }

      if (isStream) {
        bump("successes", 1, mc, keyId);
        const { readable, writable } = new TransformStream();
        if (mode === "responses") pipeUpstreamToResponsesStream(resp.body, writable, mc);
        else pipeUpstreamToClient(resp.body, writable);
        return new Response(readable, { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...corsHeaders() } });
      }

      if (mode === "responses") {
        const rr = await responsesToNonStream(resp.body, mc);
        bump("successes", 1, mc, keyId);
        bump("outputChars", outputCharsOf(rr), mc, keyId);
        return jsonResponse(rr, 200);
      }

      const agg = await streamToNonStream(resp.body, mc.upstream);
      bump("successes", 1, mc, keyId);
      bump("outputChars", outputCharsOf(agg), mc, keyId);
      return jsonResponse(agg, 200);
    } catch (e) {
      recordAccountError(token, 0, String(e.message || e));
      console.error("[" + mode + "]", e);
      const msg = String(e.message || e);
      // /（ chat fetch 20s abort），
      // ⚠️ createSession 429（） retryAfterMs/（luna ），
      //  60s—— 429。
      if (/create session failed|stayed queued|start_run failed|session_model_mismatch|abort|timeout|timed out|terminated/i.test(msg)) {
        const m429 = msg.match(/429/);
        cooldown(token, m429 ? parseCooldown(msg, 429) : 60 * 1000);
      }
      lastErrMsg = msg;
      if (debug) console.log(`[acct ${acctTry + 1}] exception: ${msg.slice(0, 120)}, switch account`);
    }
  }
  if (lastErrMsg) bump("errors", 1, mc, keyId);
  return jsonResponse({ error: { message: lastErrMsg, type: "api_error" } }, 502);
}


// ---------------------------------------------------------------------------
// SSE
// ---------------------------------------------------------------------------

function unwrapData(obj) {
  if (obj && obj.data && typeof obj.data === "object" && (obj.data.choices || obj.data.id || obj.data.usage)) return obj.data;
  return obj;
}

// ： SSE  {data:...}
function pipeUpstreamToClient(upstreamBody, writable) {
  const reader = upstreamBody.getReader();
  const writer = writable.getWriter();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim();
            if (payload === "" || payload === "[DONE]") { await writer.write(encoder.encode(line + "\n\n")); continue; }
            try {
              const normalized = unwrapData(JSON.parse(payload));
              await writer.write(encoder.encode("data: " + JSON.stringify(normalized) + "\n\n"));
            } catch { await writer.write(encoder.encode(line + "\n")); }
          } else {
            await writer.write(encoder.encode(line + "\n"));
          }
        }
      }
    } catch {}
    finally { try { await writer.close(); } catch {} }
  })();
}

// ： OpenAI
async function streamToNonStream(upstreamBody, upstreamModel) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  let buf = "", content = "", reasoning = "", finishReason = null, model = "", id = "", usage = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      try {
        const obj = unwrapData(JSON.parse(payload));
        const choice = obj?.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta || {};
        if (delta.content) content += delta.content;
        if (delta.reasoning_content) reasoning += delta.reasoning_content;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        if (obj.id) id = obj.id;
        if (obj.model) model = obj.model;
        if (obj.usage) usage = obj.usage;
      } catch {}
    }
  }
  const msg = { role: "assistant", content };
  if (reasoning && !content) { msg.content = reasoning; msg.reasoning_used_as_content = true; }
  else if (reasoning) msg.reasoning_content = reasoning;
  return {
    id: id || "gen_" + Date.now(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model || upstreamModel,
    choices: [{ index: 0, message: msg, finish_reason: finishReason || "stop", logprobs: null }],
    usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

// ---------------------------------------------------------------------------
// Responses API（/v1/responses）
// ---------------------------------------------------------------------------

function responsesBase(mc, respId, createdAt) {
  return {
    id: respId || "resp_" + Math.random().toString(36).slice(2, 10),
    object: "response",
    created_at: createdAt ?? Math.floor(Date.now() / 1000),
    status: "in_progress",
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: mc.id,
    output: [],
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: { effort: null, summary: null },
    store: true,
    temperature: 1.0,
    text: { format: { type: "text" } },
    tool_choice: "auto",
    tools: [],
    top_p: 1.0,
    truncation: "disabled",
    usage: null,
    user: null,
    metadata: {},
  };
}

function responsesUsage() {
  return { input_tokens: 0, input_tokens_details: { cached_tokens: 0 }, output_tokens: 0, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 0 };
}

// ： chat SSE → Responses API （response.created … response.completed）
async function pipeUpstreamToResponsesStream(upstreamBody, writable, mc) {
  const reader = upstreamBody.getReader();
  const writer = writable.getWriter();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const respId = "resp_" + Math.random().toString(36).slice(2, 10);
  const createdAt = Math.floor(Date.now() / 1000);
  let buf = "", model = "", usage = null;
  const send = (obj) => writer.write(encoder.encode("data: " + JSON.stringify(obj) + "\n\n"));

  // ：message（） function_call（）
  const items = [];
  let nextOutputIndex = 0;
  let contentItem = null;
  const toolItems = new Map(); //  tool_calls index →

  const startContent = () => {
    const item = {
      kind: "message",
      id: "msg_" + Math.random().toString(36).slice(2, 10),
      outputIndex: nextOutputIndex++,
      text: "",
      contentIndex: 0,
      started: false,
    };
    items.push(item);
    return item;
  };
  const startTool = (tc) => {
    const fn = tc.function || {};
    const item = {
      kind: "function_call",
      id: "fc_" + Math.random().toString(36).slice(2, 10),
      outputIndex: nextOutputIndex++,
      callId: tc.id || "call_" + Math.random().toString(36).slice(2, 10),
      name: fn.name || "",
      args: "",
    };
    items.push(item);
    return item;
  };

  (async () => {
    try {
      await send({ type: "response.created", response: responsesBase(mc, respId, createdAt) });
      await send({ type: "response.in_progress", response: responsesBase(mc, respId, createdAt) });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "" || payload === "[DONE]") continue;
          try {
            const obj = unwrapData(JSON.parse(payload));
            const choice = obj?.choices?.[0];
            if (!choice) continue;
            const delta = choice.delta || {};
                if (obj.model) model = obj.model;
                if (obj.usage) usage = obj.usage;

            // （chat  delta.tool_calls[]）
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                if (!tc || typeof tc !== "object") continue;
                const ti = tc.index ?? 0;
                let item = toolItems.get(ti);
                if (!item) {
                  item = startTool(tc);
                  toolItems.set(ti, item);
                  await send({ type: "response.output_item.added", output_index: item.outputIndex, item: { id: item.id, type: "function_call", status: "in_progress", call_id: item.callId, name: item.name, arguments: "" } });
                }
                const fn = tc.function || {};
                if (fn.name && !item.name) item.name = fn.name;
                if (fn.arguments) {
                  item.args += fn.arguments;
                  await send({ type: "response.function_call_arguments.delta", item_id: item.id, output_index: item.outputIndex, delta: fn.arguments });
                }
              }
            }

            //
            if (delta.content) {
              if (!contentItem) contentItem = startContent();
              if (!contentItem.started) {
                contentItem.started = true;
                await send({ type: "response.output_item.added", output_index: contentItem.outputIndex, item: { id: contentItem.id, type: "message", status: "in_progress", role: "assistant", content: [] } });
                await send({ type: "response.content_part.added", item_id: contentItem.id, output_index: contentItem.outputIndex, content_index: contentItem.contentIndex, part: { type: "output_text", text: "", annotations: [] } });
              }
              contentItem.text += delta.content;
              await send({ type: "response.output_text.delta", item_id: contentItem.id, output_index: contentItem.outputIndex, content_index: contentItem.contentIndex, delta: delta.content });
            }
          } catch {}
        }
      }

      //  message， output
      if (items.length === 0) {
        const item = startContent();
        item.started = true;
        await send({ type: "response.output_item.added", output_index: item.outputIndex, item: { id: item.id, type: "message", status: "in_progress", role: "assistant", content: [] } });
        await send({ type: "response.content_part.added", item_id: item.id, output_index: item.outputIndex, content_index: item.contentIndex, part: { type: "output_text", text: "", annotations: [] } });
      }

      // ： done
      for (const item of items) {
        if (item.kind === "message") {
          if (!item.started) {
            await send({ type: "response.output_item.added", output_index: item.outputIndex, item: { id: item.id, type: "message", status: "in_progress", role: "assistant", content: [] } });
            await send({ type: "response.content_part.added", item_id: item.id, output_index: item.outputIndex, content_index: item.contentIndex, part: { type: "output_text", text: "", annotations: [] } });
          }
          const part = { type: "output_text", text: item.text, annotations: [] };
          await send({ type: "response.output_text.done", item_id: item.id, output_index: item.outputIndex, content_index: item.contentIndex, text: item.text });
          await send({ type: "response.content_part.done", item_id: item.id, output_index: item.outputIndex, content_index: item.contentIndex, part });
          await send({ type: "response.output_item.done", output_index: item.outputIndex, item: { id: item.id, type: "message", status: "completed", role: "assistant", content: [part] } });
        } else {
          await send({ type: "response.output_item.done", output_index: item.outputIndex, item: { id: item.id, type: "function_call", status: "completed", call_id: item.callId, name: item.name, arguments: item.args } });
        }
      }

      const resp = responsesBase(mc, respId, createdAt);
      resp.status = "completed";
      resp.model = model || mc.id;
      resp.output = items.map((item) =>
        item.kind === "message"
          ? { id: item.id, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: item.text, annotations: [] }] }
          : { id: item.id, type: "function_call", status: "completed", call_id: item.callId, name: item.name, arguments: item.args }
      );
      resp.usage = usage || responsesUsage();
      await send({ type: "response.completed", response: resp });
    } catch {}
    finally { try { await writer.close(); } catch {} }
  })();
}

// ： Responses API
async function responsesToNonStream(upstreamBody, mc) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  let buf = "", model = "", outputText = "", reasoning = "", usage = null;
  const toolItems = new Map(); //  tool_calls index → {id, callId, name, args}
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      try {
        const obj = unwrapData(JSON.parse(payload));
        const choice = obj?.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta || {};
        if (delta.content) outputText += delta.content;
        if (delta.reasoning_content) reasoning += delta.reasoning_content;
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            if (!tc || typeof tc !== "object") continue;
            const ti = tc.index ?? 0;
            let item = toolItems.get(ti);
            if (!item) {
              const fn = tc.function || {};
              item = {
                id: "fc_" + Math.random().toString(36).slice(2, 10),
                callId: tc.id || "call_" + Math.random().toString(36).slice(2, 10),
                name: fn.name || "",
                args: "",
              };
              toolItems.set(ti, item);
            }
            const fn = tc.function || {};
            if (fn.name && !item.name) item.name = fn.name;
            if (fn.arguments) item.args += fn.arguments;
          }
        }
        if (obj.model) model = obj.model;
        if (obj.usage) usage = obj.usage;
      } catch {}
    }
  }
  const resp = responsesBase(mc, undefined, Math.floor(Date.now() / 1000));
  resp.status = "completed";
  resp.model = model || mc.id;
  resp.output = [];
  if (outputText || reasoning) {
    const text = outputText || reasoning;
    resp.output.push({
      id: "msg_" + Math.random().toString(36).slice(2, 10),
      type: "message", status: "completed", role: "assistant",
      content: [{ type: "output_text", text, annotations: [] }],
    });
  }
  for (const item of toolItems.values()) {
    resp.output.push({ id: item.id, type: "function_call", status: "completed", call_id: item.callId, name: item.name, arguments: item.args });
  }
  resp.usage = usage || responsesUsage();
  return resp;
}


// ---------------------------------------------------------------------------
//
// ---------------------------------------------------------------------------

// ： Map （Workers  GC）
function cleanCache() {
  const now = Date.now();
  try {
    if (sessCache.size > 50) {
      for (const [k, v] of sessCache) {
        const exp = v.expiresAt ? new Date(v.expiresAt).getTime() : 0;
        if (exp > 0 && exp < now) sessCache.delete(k);
      }
    }
    if (runCache.size > 50) {
      for (const [k, v] of runCache) {
        if (now - v.ts > RUN_CACHE_TTL_MS) runCache.delete(k);
      }
    }
  } catch {}
}

// /v1/models 。
// ⚠️  GET /api/v1/freebuff/session（/）：
//  session， Freebuff ，
// / chat （428 waiting_room_required）。
async function handleModels(env) {
  const disabled = new Set(await disabledModels(env));
  return jsonResponse({
    object: "list",
    data: MODELS.filter((m) => !disabled.has(m.id)).map((m) => ({ id: m.id, object: "model", created: Math.floor(Date.now() / 1000), owned_by: "freebuff" })),
  }, 200, { "X-Freebuff2api-Version": VERSION });
}

function getApiKey(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const key = (auth.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-api-key") || "").trim();
  if (!key) return null;
  return key === (env.FREEBUFF_ADMIN_KEY || "").trim() || parseApiKeys(env).some((x) => x.key === key) ? key : null;
}

function jsonResponse(obj, status, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...corsHeaders(), ...extraHeaders } });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-freebuff-instance-id, anthropic-version, anthropic-beta",
  };
}

// ---------------------------------------------------------------------------
// v1.8.0: persistent usage (KV), multi-key limits, disabled models, alerts
// ---------------------------------------------------------------------------

const FIELD_NAMES = ["requests", "successes", "errors", "inputChars", "outputChars"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function defaultModel(env) {
  const m = (env.FREEBUFF_DEFAULT_MODEL || "").trim();
  return m || DEFAULT_MODEL;
}

// --- storage backend: Deno KV (Deno Deploy) -> env.FREEBUFF_KV (Cloudflare) -> in-memory fallback ---
let storePromise = null;
let storeBackendLabel = "memory"; // deno_kv | cf_kv | memory (set when the store initializes)
function getStore(env) {
  if (!storePromise) {
    storePromise = (async () => {
      if (typeof Deno !== "undefined" && Deno.openKv) {
        try {
          const kv = await Deno.openKv();
          storeBackendLabel = "deno_kv";
          return {
            sum: async (key, n) => { if (n) await kv.atomic().sum(key, n).commit(); },
            get: async (key) => (await kv.get(key)).value ?? null,
            put: async (key, value) => { await kv.set(key, value); },
            del: async (key) => { await kv.delete(key); },
            list: async (prefix) => { const out = []; const it = kv.list({ prefix }); for await (const e of it) out.push({ key: e.key, value: e.value }); return out; },
          };
        } catch {}
      }
      if (env && env.FREEBUFF_KV && typeof env.FREEBUFF_KV.get === "function") {
        const kvns = env.FREEBUFF_KV;
        storeBackendLabel = "cf_kv";
        // Percent-encode each component: model ids contain '/' and key hashes are hex,
        // so a bare join/split on '/' would corrupt keys (KV-003 / CodeReviewer P1).
        const k = (key) => key.map((p) => encodeURIComponent(String(p))).join("/");
        return {
          // NB: CF KV has no atomic increment; concurrent multi-isolate flushes can lose
          // an update (read-modify-write). Deno KV (atomic sum) and the in-memory backend
          // are not affected. Documented limitation for the CF deployment path.
          sum: async (key, n) => { const v = Number(await kvns.get(k(key))) || 0; await kvns.put(k(key), String(v + n)); },
          get: async (key) => { const v = await kvns.get(k(key)); return v == null ? null : Number(v); },
          put: async (key, value) => { await kvns.put(k(key), String(value)); },
          del: async (key) => { await kvns.delete(k(key)); },
          list: async (prefix) => { const out = []; const res = await kvns.list({ prefix: k(prefix) + "/" }); for await (const e of res) out.push({ key: e.key.split("/").map((p) => decodeURIComponent(p)), value: Number(e.value) || 0 }); return out; },
        };
      }
      const m = new Map();
      const k = (key) => key.join("\u0000");
      return {
        sum: async (key, n) => { m.set(k(key), (m.get(k(key)) || 0) + n); },
        get: async (key) => m.get(k(key)) ?? null,
        put: async (key, value) => { m.set(k(key), value); },
        del: async (key) => { m.delete(k(key)); },
        list: async (prefix) => { const p = k(prefix) + "\u0000"; const out = []; for (const [kk, v] of m) if (kk.startsWith(p)) out.push({ key: kk.split("\u0000"), value: v }); return out; },
      };
    })();
  }
  return storePromise;
}

// --- usage accounting: in-memory deltas + KV baselines ---
const keyBase = new Map();   // prefix -> { date, requests }
const alerted = new Map();   // token -> timestamp

function bump(field, n, mc, keyId) {
  if (!n) return;
  usageStats[field] += n;
  const date = todayStr();
  if (mc) {
    const ms = usageStats.byModel.get(mc.id) || { requests: 0, successes: 0, errors: 0, inputChars: 0, outputChars: 0 };
    ms[field] = (ms[field] || 0) + n;
    usageStats.byModel.set(mc.id, ms);
    const dm = usageStats.byDayModel.get(date + "\u0000" + mc.id) || { requests: 0, successes: 0, errors: 0 };
    dm[field] = (dm[field] || 0) + n;
    usageStats.byDayModel.set(date + "\u0000" + mc.id, dm);
  }
  if (keyId) {
    const kd = usageStats.byKey.get(date + "\u0000" + keyId) || { requests: 0, successes: 0, errors: 0 };
    kd[field] = (kd[field] || 0) + n;
    usageStats.byKey.set(date + "\u0000" + keyId, kd);
  }
  const dd = usageStats.byDay.get(date) || { requests: 0, successes: 0, errors: 0, inputChars: 0, outputChars: 0 };
  dd[field] = (dd[field] || 0) + n;
  usageStats.byDay.set(date, dd);
}

function estimateInputChars(messages) {
  let n = 0;
  for (const m of messages || []) {
    if (!m) continue;
    if (typeof m.content === "string") n += m.content.length;
    else if (Array.isArray(m.content)) {
      for (const c of m.content) if (c && typeof c.text === "string") n += c.text.length;
    }
  }
  return n;
}

function outputCharsOf(response) {
  let n = 0;
  try {
    const texts = [];
    if (response && response.choices && response.choices[0] && response.choices[0].message) {
      const c = response.choices[0].message.content;
      if (typeof c === "string") texts.push(c);
      else if (Array.isArray(c)) for (const p of c) if (p && typeof p.text === "string") texts.push(p.text);
    }
    if (response && Array.isArray(response.output)) {
      for (const o of response.output) {
        if (o && o.type === "message" && Array.isArray(o.content)) {
          for (const p of o.content) if (p && typeof p.text === "string") texts.push(p.text);
        }
      }
    }
    n = texts.reduce((a, s) => a + s.length, 0);
  } catch {}
  return n;
}

let lastFlushAt = 0;
async function maybeFlush(env) {
  if (Date.now() - lastFlushAt > 30000) await flushDeltas(env);
}

async function flushDeltas(env) {
  const snap = {
    requests: usageStats.requests, successes: usageStats.successes, errors: usageStats.errors,
    inputChars: usageStats.inputChars, outputChars: usageStats.outputChars,
  };
  const byModel = [...usageStats.byModel.entries()];
  const byDay = [...usageStats.byDay.entries()];
  const byDayModel = [...usageStats.byDayModel.entries()];
  const byKey = [...usageStats.byKey.entries()];
  if (snap.requests === 0 && byModel.length === 0 && byDay.length === 0 && byDayModel.length === 0 && byKey.length === 0) return;
  usageStats.requests = 0; usageStats.successes = 0; usageStats.errors = 0;
  usageStats.inputChars = 0; usageStats.outputChars = 0;
  usageStats.byModel = new Map();
  usageStats.byDay = new Map();
  usageStats.byDayModel = new Map();
  usageStats.byKey = new Map();
  const s = await getStore(env);
  const ops = [];
  const add = (key, n) => { if (n) ops.push({ key, n, p: s.sum(key, n) }); };
  const addObj = (key, o) => { for (const f of FIELD_NAMES) if (o[f]) add([...key, f], o[f]); };
  addObj(["usage", "total"], snap);
  for (const [id, v] of byModel) addObj(["usage", "total", "model", id], v);
  for (const [date, v] of byDay) addObj(["usage", "day", date], v);
  for (const [k, v] of byDayModel) {
    const idx = k.lastIndexOf("\u0000");
    addObj(["usage", "day", k.slice(0, idx), "model", k.slice(idx + 1)], v);
  }
  for (const [k, v] of byKey) {
    const idx = k.lastIndexOf("\u0000");
    const date = k.slice(0, idx), keyId = k.slice(idx + 1);
    addObj(["usage", "day", date, "key", keyId], v);
    addObj(["usage", "key", keyId], v);
  }
  // Persist each op; restore ONLY the ops that failed so a partial failure cannot
  // double-count already-committed sums on the next flush.
  const results = await Promise.allSettled(ops.map((o) => o.p));
  let failed = false;
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed = true;
      restoreDelta(ops[i].key, ops[i].n);
    }
  });
  if (failed) return;
  for (const [k, v] of byKey) {
    const idx = k.lastIndexOf("\u0000");
    const date = k.slice(0, idx), keyId = k.slice(idx + 1);
    const b = keyBase.get(keyId);
    if (b && b.date === date) b.requests += v.requests;
  }
  lastFlushAt = Date.now();
}

function mergeDelta(map, k, field, n) {
  const o = map.get(k) || {};
  o[field] = (o[field] || 0) + n;
  map.set(k, o);
}

function restoreDelta(key, n) {
  try {
    if (!key || key[0] !== "usage") return;
    if (key[1] === "total") {
      if (key[2] === "model") mergeDelta(usageStats.byModel, key[3], key[4], n);
      else usageStats[key[2]] += n;
      return;
    }
    if (key[1] === "day") {
      if (key[3] === "model") mergeDelta(usageStats.byDayModel, key[2] + "\u0000" + key[4], key[5], n);
      else if (key[3] === "key") mergeDelta(usageStats.byKey, key[2] + "\u0000" + key[4], key[5], n);
      else mergeDelta(usageStats.byDay, key[2], key[3], n);
      return;
    }
    if (key[1] === "key") mergeDelta(usageStats.byKey, todayStr() + "\u0000" + key[2], key[3], n);
  } catch {}
}



// --- API keys: FREEBUFF_API_KEYS="key1:100,key2" (key:limit, limit = daily request cap) ---
function parseApiKeys(env) {
  const list = [];
  const seen = new Set();
  const add = (raw, defLimit) => {
    let key = String(raw || "").trim();
    let limit = defLimit || 0;
    if (!key) return;
    // Trailing ":<digits>" is reserved for the daily limit (documented). A literal key
    // ending in ":<digits>" cannot be expressed directly; add a suffix to disambiguate.
    const ci = key.lastIndexOf(":");
    if (ci > 0 && /^\d+$/.test(key.slice(ci + 1))) { limit = parseInt(key.slice(ci + 1), 10); key = key.slice(0, ci); }
    if (key && !seen.has(key)) {
      seen.add(key);
      list.push({ key, limit });
    }
  };
  if (env.FREEBUFF_API_KEYS) for (const e of env.FREEBUFF_API_KEYS.split(/[\n,]/)) add(e, 0);
  // Evaluate each candidate trimmed independently: a whitespace-only API_KEY must not
  // shadow a real FREEBUFF_API_KEY (AUTH-001).
  for (const candidate of [env.API_KEY, env.FREEBUFF_API_KEY]) add(candidate, 0);
  // Degenerate config (only whitespace/stray separators) degrades to the default key
  // instead of locking everyone out (CodeReviewer P3).
  if (list.length === 0) add(DEFAULT_API_KEY, 0);
  return list;
}

function keyLimit(env, key) {
  const k = parseApiKeys(env).find((x) => x.key === key);
  return k ? k.limit : 0;
}

// Admin routes (/admin/usage, /admin/accounts, /admin/models/toggle) require the
// FREEBUFF_ADMIN_KEY when configured; customer keys from FREEBUFF_API_KEYS stay
// limited to /v1/* proxy endpoints (AUTHZ-001). Without an admin key (single-operator
// setups) any accepted key keeps admin powers for backward compatibility.
function isAdminKey(env, key) {
  const ak = (env.FREEBUFF_ADMIN_KEY || "").trim();
  if (ak) return key === ak;
  return !!key && parseApiKeys(env).some((x) => x.key === key);
}

function keyPrefixOf(key) {
  return String(key || "").slice(0, 8);
}

// Stable 64-bit FNV-1a over the FULL key. Used for KV counters and limits so two
// different keys sharing an 8-char prefix never share a quota (KV-001), and the
// raw key never lands in KV key components. Operator-set keys make collisions
// practically impossible (64-bit).
function keyAccountId(key) {
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5;
  const s = String(key || "");
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + 1), 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

async function keyTodayUsed(env, keyId) {
  const date = todayStr();
  let b = keyBase.get(keyId);
  if (!b || b.date !== date) {
    const s = await getStore(env);
    b = { date, requests: (await s.get(["usage", "day", date, "key", keyId, "requests"])) || 0 };
    keyBase.set(keyId, b);
  }
  const d = usageStats.byKey.get(date + "\u0000" + keyId);
  return b.requests + (d ? d.requests : 0);
}

// --- disabled models: env FREEBUFF_DISABLED_MODELS (hard) + KV toggle (soft) ---
function envDisabledSet(env) {
  return new Set((env.FREEBUFF_DISABLED_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean));
}

async function disabledModels(env) {
  const s = await getStore(env);
  const fromKv = (await s.list(["models", "disabled"])).map((e) => String(e.key[e.key.length - 1]));
  return [...new Set([...fromKv, ...envDisabledSet(env)])];
}

async function isModelDisabled(env, id) {
  if (envDisabledSet(env).has(id)) return true;
  const s = await getStore(env);
  return !!(await s.get(["models", "disabled", id]));
}

async function toggleModelDisabled(env, id, disabled) {
  const s = await getStore(env);
  if (disabled) await s.put(["models", "disabled", id], 1);
  else await s.del(["models", "disabled", id]);
}

async function handleModelToggle(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: { message: "Invalid JSON", type: "parse_error" } }, 400); }
  const id = body && typeof body.model === "string" ? body.model : "";
  if (!id || !MODELS.some((m) => m.id === id)) return jsonResponse({ error: { message: "unknown model", type: "invalid_request_error" } }, 400);
  await toggleModelDisabled(env, id, !!body.disabled);
  return jsonResponse(await adminModels(env), 200, { "X-Freebuff2api-Version": VERSION });
}

// --- account history + alerts ---
function baseAcctInfo() {
  return { alive: null, uid: null, checkedAt: 0, quota: null, lastErrors: [], lastUsedAt: null, requests: 0 };
}

function recordAccountUse(token) {
  const h = acctHealth.get(token) || baseAcctInfo();
  h.requests = (h.requests || 0) + 1;
  h.lastUsedAt = Date.now();
  acctHealth.set(token, h);
}

function recordAccountError(token, status, msg) {
  const h = acctHealth.get(token) || baseAcctInfo();
  const arr = h.lastErrors = h.lastErrors || [];
  arr.push({ time: new Date().toISOString(), status: status || 0, message: String(msg || "").slice(0, 200) });
  if (arr.length > 5) arr.shift();
  acctHealth.set(token, h);
}

function markAccountDead(env, token) {
  const h = acctHealth.get(token) || baseAcctInfo();
  h.alive = false;
  h.checkedAt = Date.now();
  acctHealth.set(token, h);
  checkDeadAlert(env, token);
}

// --- alerts: FREEBUFF_ALERT_WEBHOOK or FREEBUFF_TG_BOT_TOKEN + FREEBUFF_TG_CHAT_ID ---
const ALERT_COOLDOWN_MS = 6 * 3600 * 1000;

async function notify(env, text) {
  const webhook = env.FREEBUFF_ALERT_WEBHOOK;
  const tgToken = env.FREEBUFF_TG_BOT_TOKEN;
  const tgChat = env.FREEBUFF_TG_CHAT_ID;
  if (!webhook && !(tgToken && tgChat)) return;
  try {
    if (webhook) await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (tgToken && tgChat) await fetch("https://api.telegram.org/bot" + tgToken + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: tgChat, text }) });
  } catch {}
}

function checkDeadAlert(env, token) {
  const last = alerted.get(token);
  if (last && Date.now() - last < ALERT_COOLDOWN_MS) return;
  alerted.set(token, Date.now());
  notify(env, "[freebuff2api] account " + String(token).slice(0, 8) + "... is dead (invalid token or login expired).");
}
