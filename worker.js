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

let probeTtlMs = 10 * 60 * 1000; // probe cache TTL; FREEBUFF_PROBE_TTL_MIN overrides (default 10 min)

// --- i18n ------------------------------------------------------------------
// UI strings by language. tr is the source of truth; en/de/zh are maintained
// as translations. `T(key, lang, ...args)` substitutes {1}, {2} positional args.
const I18N = {
  "tr": {
    "disconnect": "Bağlantıyı kes",
    "home": "Ana sayfa",
    "refresh": "Yenile",
    "lang": "Dil",
    "apiKey": "API anahtarı",
    "keyPh": "FREEBUFF_API_KEY (usage / accounts için gerekli)",
    "connect": "Bağlan",
    "enterKeyFirst": "Önce API anahtarını gir",
    "loading": "Yükleniyor...",
    "updated": "{1} güncellendi",
    "authFailed": "Kimlik doğrulama başarısız: {1} - anahtarın FREEBUFF_API_KEY ile eşleştiğini kontrol et.",
    "disconnected": "Bağlantı kesildi",
    "tabOverview": "Genel bakış",
    "tabAccounts": "Hesaplar",
    "tabModels": "Modeller",
    "tabSystem": "Sistem",
    "health": "Sağlık",
    "perDay": "günlük",
    "hourlyHeatmap": "Saatlik ısı haritası",
    "heatmapSub": "son 7 gün, UTC",
    "apiKeys": "API anahtarları",
    "todayPlus14d": "bugün + 14 gün",
    "addKey": "Anahtar ekle",
    "kvPersisted": "KV'de saklanır",
    "newKeyPh": "yeni api anahtarı",
    "limitPh": "günlük limit (0 = sınırsız)",
    "add": "Ekle",
    "perModel": "Model başına",
    "downloadCsv": "CSV indir",
    "requestLog": "İstek günlüğü",
    "last50": "son 50, bu izole",
    "kvNote": "Sayaçlar KV'de yeniden başlatmalarda korunur. Hesap kotaları Freebuff'tan gelir.",
    "dailyReset": "Günlük sıfırlanma",
    "resetIn": "Sıfırlanmaya {1} kaldı",
    "resetsAt": "{1} UTC'de sıfırlanır",
    "resetAt": "sıfırlanma {1}",
    "quotaMatrix": "Kota matrisi",
    "usedPerLimit": "kullanılan / limit, hesap x model",
    "reprobe": "Yeniden probe",
    "enterKeyConnect": "API anahtarını gir ve Bağlan'a bas.",
    "accountErrors": "Hesap hataları",
    "last5": "hesap başına son 5",
    "accountDetail": "Hesap detayı",
    "modelCatalog": "Model kataloğu",
    "toggleModels": "aç/kapat (KV'de saklanır)",
    "modelsLoadFailed": "Modeller yüklenemedi: {1}",
    "alerts": "Uyarılar",
    "sendTestAlert": "Test uyarısı gönder",
    "maintMode": "Bakım modu",
    "on": "açık",
    "off": "kapalı",
    "enable": "Etkinleştir",
    "disable": "Devre dışı bırak",
    "sessionsCooldowns": "Oturumlar ve bekleme süreleri",
    "currentIsolate": "bu izole",
    "openSystemTab": "Açmak için Sistem sekmesini aç.",
    "appearance": "Görünüm",
    "accent": "Vurgu rengi:",
    "storage": "Depolama",
    "storageFromStatus": "/admin/status'tan (açılışta).",
    "flushOk": "| flush başarılı",
    "flushNone": "| flush yok",
    "warnNoKey": "Uyarı: sunucuda FREEBUFF_API_KEY tanımlı değil; yalnızca varsayılan anahtar \"freebuff-default-key\" kabul edilir. Kendi anahtarların için FREEBUFF_API_KEY (veya FREEBUFF_API_KEYS) ayarla.",
    "warnDefaultKey": "Sunucu varsayılan anahtarı kullanıyor: \"freebuff-default-key\" (özel anahtar ayarlanmamış).",
    "requests": "İstekler",
    "successRate": "Başarı oranı",
    "errorRate": "Hata oranı",
    "inputChars": "Giriş karakteri",
    "outputChars": "Çıkış karakteri",
    "uptime": "Çalışma süresi",
    "vsPrevDay": "dünküne göre",
    "p50": "p50 gecikme",
    "p95": "p95 gecikme",
    "allModels": "tüm modeller",
    "noDailyData": "Henüz günlük veri yok.",
    "ok": "başarı",
    "err": "hata",
    "avg7d": "7g ort.",
    "trendTip": "7 günlük hareketli ortalama",
    "noHourlyData": "Henüz saatlik veri yok.",
    "date": "Tarih",
    "noKeys": "Anahtar yapılandırılmamış.",
    "dailyLimitN": "günlük limit {1}",
    "unlimited": "sınırsız",
    "del": "Sil",
    "dis": "Kapat",
    "en": "Aç",
    "keyAdded": "Anahtar eklendi",
    "keyRemoved": "Anahtar silindi",
    "keyEnabled": "Anahtar etkinleştirildi",
    "keyDisabled": "Anahtar devre dışı bırakıldı",
    "enterKey": "Önce bir anahtar gir",
    "promptRemove": "Silinecek tam anahtar (ilk 8: {1})",
    "promptDisable": "Devre dışı bırakılacak tam anahtar (ilk 8: {1})",
    "promptEnable": "Etkinleştirilecek tam anahtar (ilk 8: {1})",
    "account": "Hesap",
    "status": "Durum",
    "lastUsed": "Son kullanım",
    "error": "Hata",
    "alive": "çalışıyor",
    "invalid": "geçersiz",
    "unknown": "bilinmiyor",
    "probedAt": "{1}Z'de probe edildi",
    "noErrors": "Kayıtlı hata yok.",
    "time": "Zaman",
    "message": "Mesaj",
    "noRequests": "Henüz istek kaydı yok.",
    "latency": "Gecikme",
    "apiModelId": "API model kimliği",
    "upstreamAgent": "Üst akış ajanı",
    "state": "Durum",
    "disabled": "devre dışı",
    "enabled": "etkin",
    "modelDisabled": "Model {1} devre dışı bırakıldı",
    "modelEnabled": "Model {1} etkinleştirildi",
    "noModelUsage": "Henüz model kullanımı yok.",
    "noAccounts": "Hesap yok.",
    "dead": "ölü",
    "exp": "{1}'de süresi doluyor",
    "sent": "gönderildi",
    "failed": "başarısız: {1}",
    "error_": "hata: {1}",
    "maintOn": "Bakım açık",
    "maintOff": "Bakım kapalı",
    "loadDataFirst": "Önce verileri yükle",
    "model": "Model",
    "traffic": "Trafik",
    "probing": "Probe yapılıyor...",
    "key": "Anahtar",
    "limit": "Limit",
    "reset": "Sıfırlama",
    "req": "İstek",
    "cooldown": "Bekleme",
    "lastAlert": "Son uyarı",
    "sessions": "Oturumlar",
    "lastError": "Son hata"
  },
  "en": {
    "disconnect": "Disconnect",
    "home": "Home",
    "refresh": "Refresh",
    "lang": "Language",
    "apiKey": "API key",
    "keyPh": "FREEBUFF_API_KEY (required for usage / accounts)",
    "connect": "Connect",
    "enterKeyFirst": "Enter API key first",
    "loading": "Loading...",
    "updated": "Updated: {1}",
    "authFailed": "Authentication failed: {1} - verify your key matches FREEBUFF_API_KEY.",
    "disconnected": "Disconnected",
    "tabOverview": "Overview",
    "tabAccounts": "Accounts",
    "tabModels": "Models",
    "tabSystem": "System",
    "health": "Health",
    "perDay": "per day",
    "hourlyHeatmap": "Hourly heatmap",
    "heatmapSub": "last 7 days, UTC",
    "apiKeys": "API keys",
    "todayPlus14d": "today + 14 days",
    "addKey": "Add key",
    "kvPersisted": "stored in KV",
    "newKeyPh": "new api key",
    "limitPh": "daily limit (0 = unlimited)",
    "add": "Add",
    "perModel": "per model",
    "downloadCsv": "Download CSV",
    "requestLog": "Request log",
    "last50": "last 50, this isolate",
    "kvNote": "Counters persist in KV across restarts. Account quotas come from Freebuff.",
    "dailyReset": "Daily reset",
    "resetIn": "Resets in {1}",
    "resetsAt": "Resets at {1} UTC",
    "resetAt": "reset {1}",
    "quotaMatrix": "Quota matrix",
    "usedPerLimit": "used / limit, account x model",
    "reprobe": "Re-probe",
    "enterKeyConnect": "Enter your API key and press Connect.",
    "accountErrors": "Account errors",
    "last5": "last 5 per account",
    "accountDetail": "Account detail",
    "modelCatalog": "Model catalog",
    "toggleModels": "toggle (stored in KV)",
    "modelsLoadFailed": "Failed to load models: {1}",
    "alerts": "Alerts",
    "sendTestAlert": "Send test alert",
    "maintMode": "Maintenance mode",
    "on": "on",
    "off": "off",
    "enable": "Enable",
    "disable": "Disable",
    "sessionsCooldowns": "Sessions and cooldowns",
    "currentIsolate": "this isolate",
    "openSystemTab": "Open the System tab to view.",
    "appearance": "Appearance",
    "accent": "Accent color:",
    "storage": "Storage",
    "storageFromStatus": "from /admin/status (on load).",
    "flushOk": "| flush OK",
    "flushNone": "| no flush",
    "warnNoKey": "Warning: FREEBUFF_API_KEY is not set on the server; only the default key \"freebuff-default-key\" is accepted. Set FREEBUFF_API_KEY (or FREEBUFF_API_KEYS) for your own keys.",
    "warnDefaultKey": "Server is using the default key: \"freebuff-default-key\" (no custom key set).",
    "requests": "Requests",
    "successRate": "Success rate",
    "errorRate": "Error rate",
    "inputChars": "Input chars",
    "outputChars": "Output chars",
    "uptime": "Uptime",
    "vsPrevDay": "vs yesterday",
    "p50": "p50 latency",
    "p95": "p95 latency",
    "allModels": "all models",
    "noDailyData": "No daily data yet.",
    "ok": "ok",
    "err": "err",
    "avg7d": "7d avg",
    "trendTip": "7-day moving average",
    "noHourlyData": "No hourly data yet.",
    "date": "Date",
    "noKeys": "No keys configured.",
    "dailyLimitN": "daily limit {1}",
    "unlimited": "unlimited",
    "del": "Delete",
    "dis": "Disable",
    "en": "Enable",
    "keyAdded": "Key added",
    "keyRemoved": "Key removed",
    "keyEnabled": "Key enabled",
    "keyDisabled": "Key disabled",
    "enterKey": "Enter a key first",
    "promptRemove": "Full key to delete (first 8: {1})",
    "promptDisable": "Full key to disable (first 8: {1})",
    "promptEnable": "Full key to enable (first 8: {1})",
    "account": "Account",
    "status": "Status",
    "lastUsed": "Last used",
    "error": "Error",
    "alive": "alive",
    "invalid": "invalid",
    "unknown": "unknown",
    "probedAt": "probed at {1}Z",
    "noErrors": "No recorded errors.",
    "time": "Time",
    "message": "Message",
    "noRequests": "No requests logged yet.",
    "latency": "Latency",
    "apiModelId": "API model ID",
    "upstreamAgent": "Upstream agent",
    "state": "State",
    "disabled": "disabled",
    "enabled": "enabled",
    "modelDisabled": "Model {1} disabled",
    "modelEnabled": "Model {1} enabled",
    "noModelUsage": "No model usage yet.",
    "noAccounts": "No accounts.",
    "dead": "dead",
    "exp": "expires at {1}",
    "sent": "sent",
    "failed": "failed: {1}",
    "error_": "error: {1}",
    "maintOn": "Maintenance on",
    "maintOff": "Maintenance off",
    "loadDataFirst": "Load data first",
    "model": "Model",
    "traffic": "Traffic",
    "probing": "Probing...",
    "key": "Key",
    "limit": "Limit",
    "reset": "Reset",
    "req": "Req",
    "cooldown": "Cooldown",
    "lastAlert": "Last alert",
    "sessions": "Sessions",
    "lastError": "Last error"
  },
  "de": {
    "disconnect": "Trennen",
    "home": "Start",
    "refresh": "Aktualisieren",
    "lang": "Sprache",
    "apiKey": "API-Schlüssel",
    "keyPh": "FREEBUFF_API_KEY (für usage / accounts erforderlich)",
    "connect": "Verbinden",
    "enterKeyFirst": "Zuerst API-Schlüssel eingeben",
    "loading": "Wird geladen...",
    "updated": "Aktualisiert: {1}",
    "authFailed": "Authentifizierung fehlgeschlagen: {1} - prüfe, ob dein Schlüssel mit FREEBUFF_API_KEY übereinstimmt.",
    "disconnected": "Verbindung getrennt",
    "tabOverview": "Übersicht",
    "tabAccounts": "Konten",
    "tabModels": "Modelle",
    "tabSystem": "System",
    "health": "Health",
    "perDay": "pro Tag",
    "hourlyHeatmap": "Stündliche Heatmap",
    "heatmapSub": "letzte 7 Tage, UTC",
    "apiKeys": "API-Schlüssel",
    "todayPlus14d": "heute + 14 Tage",
    "addKey": "Schlüssel hinzufügen",
    "kvPersisted": "wird in KV gespeichert",
    "newKeyPh": "neuer API-Schlüssel",
    "limitPh": "Tageslimit (0 = unbegrenzt)",
    "add": "Hinzufügen",
    "perModel": "pro Modell",
    "downloadCsv": "CSV herunterladen",
    "requestLog": "Anfrageprotokoll",
    "last50": "letzte 50, dieses Isolate",
    "kvNote": "Zähler bleiben in KV über Neustarts hinweg erhalten. Kontingente kommen von Freebuff.",
    "dailyReset": "Täglicher Reset",
    "resetIn": "Reset in {1}",
    "resetsAt": "Reset um {1} UTC",
    "resetAt": "Reset {1}",
    "quotaMatrix": "Kontingent-Matrix",
    "usedPerLimit": "verwendet / Limit, Konto x Modell",
    "reprobe": "Erneut prüfen",
    "enterKeyConnect": "API-Schlüssel eingeben und Verbinden drücken.",
    "accountErrors": "Kontofehler",
    "last5": "letzte 5 pro Konto",
    "accountDetail": "Kontodetails",
    "modelCatalog": "Modellkatalog",
    "toggleModels": "ein/aus (in KV gespeichert)",
    "modelsLoadFailed": "Modelle konnten nicht geladen werden: {1}",
    "alerts": "Warnungen",
    "sendTestAlert": "Testwarnung senden",
    "maintMode": "Wartungsmodus",
    "on": "an",
    "off": "aus",
    "enable": "Aktivieren",
    "disable": "Deaktivieren",
    "sessionsCooldowns": "Sitzungen und Abklingzeiten",
    "currentIsolate": "dieses Isolate",
    "openSystemTab": "Öffne den System-Tab.",
    "appearance": "Darstellung",
    "accent": "Akzentfarbe:",
    "storage": "Speicher",
    "storageFromStatus": "von /admin/status (beim Laden).",
    "flushOk": "| Flush OK",
    "flushNone": "| kein Flush",
    "warnNoKey": "Warnung: FREEBUFF_API_KEY ist auf dem Server nicht gesetzt; nur der Standardschlüssel \"freebuff-default-key\" wird akzeptiert. Setze FREEBUFF_API_KEY (oder FREEBUFF_API_KEYS) für eigene Schlüssel.",
    "warnDefaultKey": "Server verwendet den Standardschlüssel: \"freebuff-default-key\" (kein eigener Schlüssel gesetzt).",
    "requests": "Anfragen",
    "successRate": "Erfolgsrate",
    "errorRate": "Fehlerrate",
    "inputChars": "Eingabezeichen",
    "outputChars": "Ausgabezeichen",
    "uptime": "Betriebszeit",
    "vsPrevDay": "ggü. gestern",
    "p50": "p50 Latenz",
    "p95": "p95 Latenz",
    "allModels": "alle Modelle",
    "noDailyData": "Noch keine Tagesdaten.",
    "ok": "ok",
    "err": "Fehler",
    "avg7d": "7-Tage-Schnitt",
    "trendTip": "7-Tage gleitender Durchschnitt",
    "noHourlyData": "Noch keine Stundendaten.",
    "date": "Datum",
    "noKeys": "Keine Schlüssel konfiguriert.",
    "dailyLimitN": "Tageslimit {1}",
    "unlimited": "unbegrenzt",
    "del": "Löschen",
    "dis": "Deaktivieren",
    "en": "Aktivieren",
    "keyAdded": "Schlüssel hinzugefügt",
    "keyRemoved": "Schlüssel entfernt",
    "keyEnabled": "Schlüssel aktiviert",
    "keyDisabled": "Schlüssel deaktiviert",
    "enterKey": "Zuerst einen Schlüssel eingeben",
    "promptRemove": "Vollständiger Schlüssel zum Löschen (erste 8: {1})",
    "promptDisable": "Vollständiger Schlüssel zum Deaktivieren (erste 8: {1})",
    "promptEnable": "Vollständiger Schlüssel zum Aktivieren (erste 8: {1})",
    "account": "Konto",
    "status": "Status",
    "lastUsed": "Zuletzt verwendet",
    "error": "Fehler",
    "alive": "aktiv",
    "invalid": "ungültig",
    "unknown": "unbekannt",
    "probedAt": "geprüft um {1}Z",
    "noErrors": "Keine aufgezeichneten Fehler.",
    "time": "Zeit",
    "message": "Nachricht",
    "noRequests": "Noch keine Anfragen protokolliert.",
    "latency": "Latenz",
    "apiModelId": "API-Modell-ID",
    "upstreamAgent": "Upstream-Agent",
    "state": "Zustand",
    "disabled": "deaktiviert",
    "enabled": "aktiviert",
    "modelDisabled": "Modell {1} deaktiviert",
    "modelEnabled": "Modell {1} aktiviert",
    "noModelUsage": "Noch keine Modellnutzung.",
    "noAccounts": "Keine Konten.",
    "dead": "tot",
    "exp": "läuft um {1} ab",
    "sent": "gesendet",
    "failed": "fehlgeschlagen: {1}",
    "error_": "Fehler: {1}",
    "maintOn": "Wartung an",
    "maintOff": "Wartung aus",
    "loadDataFirst": "Zuerst Daten laden",
    "model": "Modell",
    "traffic": "Verkehr",
    "probing": "Prüfung läuft...",
    "key": "Schlüssel",
    "limit": "Limit",
    "reset": "Reset",
    "req": "Anfr.",
    "cooldown": "Abklingzeit",
    "lastAlert": "Letzte Warnung",
    "sessions": "Sitzungen",
    "lastError": "Letzter Fehler"
  },
  "zh": {
    "disconnect": "断开连接",
    "home": "首页",
    "refresh": "刷新",
    "lang": "语言",
    "apiKey": "API 密钥",
    "keyPh": "FREEBUFF_API_KEY（usage / accounts 需要）",
    "connect": "连接",
    "enterKeyFirst": "请先输入 API 密钥",
    "loading": "加载中...",
    "updated": "已更新：{1}",
    "authFailed": "身份验证失败：{1} - 请确认你的密钥与 FREEBUFF_API_KEY 匹配。",
    "disconnected": "已断开连接",
    "tabOverview": "概览",
    "tabAccounts": "账户",
    "tabModels": "模型",
    "tabSystem": "系统",
    "health": "健康",
    "perDay": "每日",
    "hourlyHeatmap": "每小时热力图",
    "heatmapSub": "最近 7 天，UTC",
    "apiKeys": "API 密钥",
    "todayPlus14d": "今天 + 14 天",
    "addKey": "添加密钥",
    "kvPersisted": "存储于 KV",
    "newKeyPh": "新的 API 密钥",
    "limitPh": "每日限额（0 = 无限制）",
    "add": "添加",
    "perModel": "每个模型",
    "downloadCsv": "下载 CSV",
    "requestLog": "请求日志",
    "last50": "最近 50 条，当前 isolate",
    "kvNote": "计数器存储于 KV，重启后保留。账户配额来自 Freebuff。",
    "dailyReset": "每日重置",
    "resetIn": "{1} 后重置",
    "resetsAt": "在 {1} UTC 重置",
    "resetAt": "重置时间 {1}",
    "quotaMatrix": "配额矩阵",
    "usedPerLimit": "已用 / 限额，账户 x 模型",
    "reprobe": "重新探测",
    "enterKeyConnect": "输入 API 密钥并点击连接。",
    "accountErrors": "账户错误",
    "last5": "每个账户最近 5 条",
    "accountDetail": "账户详情",
    "modelCatalog": "模型目录",
    "toggleModels": "开关（存储于 KV）",
    "modelsLoadFailed": "模型加载失败：{1}",
    "alerts": "警报",
    "sendTestAlert": "发送测试警报",
    "maintMode": "维护模式",
    "on": "开启",
    "off": "关闭",
    "enable": "启用",
    "disable": "禁用",
    "sessionsCooldowns": "会话与冷却时间",
    "currentIsolate": "当前 isolate",
    "openSystemTab": "请打开系统选项卡。",
    "appearance": "外观",
    "accent": "强调色：",
    "storage": "存储",
    "storageFromStatus": "来自 /admin/status（加载时）。",
    "flushOk": "| 刷新成功",
    "flushNone": "| 无刷新",
    "warnNoKey": "警告：服务器未设置 FREEBUFF_API_KEY；仅接受默认密钥 \"freebuff-default-key\"。请为你的密钥设置 FREEBUFF_API_KEY（或 FREEBUFF_API_KEYS）。",
    "warnDefaultKey": "服务器正在使用默认密钥：\"freebuff-default-key\"（未设置自定义密钥）。",
    "requests": "请求数",
    "successRate": "成功率",
    "errorRate": "错误率",
    "inputChars": "输入字符",
    "outputChars": "输出字符",
    "uptime": "运行时间",
    "vsPrevDay": "较昨日",
    "p50": "p50 延迟",
    "p95": "p95 延迟",
    "allModels": "所有模型",
    "noDailyData": "暂无每日数据。",
    "ok": "成功",
    "err": "错误",
    "avg7d": "7 天均值",
    "trendTip": "7 天移动平均",
    "noHourlyData": "暂无每小时数据。",
    "date": "日期",
    "noKeys": "未配置密钥。",
    "dailyLimitN": "每日限额 {1}",
    "unlimited": "无限制",
    "del": "删除",
    "dis": "禁用",
    "en": "启用",
    "keyAdded": "密钥已添加",
    "keyRemoved": "密钥已删除",
    "keyEnabled": "密钥已启用",
    "keyDisabled": "密钥已禁用",
    "enterKey": "请先输入密钥",
    "promptRemove": "要删除的完整密钥（前 8 位：{1}）",
    "promptDisable": "要禁用的完整密钥（前 8 位：{1}）",
    "promptEnable": "要启用的完整密钥（前 8 位：{1}）",
    "account": "账户",
    "status": "状态",
    "lastUsed": "最后使用",
    "error": "错误",
    "alive": "存活",
    "invalid": "无效",
    "unknown": "未知",
    "probedAt": "于 {1}Z 探测",
    "noErrors": "无记录错误。",
    "time": "时间",
    "message": "消息",
    "noRequests": "暂无请求记录。",
    "latency": "延迟",
    "apiModelId": "API 模型 ID",
    "upstreamAgent": "上游代理",
    "state": "状态",
    "disabled": "已禁用",
    "enabled": "已启用",
    "modelDisabled": "模型 {1} 已禁用",
    "modelEnabled": "模型 {1} 已启用",
    "noModelUsage": "暂无模型用量。",
    "noAccounts": "暂无账户。",
    "dead": "失效",
    "exp": "于 {1} 过期",
    "sent": "已发送",
    "failed": "失败：{1}",
    "error_": "错误：{1}",
    "maintOn": "维护已开启",
    "maintOff": "维护已关闭",
    "loadDataFirst": "请先加载数据",
    "model": "模型",
    "traffic": "流量",
    "probing": "探测中...",
    "key": "密钥",
    "limit": "限额",
    "reset": "重置",
    "req": "请求",
    "cooldown": "冷却",
    "lastAlert": "最近警报",
    "sessions": "会话",
    "lastError": "最近错误"
  }
};
function T(k, lang) {
  const d = I18N[lang] || I18N.tr;
  let s = (d && d[k]) || I18N.tr[k] || k;
  for (let i = 2; i < arguments.length; i++) s = s.split("{" + (i - 1) + "}").join(arguments[i]);
  return s;
}
function langOf(request) {
  const c = request.headers.get("cookie") || "";
  const m = c.match(/(?:^|;\s*)f2a-lang=([a-z]{2})/i);
  if (m && I18N[m[1].toLowerCase()]) return m[1].toLowerCase();
  return "tr";
}
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.FREEBUFF_PROBE_TTL_MIN) {
      const m = Math.round(Number(env.FREEBUFF_PROBE_TTL_MIN));
      if (isFinite(m) && m >= 1) probeTtlMs = m * 60 * 1000;
    }
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
      return adminPageResponse(request);
    }

    // Landing page and console metadata are public; they contain no secrets.
    if (request.method === "GET" && url.pathname === "/") return landingPage();
    if (request.method === "GET" && url.pathname === "/admin/status") return jsonResponse(adminStatus(env), 200);
    if (request.method === "GET" && url.pathname === "/admin/models") return jsonResponse(await adminModels(env), 200, { "X-Freebuff2api-Version": VERSION });

    const key = getApiKey(request, env);
    if (!key) {
      if (url.pathname === "/v1/messages" || url.pathname === "/messages") return anthropicError("Invalid API key", "authentication_error", 401);
      return jsonResponse({ error: { message: "Invalid API key", type: "auth_error" } }, 401);
    }

    cleanCache();

    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      return handleModels(env);
    }
    if (request.method === "POST" && url.pathname === "/admin/models/toggle") {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleModelToggle(request, env);
    }
    if (request.method === "GET" && url.pathname === "/admin/log") {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleAdminLog();
    }
    if (request.method === "GET" && url.pathname === "/admin/state") {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleAdminState(env);
    }
    if (request.method === "POST" && url.pathname === "/admin/alerts/test") {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleAlertTest(env);
    }
    if (request.method === "POST" && url.pathname === "/admin/maintenance") {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleMaintenance(request, env);
    }
    if (request.method === "POST" && url.pathname === "/admin/keys") {
      if (!isAdminKey(env, key)) return jsonResponse({ error: { message: "Admin key required", type: "auth_error" } }, 403);
      return handleAdminKeys(request, env);
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
    if (request.method === "POST" && (url.pathname === "/v1/messages/count_tokens" || url.pathname === "/messages/count_tokens")) {
      return handleCountTokens(request, env);
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
  byModel: new Map(), byKey: new Map(), byDay: new Map(), byDayModel: new Map(), byHour: new Map(),
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
  if (cached && Date.now() - cached.checkedAt < probeTtlMs) return cached;
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
            reset_at: typeof v.resetAt === "string" ? v.resetAt : typeof v.resetAt === "number" ? new Date(v.resetAt).toISOString() : (v.reset_at || null),
            reset_time_zone: v.resetTimeZone || v.reset_time_zone || null,
          };
        }
      }
    }
    out.push({
      token_prefix: acct.token.slice(0, 8),
      alive: info ? info.alive : null,
      uid: info && info.uid ? info.uid.slice(0, 12) : null,
      requests: (info && info.requests) || 0,
      checked_at: info && info.checkedAt ? new Date(info.checkedAt).toISOString() : null,
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
  checkThresholds(env);
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
  let days = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
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
  const hours = {};
  for (const e of await s.list(["usage", "hour"])) {
    if (e.key.length !== 5) continue;
    const date = String(e.key[2]);
    if (!daySet.has(date)) continue;
    const hd = hours[date] = hours[date] || {};
    const row = hd[String(e.key[3])] = hd[String(e.key[3])] || { requests: 0, successes: 0, errors: 0 };
    row[e.key[4]] = (row[e.key[4]] || 0) + e.value;
  }
  for (const [k, v] of usageStats.byHour) {
    const idx = k.lastIndexOf("\u0000");
    const date = k.slice(0, idx);
    if (!daySet.has(date)) continue;
    const hd = hours[date] = hours[date] || {};
    const row = hd[k.slice(idx + 1)] = hd[k.slice(idx + 1)] || { requests: 0, successes: 0, errors: 0 };
    for (const f of ["requests", "successes", "errors"]) row[f] = (row[f] || 0) + (v[f] || 0);
  }
  const keys = [];
  for (const k of allKeys(env)) {
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
    keys.push({ prefix, limit: k.limit || null, enabled: k.enabled !== false, managed: !!k.kv, today_requests: kd.requests, today_successes: kd.successes, today_errors: kd.errors, days: keyDays });
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
    hours,
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
header{position:sticky;top:0;z-index:10;background:var(--bg-alt);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
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
section{background:var(--panel);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin:12px 0}
#authCard.collapsed{display:none}
h1{font-size:18px;margin:0 0 4px;font-weight:700}
h2{font-size:15px;margin:0 0 12px;font-weight:600}
.panel>h2{padding-bottom:8px;border-bottom:1px solid var(--border);margin:32px 0 14px}
.panel>h2:first-child{margin-top:0}
.panel>h2 select,.panel>h2 button{vertical-align:middle}
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
.heat{overflow-x:auto}
.heatgrid{border-collapse:collapse;min-width:640px}
.heatgrid td{width:14px;height:12px;padding:0;border:1px solid var(--bg);border-radius:1px}
.heatgrid th{font-size:10px;padding:2px;text-align:center}
.heatgrid td:first-child{width:auto;padding:2px 8px;text-align:left}
.tip{position:fixed;z-index:60;background:var(--bg-alt);border:1px solid var(--accent);border-radius:var(--r);padding:6px 10px;font-size:12px;pointer-events:none;max-width:280px;box-shadow:0 4px 14px rgba(0,0,0,.35)}
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

function adminBody(lang) {
  return `
<header>
  <div class="brand"><span class="dot" id="dot"></span><span class="prompt">$</span>freebuff2api<span class="cursor"></span><span class="tag" id="version">console</span></div>
  <div class="tag" id="backend">store: ...</div>
  <div class="tag accent" id="alertCfg" style="display:none"></div>
  <div class="row" style="margin-left:auto"><select id="langSel" onchange="setLang(this.value)" title="${T('lang', lang)}" style="width:auto;margin-right:8px"><option value="tr"${lang==='tr'?' selected':''}>Türkçe</option><option value="en"${lang==='en'?' selected':''}>English</option><option value="de"${lang==='de'?' selected':''}>Deutsch</option><option value="zh"${lang==='zh'?' selected':''}>中文</option></select><button class="ghost small" id="disconnect" onclick="disconnect()" style="display:none">${T('disconnect', lang)}</button><a class="btn" href="/">${T('home', lang)}</a><button class="ghost small" onclick="loadAll(true)">${T('refresh', lang)}</button></div>
</header>
<main>
<section id="authCard">
  <h2>${T('apiKey', lang)}</h2>
  <div class="row">
    <input id="key" type="password" autocomplete="off" placeholder="${T('keyPh', lang)}" onkeydown="if(event.key==='Enter')loadAll(true)">
    <button onclick="loadAll(true)">${T('connect', lang)}</button>
  </div>
  <div class="banner warn" id="authHint" style="display:none"></div>
  <div id="status" class="muted" style="margin-top:8px"></div>
</section>
<div class="tabs">
  <button id="tab-overview" class="active" onclick="switchTab('overview')">${T('tabOverview', lang)}</button>
  <button id="tab-accounts" onclick="switchTab('accounts')">${T('tabAccounts', lang)}</button>
  <button id="tab-models" onclick="switchTab('models')">${T('tabModels', lang)}</button>
  <button id="tab-system" onclick="switchTab('system')">${T('tabSystem', lang)}</button>
</div>
<section id="panel-overview" class="panel active">
  <h2>${T('health', lang)} <span class="muted" id="usageTime"></span> <span id="resetCount" class="muted"></span></h2>
  <div id="usage" class="grid"></div>
  <h2>${T('traffic', lang)} <span class="muted">${T('perDay', lang)}</span>
    <select id="chartModel" onchange="chartSel()" style="width:auto;margin-left:8px"></select>
    <select id="chartRange" onchange="chartSel()" style="width:auto;margin-left:8px">
      <option value="7">7d</option><option value="14" selected>14d</option><option value="30">30d</option>
    </select>
  </h2>
  <div id="chart"></div>
  <h2>${T('hourlyHeatmap', lang)} <span class="muted">${T('heatmapSub', lang)}</span></h2>
  <div class="heat" id="heatmap"></div>
  <h2>${T('apiKeys', lang)} <span class="muted">${T('todayPlus14d', lang)}</span></h2>
  <div id="keys"></div>
  <h2>${T('addKey', lang)} <span class="muted">${T('kvPersisted', lang)}</span></h2>
  <div class="row">
    <input id="newKey" placeholder="${T('newKeyPh', lang)}" style="flex:1;min-width:200px">
    <input id="newKeyLimit" placeholder="${T('limitPh', lang)}" style="width:180px">
    <button class="ghost small" onclick="addKey()">${T('add', lang)}</button>
  </div>
  <h2>${T('perModel', lang)} <button class="ghost small" onclick="exportCsv()" style="margin-left:8px">${T('downloadCsv', lang)}</button></h2>
  <div id="modelShare"></div>
  <div id="byModel"></div>
  <h2>${T('requestLog', lang)} <span class="muted">${T('last50', lang)}</span></h2>
  <div id="reqlog"></div>
  <p class="muted">${T('kvNote', lang)}</p>
</section>
<section id="panel-accounts" class="panel">
  <h2>${T('quotaMatrix', lang)} <span class="muted">${T('usedPerLimit', lang)}</span> <button class="ghost small" id="probeBtn" onclick="loadAll(true)" style="margin-left:8px">${T('reprobe', lang)}</button></h2>
  <div class="qm" id="quotaMatrix"><p class="muted">${T('enterKeyConnect', lang)}</p></div>
  <h2>${T('accountErrors', lang)} <span class="muted">${T('last5', lang)}</span></h2>
  <div id="acctErrors"></div>
  <h2>${T('accountDetail', lang)}</h2>
  <div id="accounts" class="muted">${T('enterKeyConnect', lang)}</div>
</section>
<section id="panel-models" class="panel">
  <h2>${T('modelCatalog', lang)} <span class="muted">${T('toggleModels', lang)}</span></h2>
  <div id="models">${T('loading', lang)}</div>
</section>
<section id="panel-system" class="panel">  <h2>${T('alerts', lang)}</h2>
  <div id="alertStatus" class="muted">${T('loading', lang)}</div>
  <div class="row" style="margin-top:8px"><button class="ghost small" onclick="testAlert()">${T('sendTestAlert', lang)}</button><span class="muted" id="alertResult"></span></div>
  <h2>${T('maintMode', lang)}</h2>
  <div class="row"><span class="muted" id="maintState">${T('off', lang)}</span><button class="ghost small" id="maintBtn" onclick="toggleMaint()">${T('enable', lang)}</button></div>
  <h2>${T('sessionsCooldowns', lang)} <span class="muted">${T('currentIsolate', lang)}</span></h2>
  <div id="stateTable"><p class="muted">${T('openSystemTab', lang)}</p></div>
  <h2>${T('appearance', lang)}</h2>
  <div class="row">
    <span class="muted">${T('accent', lang)}</span>
    <button class="ghost small" onclick="setAccent('#94e2d5')">teal</button>
    <button class="ghost small" onclick="setAccent('#89b4fa')">blue</button>
    <button class="ghost small" onclick="setAccent('#a6e3a1')">green</button>
  </div>
  <h2>${T('storage', lang)}</h2>
  <div id="storageInfo" class="muted">${T('storageFromStatus', lang)}</div>
</section>
<div id="tip" class="tip" style="display:none"></div>
</main>
<script>
var LANG=${JSON.stringify(lang)};var I18N=${JSON.stringify(I18N)};
function t(k){var s=(I18N[LANG]&&I18N[LANG][k])||I18N.tr[k]||k;for(var i=1;i<arguments.length;i++)s=s.split('{'+i+'}').join(arguments[i]);return s}
function setLang(v){document.cookie='f2a-lang='+v+'; path=/; max-age=31536000';localStorage.setItem('f2a-lang',v);location.reload()}
var KEY='';
var LAST_USAGE=null;
var LAST_ACCTS=null;
var LAST_DAYS=[];
var LAST_BDM={};
var MODEL_IDS=[];
var STORE_MODELS=null;
var REFRESHING=false;
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function setStatus(t,kind){var b=$('status');b.textContent=t||'';b.style.color=kind==='ok'?'var(--ok)':kind==='err'?'var(--err)':'inherit'}
function banner(t){var b=$('authHint');b.textContent=t;b.style.display=t?'block':'none'}
function authHeaders(){return{Authorization:'Bearer '+KEY}}
async function get(path){var r=await fetch(path,{headers:authHeaders()});var j;try{j=await r.json()}catch(e){j={}}if(!r.ok){throw Error((j&&j.error&&j.error.message)||('HTTP '+r.status))}return j}
function switchTab(t){['overview','accounts','models','system'].forEach(function(n){$('panel-'+n).classList.toggle('active',n===t);$('tab-'+n).classList.toggle('active',n===t)});if(t==='models')loadModels();if(t==='system')loadState()}
function fmtDur(sec){sec=sec||0;var h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);return h>0?(h+'h '+m+'m'):(m+'m '+(sec%60)+'s')}
function fmtPct(n){if(n==null||!isFinite(n))return '0%';return Math.round(n*100)+'%'}
function statusDot(ok){$('dot').className='dot'+(ok?' ok':'')}
function deltaChip(cur,prev){if(cur==null||prev==null||prev<=0)return '<span class="delta flat">-</span>';var d=(cur-prev)/prev;var cls=d>=0?'up':'down';var sign=d>=0?'+':'';return '<span class="delta '+cls+'">'+sign+Math.round(d*100)+'% '+t('vsPrevDay')+'</span>'}
async function boot(){try{var s=await (await fetch('/admin/status')).json();$('version').textContent='v'+s.version;var a=s.auth||{};if(a.api_key_set===false){statusDot(false);banner(t('warnNoKey'))}else{statusDot(true);banner(a.mode==='default'?t('warnDefaultKey'):null)}$('backend').textContent='store: '+(s.store_backend||'?')+(s.last_flush_at?t('flushOk'):t('flushNone'));var ac=$('alertCfg');if(s.alerts){var parts=[];if(s.alerts.webhook)parts.push('webhook');if(s.alerts.telegram)parts.push('telegram');if(parts.length){ac.style.display='';ac.textContent='alerts: '+parts.join('+')}else{ac.style.display='none'}}else{ac.style.display='none'}$('status').textContent=s.accounts+' account(s), '+s.models+' model(s), '+s.key_count+' key(s), up '+fmtDur(s.uptime_seconds);$('storageInfo').textContent='backend: '+(s.store_backend||'?')+' | last flush: '+(s.last_flush_at?s.last_flush_at.slice(11,19)+'Z':'never');var al=$('alertStatus');if(s.alerts){al.innerHTML='webhook: <b class="'+(s.alerts.webhook?'ok':'err')+'">'+(s.alerts.webhook?'on':'off')+'</b> | telegram: <b class="'+(s.alerts.telegram?'ok':'err')+'">'+(s.alerts.telegram?'on':'off')+'</b>'}setAccent(localStorage.getItem('f2a-accent')||'#94e2d5',true)}catch(e){statusDot(false);setStatus('Status probe failed: '+e.message,'err')}try{var saved=localStorage.getItem('f2a-key');if(saved){$('key').value=saved;loadAll(false)}}catch(e){}}
async function loadAll(refresh){if(REFRESHING)return;REFRESHING=true;var k=$('key').value.trim();if(!k){setStatus(t('enterKeyFirst'),'err');REFRESHING=false;return}KEY=k;localStorage.setItem('f2a-key',KEY);if(refresh){var pb=$('probeBtn');if(pb){pb.disabled=true;pb.textContent=t('probing')}}setStatus(t('loading'));try{var u=await get('/admin/usage'),a=await get('/admin/accounts'+(refresh?'?refresh=1':'')),l=await get('/admin/log');LAST_USAGE=u;LAST_ACCTS=a.accounts;renderUsage(u);renderLatency(l);fillChartSelect(u.by_day_model||{});renderChart(u.days||[],u.by_day_model||{});renderKeys(u.keys||[]);renderHeatmap(u.hours||{});renderDonut(u.by_model||{});renderAccounts(a);renderAcctErrors(a);renderMatrix(a,MODEL_IDS);renderLog(l);updateReset();$('authCard').classList.add('collapsed');$('disconnect').style.display='';setStatus(t('updated',new Date().toLocaleTimeString()),'ok')}catch(e){setStatus(e.message,'err');$('accounts').textContent=t('authFailed',e.message);banner(t('authFailed',e.message))}finally{REFRESHING=false;if(refresh){var pb2=$('probeBtn');if(pb2){pb2.disabled=false;pb2.textContent=t('reprobe')}}}}
function disconnect(){KEY='';localStorage.removeItem('f2a-key');$('authCard').classList.remove('collapsed');$('disconnect').style.display='none';$('resetCount').textContent='';setStatus(t('disconnected'),'')}
function updateReset(){var el=$('resetCount');if(!el)return;var ts=null;(LAST_ACCTS||[]).forEach(function(x){Object.keys(x.quota||{}).forEach(function(m){var v=x.quota[m];if(v&&v.reset_at){var t0=new Date(v.reset_at).getTime();if(isFinite(t0)&&(!ts||t0<ts))ts=t0}})});if(!ts){var now=new Date();ts=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)}var diff=ts-Date.now();if(diff<=0){el.textContent='';return}var s=Math.floor(diff/1000),h=Math.floor(s/3600),mi=Math.floor(s%3600/60),se=s%60;var pad=function(n){return (n<10?'0'+n:''+n)};var target=ts?new Date(ts).toISOString().slice(11,16):'';el.innerHTML=t('dailyReset')+': <b>'+pad(h)+':'+pad(mi)+':'+pad(se)+'</b> <span class="muted">-&gt; '+target+'Z</span>'}
function renderUsage(u){var req=u.requests||0,ok=u.successes||0,err=u.errors||0;var sr=req?(ok/req):0,er=req?(err/req):0;var d=u.days||[];var prev=d.length>1?d[1].requests:null;var cur=d.length?d[0].requests:req;var cards=[[t('requests'),req,deltaChip(cur,prev)],[t('successRate'),fmtPct(sr),''],[t('errorRate'),fmtPct(er),''],[t('inputChars'),u.input_characters,''],[t('outputChars'),u.output_characters,''],[t('uptime'),fmtDur(u.uptime_seconds),'']];$('usage').innerHTML=cards.map(function(x){return '<div class="card"><b>'+esc(x[1])+'</b><span>'+esc(x[0])+'</span>'+x[2]+'</div>'}).join('');var rows=Object.keys(u.by_model||{}).map(function(m){var v=u.by_model[m];return '<tr><td><code>'+esc(m)+'</code></td><td class="num">'+v.requests+'</td><td class="num">'+v.successes+'</td><td class="num">'+v.errors+'</td></tr>'}).join('');$('byModel').innerHTML=rows?'<table><thead><tr><th>'+t('model')+'</th><th class="num">'+t('requests')+'</th><th class="num">'+t('ok')+'</th><th class="num">'+t('err')+'</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="muted">'+t('noRequests')+'</p>';$('usageTime').textContent='('+u.version+')'}
function renderLatency(l){if(!l||!l.entries||!l.entries.length)return;var ms=[];l.entries.forEach(function(e){if(e.ms!=null)ms.push(e.ms)});if(!ms.length)return;ms.sort(function(a,b){return a-b});var p=function(p){var i=Math.min(ms.length-1,Math.floor(p*ms.length));return ms[i]};var lat='<div class="card"><b>'+p(0.5)+'ms</b><span>'+t('p50')+'</span></div><div class="card"><b>'+p(0.95)+'ms</b><span>'+t('p95')+'</span></div>';$('usage').innerHTML+=lat}
function fillChartSelect(bdm){var ids=MODEL_IDS.length?MODEL_IDS:Object.keys(bdm||{});var cur=$('chartModel').value;var opts=['<option value="all">'+t('allModels')+'</option>'].concat(ids.map(function(id){return '<option value="'+esc(id)+'">'+esc(id)+'</option>'}));$('chartModel').innerHTML=opts.join('');$('chartModel').value=(cur&&ids.indexOf(cur)>=0)?cur:'all'}
function renderChart(days,bdm){LAST_DAYS=days;LAST_BDM=bdm;chartSel()}
function chartSel(){var range=parseInt($('chartRange').value||'14',10);var days=(LAST_DAYS||[]).slice(0,range);drawChart(days,LAST_BDM||{},$('chartModel').value)}
function drawChart(days,bdm,sel){var el=$('chart');if(!days||!days.length){el.innerHTML='<p class="muted">'+t('noDailyData')+'</p>';return}var data=days.map(function(d){if(sel&&sel!=='all'&&bdm&&bdm[d.date]){var m=bdm[d.date][sel]||{};return{req:(m.requests||0),ok:(m.successes||0),err:(m.errors||0)}}var ok=d.successes||0,err=d.errors||0;return{req:ok+err,ok:ok,err:err}});var max=1;data.forEach(function(v){if(v.req>max)max=v.req});var W=560,left=30,pad=4,h=130,baseY=h-20,plotW=W-left-pad*2;var bw=Math.max(4,plotW/Math.max(data.length,1)-2);var scale=function(v){return Math.round((v/max)*(h-30))};var bars=data.map(function(v,i){var x=left+pad+i*(bw+2);var eh=v.req?Math.max(1,scale(v.err)):0;var oh=v.req?Math.max(1,scale(v.ok)):0;var yTop=baseY-eh-oh;var tt=days[i].date+': '+v.req+' req ('+v.ok+' ok, '+v.err+' err)';var lab=v.req?'<text x="'+(x+bw/2)+'" y="'+(yTop-3)+'" font-size="10" text-anchor="middle" fill="var(--muted)">'+v.req+'</text>':'';var fr='';if(v.err)fr+='<rect x="'+x+'" y="'+(baseY-eh)+'" width="'+bw+'" height="'+eh+'" rx="1" fill="var(--err)" data-tip="'+esc(tt)+'" style="animation-delay:'+(i*25)+'ms"></rect>';if(v.ok)fr+='<rect x="'+x+'" y="'+yTop+'" width="'+bw+'" height="'+oh+'" rx="1" fill="var(--accent)" data-tip="'+esc(tt)+'" style="animation-delay:'+(i*25)+'ms"></rect>';return fr+lab}).join('');var grid=function(v,y){return '<line x1="'+left+'" y1="'+y+'" x2="'+(W-pad)+'" y2="'+y+'" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 3"/><text x="'+(left-5)+'" y="'+(y+3)+'" font-size="9" text-anchor="end" fill="var(--muted)">'+v+'</text>'};var axis=grid(max,baseY-scale(max))+grid(Math.max(1,Math.round(max/2)),baseY-scale(Math.max(1,Math.round(max/2))))+grid(0,baseY);var trend=(function(){var pts=[];for(var i=0;i<data.length;i++){var s=0,n=0;for(var j=Math.max(0,i-6);j<=i;j++){s+=data[j].req;n++}var avg=s/n;var x=left+pad+i*(bw+2)+bw/2;pts.push(x+','+(baseY-scale(avg)))}return '<polyline points="'+pts.join(' ')+'" fill="none" stroke="var(--warn)" stroke-width="1.5" opacity="0.9"><title>'+t('trendTip')+'</title></polyline>'})();var labels=days.map(function(d,i){var x=left+pad+i*(bw+2);return '<text x="'+x+'" y="'+(baseY+12)+'" font-size="11" fill="var(--muted)">'+d.date.slice(5)+'</text>'}).join('');var legend='<div class="row" style="margin-bottom:6px"><span class="muted" style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:1px"></span>'+t('ok')+'</span><span class="muted" style="display:inline-flex;align-items:center;gap:4px;margin-left:12px"><span style="display:inline-block;width:10px;height:10px;background:var(--err);border-radius:1px"></span>'+t('err')+'</span><span class="muted" style="display:inline-flex;align-items:center;gap:4px;margin-left:12px"><span style="display:inline-block;width:14px;height:2px;background:var(--warn)"></span>'+t('avg7d')+'</span></div>';el.innerHTML=legend+'<svg viewBox="0 0 '+W+' '+h+'" style="width:100%;height:auto">'+axis+bars+trend+labels+'</svg>'}
function renderHeatmap(hours){var el=$('heatmap');if(!hours||!Object.keys(hours).length){el.innerHTML='<p class="muted">'+t('noHourlyData')+'</p>';return}var dates=Object.keys(hours).sort().slice(-7);var max=1;dates.forEach(function(d){Object.keys(hours[d]).forEach(function(h){if(hours[d][h].requests>max)max=hours[d][h].requests})});var head='<tr><th>'+t('date')+'</th>'+Array.from({length:24},function(_,h){return '<th>'+h+'</th>'}).join('')+'</tr>';var rows=dates.map(function(d){var cells=Array.from({length:24},function(_,h){var v=hours[d][String(h).padStart(2,'0')];var n=v?v.requests:0;var a=n?Math.max(0.08,Math.min(1,n/max)):0;var bg=a?'rgba(148,226,213,'+a.toFixed(2)+')':'';return '<td style="background:'+bg+'" data-tip="'+esc(d+' '+h+':00Z: '+n+' req')+'"></td>'}).join('');return '<tr><td class="muted">'+d.slice(5)+'</td>'+cells+'</tr>'}).join('');el.innerHTML='<table class="heatgrid"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table>'}
function sparkline(days){if(!days||!days.length)return '<span class="muted">-</span>';var max=1;days.forEach(function(d){if(d.requests>max)max=d.requests});var bars=days.slice(0,14).map(function(d){var hh=Math.max(2,Math.round((d.requests/max)*20));var cls=d.errors>0?(d.errors>=d.requests?'err':'warn'):'';return '<i class="'+cls+'" style="height:'+hh+'px" title="'+d.date+': '+d.requests+' req, '+d.errors+' err"></i>'}).join('');return '<span class="spark">'+bars+'</span>'}
function resetTime(){var now=new Date();var next=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));var diff=next-now;var h=Math.floor(diff/3600000),m=Math.floor(diff%3600000/60000);return (h<10?'0'+h:h)+':'+(m<10?'0'+m:m)}
function renderKeys(keys){var el=$('keys');if(!keys||!keys.length){el.innerHTML='<p class="muted">'+t('noKeys')+'</p>';return}var rt=resetTime();var rows=keys.map(function(k){var lim=k.limit?t('dailyLimitN',k.limit):t('unlimited');var res=k.limit?'<span class="muted">'+t('resetsAt',rt)+'</span>':'';var st=k.enabled?'<span class="pill ok">'+t('on')+'</span>':'<span class="pill bad">'+t('off')+'</span>';var act=k.managed?'<button class="ghost small" onclick="removeKey(\\''+esc(k.prefix)+'\\')">'+t('del')+'</button> <button class="ghost small" onclick="toggleKey(\\''+esc(k.prefix)+'\\',\\''+(k.enabled?'disable':'enable')+'\\')">'+(k.enabled?t('dis'):t('en'))+'</button>':'<span class="muted">env</span>';return '<tr><td><code>'+esc(k.prefix)+'&hellip;</code></td><td>'+st+'</td><td>'+esc(lim)+'</td><td class="num">'+k.today_requests+'</td><td class="num">'+k.today_successes+'</td><td class="num">'+k.today_errors+'</td><td>'+sparkline(k.days)+'</td><td>'+res+'</td><td>'+act+'</td></tr>'}).join('');el.innerHTML='<table><thead><tr><th>'+t('key')+'</th><th>'+t('state')+'</th><th>'+t('limit')+'</th><th class="num">'+t('req')+'</th><th class="num">'+t('ok')+'</th><th class="num">'+t('err')+'</th><th>14d</th><th>'+t('reset')+'</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'}
function renderAccounts(a){var rows=a.accounts.map(function(x){var st=x.alive===true?'<span class="pill ok">'+t('alive')+'</span>':x.alive===false?'<span class="pill bad">'+t('invalid')+'</span>':'<span class="pill unk">'+t('unknown')+'</span>';var lu=x.last_used_at?new Date(x.last_used_at).toLocaleTimeString():'<span class="muted">-</span>';var le=x.last_error?esc(x.last_error)+' <span class="muted">('+((x.last_error_at||'').slice(5,19).replace('T',' '))+')</span>':'<span class="muted">-</span>';return '<tr><td><code>'+esc(x.token_prefix)+'&hellip;</code></td><td>'+st+'</td><td>'+esc(x.uid||'-')+'</td><td class="num">'+(x.requests||0)+'</td><td>'+lu+'</td><td>'+le+'</td></tr>'}).join('');$('accounts').innerHTML='<table><thead><tr><th>'+t('account')+'</th><th>'+t('status')+'</th><th>UID</th><th class="num">'+t('req')+'</th><th>'+t('lastUsed')+'</th><th>'+t('lastError')+'</th></tr></thead><tbody>'+rows+'</tbody></table>'}
function qcell(v){if(!v||v.used==null||v.limit==null)return '<span class="qcell">- / -</span>';var ratio=v.limit>0?v.used/v.limit:0;var cls=ratio>=1?'exh':ratio>=0.8?'warn':'ok';var tt=v.used+' / '+v.limit+(v.reset_at?' · '+t('resetAt',v.reset_at.slice(11,16)+'Z'):'')+(v.reset_time_zone?' '+v.reset_time_zone:'');return '<span class="qcell '+cls+'" title="'+tt+'">'+v.used+' / '+v.limit+'</span>'}
function renderMatrix(a,modelIds){var el=$('quotaMatrix');var accts=a.accounts||[];var models=modelIds&&modelIds.length?modelIds:[];if(!models.length){var seen={};accts.forEach(function(x){Object.keys(x.quota||{}).forEach(function(m){seen[m]=1})});models=Object.keys(seen)}if(!accts.length){el.innerHTML='<p class="muted">'+t('noAccounts')+'</p>';return}var head='<thead><tr><th>Account</th>'+models.map(function(m){return '<th title="'+esc(m)+'">'+esc(m.replace(/^.*\\//,''))+'</th>'}).join('')+'</tr></thead>';var body=accts.map(function(x){var q=x.quota||{};return '<tr><td><code>'+esc(x.token_prefix)+'&hellip;</code><div class="muted">'+t('probedAt',((x.checked_at||'').slice(11,16)||'?')+'Z')+'</div></td>'+models.map(function(m){return '<td>'+qcell(q[m])+'</td>'}).join('')+'</tr>'}).join('');el.innerHTML='<table>'+head+'<tbody>'+body+'</tbody></table>'}
function renderAcctErrors(a){var el=$('acctErrors');var rows=[];(a.accounts||[]).forEach(function(x){var es=x.last_errors||[];es.forEach(function(e){var st=e.status?'<span class="pill '+(e.status>=500?'bad':e.status>=400?'warn':'ok')+'">'+e.status+'</span>':'<span class="pill unk">?</span>';rows.push('<tr><td><code>'+esc(x.token_prefix)+'&hellip;</code></td><td>'+st+'</td><td>'+esc((e.time||'').slice(5,19).replace('T',' '))+'</td><td>'+esc(e.message||'')+'</td></tr>')})});el.innerHTML=rows.length?'<table><thead><tr><th>'+t('account')+'</th><th>'+t('status')+'</th><th>'+t('time')+'</th><th>'+t('message')+'</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>':'<p class="muted">'+t('noErrors')+'</p>'}
function renderLog(l){var el=$('reqlog');if(!l||!l.entries||!l.entries.length){el.innerHTML='<p class="muted">'+t('noRequests')+'</p>';return}var rows=l.entries.map(function(e){var st=e.status<400?'<span class="pill ok">'+e.status+'</span>':e.status===429?'<span class="pill warn">429</span>':'<span class="pill bad">'+e.status+'</span>';return '<tr><td class="muted">'+esc((e.t||'').slice(11,19))+'</td><td><code>'+esc(e.model||'')+'</code></td><td><code>'+esc(e.key||'')+'</code></td><td>'+st+'</td><td class="num">'+(e.ms!=null?e.ms+'ms':'')+'</td><td><code>'+esc(e.acct||'-')+'</code></td></tr>'}).join('');el.innerHTML='<table><thead><tr><th>'+t('time')+'</th><th>'+t('model')+'</th><th>'+t('key')+'</th><th>'+t('status')+'</th><th class="num">'+t('latency')+'</th><th>'+t('account')+'</th></tr></thead><tbody>'+rows+'</tbody></table>'}
async function loadModels(){try{var m=await (await fetch('/admin/models')).json();STORE_MODELS=m.data;MODEL_IDS=m.data.map(function(x){return x.id});renderModels(m.data)}catch(e){$('models').textContent=t('modelsLoadFailed',e.message)}}
var DONUT_COLORS=['#94e2d5','#89b4fa','#a6e3a1','#f9e2af','#cba6f7','#f38ba8','#fab387','#b4befe'];
function renderDonut(byModel){var el=$('modelShare');if(!byModel||!Object.keys(byModel).length){el.innerHTML='<p class="muted">'+t('noModelUsage')+'</p>';return}var total=0;var entries=Object.keys(byModel).map(function(m){total+=byModel[m].requests||0;return{m:m,req:byModel[m].requests||0}}).sort(function(a,b){return b.req-a.req});if(!total){el.innerHTML='<p class="muted">'+t('noModelUsage')+'</p>';return}var r=52,c=2*Math.PI*r;var off=0;var segs=entries.map(function(e,i){var frac=e.req/total;var seg='<circle r="'+r+'" cx="70" cy="70" fill="none" stroke="'+DONUT_COLORS[i%DONUT_COLORS.length]+'" stroke-width="16" stroke-dasharray="'+(frac*c).toFixed(1)+' '+(c-frac*c).toFixed(1)+'" stroke-dashoffset="'+(-off*c).toFixed(1)+'" transform="rotate(-90 70 70)" data-tip="'+esc(e.m+': '+e.req+' req ('+Math.round(frac*100)+'%)')+'"></circle>';off+=frac;return seg}).join('');var legend=entries.map(function(e,i){return '<div class="muted" style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="display:inline-block;width:10px;height:10px;background:'+DONUT_COLORS[i%DONUT_COLORS.length]+';border-radius:1px"></span><code>'+esc(e.m)+'</code><b>'+e.req+'</b><span>('+Math.round(e.req/total*100)+'%)</span></div>'}).join('');el.innerHTML='<div class="row" style="align-items:flex-start"><svg viewBox="0 0 140 140" style="width:150px;height:auto">'+segs+'<text x="70" y="75" text-anchor="middle" font-size="15" fill="var(--text)">'+total+'</text></svg><div style="margin-left:14px;flex:1;min-width:240px">'+legend+'</div></div>'}
function renderModels(list){$('models').innerHTML='<table><thead><tr><th>'+t('apiModelId')+'</th><th>'+t('upstreamAgent')+'</th><th>'+t('state')+'</th><th></th></tr></thead><tbody>'+list.map(function(x){var pill=x.disabled?'<span class="pill bad">'+t('disabled')+'</span>':'<span class="pill ok">'+t('enabled')+'</span>';var btn=x.disabled?'<button class="ghost small" onclick="toggleModel(\\''+esc(x.id)+'\\',false)">'+t('enable')+'</button>':'<button class="ghost small" onclick="toggleModel(\\''+esc(x.id)+'\\',true)">'+t('disable')+'</button>';return '<tr><td><code>'+esc(x.id)+'</code></td><td><code>'+esc(x.agent)+'</code></td><td>'+pill+'</td><td>'+btn+'</td></tr>'}).join('')+'</tbody></table>'}
async function toggleModel(id,disabled){try{var r=await fetch('/admin/models/toggle',{method:'POST',headers:Object.assign(authHeaders(),{'content-type':'application/json'}),body:JSON.stringify({model:id,disabled:disabled})});var j=await r.json();if(!r.ok){throw Error((j.error&&j.error.message)||('HTTP '+r.status))}STORE_MODELS=null;MODEL_IDS=(j.data||[]).map(function(x){return x.id});renderModels(j.data||[]);setStatus(disabled?t('modelDisabled',id):t('modelEnabled',id),'ok')}catch(e){setStatus(e.message,'err')}}
async function addKey(){var k=$('newKey').value.trim();var lim=parseInt($('newKeyLimit').value||'0',10);if(!k){setStatus(t('enterKey'),'err');return}try{var r=await fetch('/admin/keys',{method:'POST',headers:Object.assign(authHeaders(),{'content-type':'application/json'}),body:JSON.stringify({action:'add',key:k,limit:isFinite(lim)?lim:0})});var j=await r.json();if(!r.ok){throw Error((j.error&&j.error.message)||('HTTP '+r.status))}$('newKey').value='';$('newKeyLimit').value='';loadAll(false);setStatus(t('keyAdded'),'ok')}catch(e){setStatus(e.message,'err')}}
async function removeKey(prefix){var k=prompt(t('promptRemove',prefix),'');if(!k)return;try{var r=await fetch('/admin/keys',{method:'POST',headers:Object.assign(authHeaders(),{'content-type':'application/json'}),body:JSON.stringify({action:'remove',key:k})});var j=await r.json();if(!r.ok){throw Error((j.error&&j.error.message)||('HTTP '+r.status))}loadAll(false);setStatus(t('keyRemoved'),'ok')}catch(e){setStatus(e.message,'err')}}
async function toggleKey(prefix,action){var k=prompt(action==='disable'?t('promptDisable',prefix):t('promptEnable',prefix),'');if(!k)return;try{var r=await fetch('/admin/keys',{method:'POST',headers:Object.assign(authHeaders(),{'content-type':'application/json'}),body:JSON.stringify({action:action,key:k})});var j=await r.json();if(!r.ok){throw Error((j.error&&j.error.message)||('HTTP '+r.status))}loadAll(false);setStatus(action==='disable'?t('keyDisabled'):t('keyEnabled'),'ok')}catch(e){setStatus(e.message,'err')}}
async function testAlert(){try{var r=await fetch('/admin/alerts/test',{method:'POST',headers:authHeaders()});var j=await r.json();$('alertResult').textContent=j.ok?t('sent'):t('failed',j.error||'?');$('alertResult').style.color=j.ok?'var(--ok)':'var(--err)'}catch(e){$('alertResult').textContent=t('error_',e.message)}}
async function toggleMaint(){try{var r=await fetch('/admin/maintenance',{method:'POST',headers:Object.assign(authHeaders(),{'content-type':'application/json'}),body:JSON.stringify({on:$('maintState').textContent==='off'})});var j=await r.json();if(!r.ok){throw Error((j.error&&j.error.message)||('HTTP '+r.status))}$('maintState').textContent=j.maintenance?t('on'):t('off');$('maintBtn').textContent=j.maintenance?t('disable'):t('enable');setStatus(j.maintenance?t('maintOn'):t('maintOff'),'ok')}catch(e){setStatus(e.message,'err')}}
async function loadState(){try{var s=await get('/admin/state');var rows=(s.accounts||[]).map(function(a){var cd=a.cooldown_until?'<span class="pill warn">'+a.cooldown_seconds+'s</span>':'<span class="muted">-</span>';var al=a.last_alerted_at?(a.last_alerted_at||'').slice(11,19):'-';var sess=(a.sessions||[]).map(function(x){return '<div class="muted">'+esc(x.model)+' <span class="muted">'+t('exp',((x.expiresAt||'').slice(11,19)||'?'))+'</span></div>'}).join('')||'<span class="muted">-</span>';return '<tr><td><code>'+esc(a.token_prefix)+'&hellip;</code></td><td>'+(a.alive===true?'<span class="pill ok">'+t('alive')+'</span>':a.alive===false?'<span class="pill bad">'+t('dead')+'</span>':'<span class="pill unk">?</span>')+'</td><td>'+cd+'</td><td>'+al+'</td><td>'+sess+'</td></tr>'}).join('');$('stateTable').innerHTML='<table><thead><tr><th>'+t('account')+'</th><th>'+t('alive')+'</th><th>'+t('cooldown')+'</th><th>'+t('lastAlert')+'</th><th>'+t('sessions')+'</th></tr></thead><tbody>'+rows+'</tbody></table>'}catch(e){$('stateTable').innerHTML='<p class="muted">State load failed: '+esc(e.message)+'</p>'}}
function setAccent(c,save){document.documentElement.style.setProperty('--accent',c);if(save!==true)localStorage.setItem('f2a-accent',c);var dots=document.querySelectorAll('.accdot');dots.forEach(function(d){d.style.background=d.dataset.c===c?'':'none'})}
function showTip(e,html){var t=$('tip');t.innerHTML=html;t.style.left=(e.clientX+12)+'px';t.style.top=(e.clientY+12)+'px';t.style.display='block'}
function hideTip(){$('tip').style.display='none'}
function wireTip(id){var el=$(id);el.addEventListener('mouseover',function(e){var n=e.target&&e.target.closest?e.target.closest('[data-tip]'):null;if(n)showTip(e,n.getAttribute('data-tip'))});el.addEventListener('mouseout',function(){hideTip()})}
function csvEscape(s){s=String(s==null?'':s);return s.indexOf('"')>=0||s.indexOf(',')>=0?'"'+s.replace(/"/g,'""')+'"':s}
function exportCsv(){var u=LAST_USAGE;if(!u){setStatus(t('loadDataFirst'),'err');return}var lines=['date,requests,successes,errors,input_chars,output_chars'];(u.days||[]).forEach(function(d){lines.push([d.date,d.requests,d.successes,d.errors,d.inputChars||0,d.outputChars||0].join(','))});lines.push('');lines.push('model,requests,successes,errors');Object.keys(u.by_model||{}).forEach(function(m){var v=u.by_model[m];lines.push([csvEscape(m),v.requests,v.successes,v.errors].join(','))});lines.push('');lines.push('key,limit,today_requests');(u.keys||[]).forEach(function(k){lines.push([csvEscape(k.prefix),k.limit||'',k.today_requests].join(','))});var blob=new Blob([lines.join(String.fromCharCode(10))],{type:'text/csv'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='freebuff2api-usage.csv';document.body.appendChild(a);a.click();a.remove();setStatus('CSV downloaded','ok')}
boot();loadModels();setInterval(function(){if(KEY&&!REFRESHING)loadAll(false)},30000);setInterval(function(){if(KEY)updateReset()},1000);wireTip('chart');wireTip('modelShare');wireTip('heatmap');
</script>`;
}function adminPageResponse(request) {
  const lang = langOf(request);
  return new Response(pageShell("freebuff2api console - admin", adminBody(lang)), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders() } });
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
  if (body.stream) chat.stream_options = { include_usage: true };
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
      if (tc.type === "auto") chat.tool_choice = "auto";
      else if (tc.type === "any") chat.tool_choice = "required"; // Anthropic any = model MUST call a tool; OpenAI equivalent is "required"
      else if (tc.type === "none") chat.tool_choice = "none";
      else if (tc.type === "tool" && tc.name) chat.tool_choice = { type: "function", function: { name: tc.name } };
    }
  }

  for (const m of body.messages || []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "user") {
      const hasToolResult = Array.isArray(m.content) && m.content.some((c) => c && c.type === "tool_result");
      if (hasToolResult) {
        const textParts = [];
        for (const part of m.content) {
          if (!part || typeof part !== "object") continue;
          if (part.type === "tool_result") {
            chat.messages.push({ role: "tool", tool_call_id: part.tool_use_id || "", content: anthropicContentToChat(part.content) });
          } else if (part.type === "text" && part.text) {
            textParts.push(part.text);
          }
        }
        // OpenAI requires tool messages contiguous after the assistant tool_calls
        // message; emit interleaved text AFTER them so tool_call_id linkage holds.
        if (textParts.length) chat.messages.push({ role: "user", content: textParts.join("\n") });
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
  let finalReason = "end_turn";
  let totalInput = 0;
  let totalOutput = 0;

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
    if (!started) {
      evt(ctl, "message_start", {
        message: {
          id: "msg_" + Math.random().toString(36).slice(2, 12),
          type: "message",
          role: "assistant",
          model: mc.id,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: totalInput, output_tokens: 0 },
        },
      });
    }
    for (const [, bi] of toolsOpen) evt(ctl, "content_block_stop", { index: bi });
    toolsOpen.clear();
    closeOpen(ctl);
    evt(ctl, "message_delta", { delta: { stop_reason: finalReason, stop_sequence: null }, usage: { output_tokens: totalOutput } });
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
        if (obj.usage) {
          // OpenAI-compatible upstreams attach usage to the final chunk
          totalInput = obj.usage.prompt_tokens || totalInput;
          totalOutput = obj.usage.completion_tokens || totalOutput;
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
              usage: { input_tokens: totalInput, output_tokens: 0 },
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
          // OpenAI-compatible upstreams send usage in a trailing chunk AFTER the
          // finish_reason chunk; keep consuming until [DONE]/flush so it lands.
          finalReason = ch.finish_reason === "tool_calls" ? "tool_use" : ch.finish_reason === "length" ? "max_tokens" : "end_turn";
        }
      }
    },
    flush(ctl) {
      end(ctl);
    },
  });
}

// Anthropic formatında hata gövdesi: {"type":"error","error":{"type","message"}}
function anthropicError(message, type, status, retryAfter) {
  const st = status || (type === "invalid_request_error" ? 400 : 500);
  const h = { ...corsHeaders() };
  if (retryAfter) h["Retry-After"] = retryAfter;
  return jsonResponse({ type: "error", error: { type: type || "api_error", message } }, st, h);
}

// Anthropic /v1/messages girişi: dönüştür → handleChat → geri çevir
// Anthropic /v1/messages/count_tokens: tahmini sayım (upstream'e istek atmaz, kota yemez).
// Claude Code / Anthropic SDK token tahmini ve auto-compaction için 404 yerine yaklaşık değer döner.
function estimateTokens(o) {
  if (typeof o === "string") return o.length;
  if (Array.isArray(o)) return o.reduce((a, x) => a + estimateTokens(x), 0);
  if (o && typeof o === "object") return Object.keys(o).reduce((a, k) => a + k.length + estimateTokens(o[k]), 0);
  return 0;
}
async function handleCountTokens(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return anthropicError("Invalid JSON", "invalid_request_error");
  }
  const mc = MODELS.find((m) => m.id === anthropicModelToOpenAI(body.model, env)) || MODELS[0];
  const chat = anthropicToChatParams(body, mc);
  let n = estimateTokens(chat.messages) + estimateTokens(chat.system || "");
  n = Math.ceil(n / 4);
  return jsonResponse({ input_tokens: n }, 200);
}

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
    let msg = "Upstream error";
    try {
      const j = await resp.json();
      if (j && j.error) msg = j.error.message || msg;
    } catch {}
    // Anthropic error.type enum'u dışındaki tipleri (maintenance/config_error vs.)
    // yayma; durum koduna göre standart tipe eşle, 429'da Retry-After'ı koru.
    const typMap = { 400: "invalid_request_error", 401: "authentication_error", 403: "permission_error", 404: "not_found_error", 429: "rate_limit_error", 503: "overloaded_error" };
    return anthropicError(msg, typMap[resp.status] || "api_error", resp.status, resp.headers.get("retry-after") || undefined);
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
  if (await isMaintenance(env)) {
    return jsonResponse({ error: { message: "Bridge in maintenance mode", type: "maintenance" } }, 503);
  }
  if (await isModelDisabled(env, mc.id)) {
    return jsonResponse({ error: { message: "Model disabled: " + mc.id, type: "model_not_found" } }, 404);
  }
  const keyId = keyAccountId(apiKey);
  const reqStarted = Date.now();
  let usedAcct = null;
  const limit = keyLimit(env, apiKey);
  if (limit > 0 && (await keyTodayUsed(env, keyId)) >= limit) {
    return jsonResponse({ error: { message: "Daily request limit reached for key " + keyPrefixOf(apiKey) + "... (limit " + limit + ")", type: "rate_limit_error" } }, 429);
  }
  if (!keyModelAllowed(env, apiKey, mc.id)) {
    return jsonResponse({ error: { message: "Model not allowed for this key: " + mc.id, type: "permission_error" } }, 403);
  }
  const modelLimit = modelLimitOf(env, mc.id);
  if (modelLimit > 0 && (await modelTodayUsed(env, mc.id)) >= modelLimit) {
    return jsonResponse({ error: { message: "Daily model limit reached for " + mc.id + " (limit " + modelLimit + ")", type: "rate_limit_error" } }, 429);
  }
  await maybeFlush(env);
  const debug = env.FREEBUFF_DEBUG === "true";
  const pool = parseAccounts(env);
  if (pool.length === 0) return jsonResponse({ error: { message: " FREEBUFF_TOKEN ", type: "config_error" } }, 503);

  const nowMs = Date.now();
  const warm = pool.some((a) => !cooldowns.has(a.token) || cooldowns.get(a.token) <= nowMs);
  if (!warm) {
    let minUntil = Infinity;
    for (const a of pool) { const u = cooldowns.get(a.token) || nowMs; if (u < minUntil) minUntil = u; }
    const retryAfter = Math.max(1, Math.ceil((minUntil - nowMs) / 1000));
    return jsonResponse({ error: { message: "All Freebuff accounts cooling down; retry later", type: "rate_limit_error", retry_after: retryAfter } }, 429, { "Retry-After": String(retryAfter) });
  }

  bump("requests", 1, mc, keyId);
  bump("inputChars", estimateInputChars(chatParams.messages), mc, keyId);

  // ：（/429/428 /run ），。
  // （>1 、），。
  let lastErrMsg = "";
  let lastStatus = 502;
  let lastRetryAfter = null;
  for (let acctTry = 0; acctTry < pool.length; acctTry++) {
    const acct = pickToken(env, mc.session);
    const token = acct ? acct.token : null;
    if (!token) break;
    recordAccountUse(token);
    usedAcct = token;
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
        // Ölü hesap 401/403 gürültüsü yerine gerçek upstream hatasını öne çıkar:
        // ilk hata kaydedilir, ama 401/403'ten sonraki gerçek hata (500/429 vs.) onu ezer.
        if (!lastErrMsg || ((resp.status !== 401 && resp.status !== 403) && (lastStatus === 401 || lastStatus === 403))) {
          lastErrMsg = "upstream error: " + (errText || "").slice(0, 300);
          lastStatus = resp.status;
          const ra = resp.headers.get("retry-after");
          if (ra) lastRetryAfter = ra;
        }
        if (debug) console.log(`[acct ${acctTry + 1}] failed ${resp.status}, switch account`);
        continue;
      }

      if (isStream) {
        bump("successes", 1, mc, keyId);
        const { readable, writable } = new TransformStream();
        if (mode === "responses") pipeUpstreamToResponsesStream(resp.body, writable, mc);
        else pipeUpstreamToClient(resp.body, writable);
        logRequest({ t: new Date().toISOString(), model: mc.id, key: keyPrefixOf(apiKey), mode, status: 200, ms: Date.now() - reqStarted, acct: usedAcct ? usedAcct.slice(0, 8) : null });
        return new Response(readable, { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...corsHeaders() } });
      }

      if (mode === "responses") {
        const rr = await responsesToNonStream(resp.body, mc);
        bump("successes", 1, mc, keyId);
        bump("outputChars", outputCharsOf(rr), mc, keyId);
        logRequest({ t: new Date().toISOString(), model: mc.id, key: keyPrefixOf(apiKey), mode, status: 200, ms: Date.now() - reqStarted, acct: usedAcct ? usedAcct.slice(0, 8) : null });
        return jsonResponse(rr, 200);
      }

      const agg = await streamToNonStream(resp.body, mc.upstream);
      bump("successes", 1, mc, keyId);
      bump("outputChars", outputCharsOf(agg), mc, keyId);
      logRequest({ t: new Date().toISOString(), model: mc.id, key: keyPrefixOf(apiKey), mode, status: 200, ms: Date.now() - reqStarted, acct: usedAcct ? usedAcct.slice(0, 8) : null });
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
  // Upstream durumunu koru (429/403/503 vs.) ve Anthropic/OpenAI enum tipini eşle;
  // 429'da Retry-After'ı upstream metninden çıkar (retryAfterMs / "try again in").
  const typeMap = { 400: "invalid_request_error", 401: "authentication_error", 403: "permission_error", 404: "not_found_error", 429: "rate_limit_error", 503: "overloaded_error" };
  const errType = typeMap[lastStatus] || "api_error";
  const retryAfter = lastStatus === 429 ? (lastRetryAfter !== null && lastRetryAfter !== undefined ? Math.max(1, parseInt(lastRetryAfter, 10) || 1) : Math.max(1, Math.round(parseCooldown(lastErrMsg, 429) / 1000))) : null;
  logRequest({ t: new Date().toISOString(), model: mc.id, key: keyPrefixOf(apiKey), mode, status: lastStatus, ms: Date.now() - reqStarted, acct: usedAcct ? usedAcct.slice(0, 8) : null });
  return jsonResponse({ error: { message: lastErrMsg, type: errType, retry_after: retryAfter } }, lastStatus, retryAfter ? { "Retry-After": String(retryAfter) } : {});
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
  return key === (env.FREEBUFF_ADMIN_KEY || "").trim() || allKeys(env).some((x) => x.enabled !== false && x.key === key) ? key : null;
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
            // Deno KV atomic().sum() requires bigint (KvU64), not number.
            sum: async (key, n) => { if (n) await kv.atomic().sum(key, BigInt(Math.round(n))).commit(); },
            get: async (key) => { const v = (await kv.get(key)).value; return v == null ? null : Number(v); },
            put: async (key, value) => { await kv.set(key, value); },
            del: async (key) => { await kv.delete(key); },
            list: async (prefix) => { const out = []; const it = kv.list({ prefix }); for await (const e of it) out.push({ key: e.key, value: Number(e.value) }); return out; },
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
  const hh = String(new Date().getUTCHours()).padStart(2, "0");
  const hd = usageStats.byHour.get(date + "\u0000" + hh) || { requests: 0, successes: 0, errors: 0 };
  hd[field] = (hd[field] || 0) + n;
  usageStats.byHour.set(date + "\u0000" + hh, hd);
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
let flushLogged = false; // debug: log the first KV sum failure once per isolate
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
  const byHour = [...usageStats.byHour.entries()];
  if (snap.requests === 0 && byModel.length === 0 && byDay.length === 0 && byDayModel.length === 0 && byKey.length === 0 && byHour.length === 0) return;
  usageStats.requests = 0; usageStats.successes = 0; usageStats.errors = 0;
  usageStats.inputChars = 0; usageStats.outputChars = 0;
  usageStats.byModel = new Map();
  usageStats.byDay = new Map();
  usageStats.byDayModel = new Map();
  usageStats.byKey = new Map();
  usageStats.byHour = new Map();
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
  for (const [k, v] of byHour) {
    const idx = k.lastIndexOf("\u0000");
    addObj(["usage", "hour", k.slice(0, idx), k.slice(idx + 1)], v);
  }
  // Persist each op; restore ONLY the ops that failed so a partial failure cannot
  // double-count already-committed sums on the next flush.
  const results = await Promise.allSettled(ops.map((o) => o.p));
  let failed = false;
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed = true;
      restoreDelta(ops[i].key, ops[i].n);
      if (!flushLogged) {
        flushLogged = true;
        console.error("[flush] KV sum failed:", r.reason && r.reason.stack ? r.reason.stack : r.reason);
      }
    }
  });
  if (failed) return;
  for (const [k, v] of byKey) {
    const idx = k.lastIndexOf("\u0000");
    const date = k.slice(0, idx), keyId = k.slice(idx + 1);
    const b = keyBase.get(keyId);
    if (b && b.date === date) b.requests += v.requests;
  }
  for (const [k, v] of byDayModel) {
    const idx = k.lastIndexOf("\u0000");
    const date = k.slice(0, idx), id = k.slice(idx + 1);
    const b = modelBase.get(id);
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
    if (key[1] === "hour") { mergeDelta(usageStats.byHour, key[2] + "\u0000" + key[3], key[4], n); return; }
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
  const k = allKeys(env).find((x) => x.key === key);
  return k ? k.limit : 0;
}

// KV-managed keys (admin UI): seeded from KV, merged over env keys. Hot path stays sync.
const extraKeys = []; // {key, limit, enabled, kv}
let keyRegistryLoaded = false;
async function ensureKeyRegistry(env) {
  if (keyRegistryLoaded) return;
  keyRegistryLoaded = true;
  try {
    const s = await getStore(env);
    for (const e of await s.list(["keys"])) {
      try {
        const v = typeof e.value === "string" ? JSON.parse(e.value) : e.value;
        extraKeys.push({ key: String(e.key[1]), limit: (v && v.limit) || 0, enabled: v ? v.enabled !== false : true, kv: true });
      } catch {}
    }
  } catch {}
}
function allKeys(env) {
  const base = parseApiKeys(env).map((k) => ({ key: k.key, limit: k.limit, enabled: true, kv: false }));
  const seen = new Set(base.map((k) => k.key));
  for (const k of extraKeys) if (!seen.has(k.key)) base.push(k);
  return base;
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

// ---------------------------------------------------------------------------
// v1.8.2 admin features: request log, maintenance, state, alerts, keys, limits
// ---------------------------------------------------------------------------

// --- request log (in-memory ring buffer, admin /admin/log) ---
const requestLog = [];
const REQUEST_LOG_MAX = 50;
function logRequest(entry) {
  requestLog.push(entry);
  if (requestLog.length > REQUEST_LOG_MAX) requestLog.shift();
}
function percentile(arr, p) {
  if (!arr || !arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
function handleAdminLog() {
  const entries = requestLog.map((e) => ({ ...e })).reverse();
  const modelTimes = {};
  const modelStats = {};
  for (const e of requestLog) {
    const m = modelStats[e.model] = modelStats[e.model] || { n: 0, ok: 0, err: 0 };
    m.n++;
    if (e.status < 400) m.ok++; else m.err++;
    (modelTimes[e.model] = modelTimes[e.model] || []).push(e.ms);
  }
  const by_model_latency = {};
  for (const [model, arr] of Object.entries(modelTimes)) {
    by_model_latency[model] = { n: arr.length, p50: percentile(arr, 0.5), p95: percentile(arr, 0.95), ok: modelStats[model].ok, err: modelStats[model].err };
  }
  return jsonResponse({ entries, by_model_latency, version: VERSION, time: new Date().toISOString() }, 200);
}

// --- maintenance mode (KV flag + env) ---
async function isMaintenance(env) {
  if ((env.FREEBUFF_MAINTENANCE || "").trim() === "true") return true;
  const s = await getStore(env);
  return !!(await s.get(["maintenance", "enabled"]));
}
async function handleMaintenance(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: { message: "Invalid JSON", type: "parse_error" } }, 400); }
  if (!body || typeof body.on !== "boolean") return jsonResponse({ error: { message: "on (boolean) required", type: "invalid_request_error" } }, 400);
  const s = await getStore(env);
  if (body.on) await s.put(["maintenance", "enabled"], 1);
  else await s.del(["maintenance", "enabled"]);
  return jsonResponse({ maintenance: body.on, version: VERSION }, 200);
}

// --- session/cooldown state inspector (/admin/state, current isolate only) ---
function handleAdminState(env) {
  const now = Date.now();
  const pool = parseAccounts(env);
  const accounts = pool.map((a) => {
    const cd = cooldowns.get(a.token);
    const al = alerted.get(a.token);
    const h = acctHealth.get(a.token);
    const sessions = [];
    for (const [k, v] of sessCache) {
      if (k.startsWith(a.token + ":")) sessions.push({ model: k.slice(a.token.length + 1), instanceId: v.instanceId, expiresAt: v.expiresAt || null });
    }
    return {
      token_prefix: a.token.slice(0, 8),
      cooldown_until: cd && cd > now ? new Date(cd).toISOString() : null,
      cooldown_seconds: cd && cd > now ? Math.ceil((cd - now) / 1000) : 0,
      last_alerted_at: al ? new Date(al).toISOString() : null,
      alive: h ? h.alive : null,
      sessions,
    };
  });
  return jsonResponse({ accounts, scope: "current isolate", time: new Date().toISOString(), version: VERSION }, 200);
}

// --- alert test (/admin/alerts/test) ---
async function handleAlertTest(env) {
  try {
    await notify(env, "[freebuff2api] test alert - channels OK");
    return jsonResponse({ ok: true, time: new Date().toISOString() }, 200);
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e.message || e) }, 500);
  }
}

// --- threshold alerts (checked on admin usage reads, deduped per day) ---
const thresholdAlerts = new Map(); // "rule:date" -> true
async function checkThresholds(env) {
  const webhook = env.FREEBUFF_ALERT_WEBHOOK;
  const tg = (env.FREEBUFF_TG_BOT_TOKEN || "").trim() && (env.FREEBUFF_TG_CHAT_ID || "").trim();
  if (!webhook && !tg) return;
  const today = todayStr();
  const s = await getStore(env);
  const requests = (await s.get(["usage", "total", "requests"])) || 0;
  const errors = (await s.get(["usage", "total", "errors"])) || 0;
  if (requests >= 20) {
    const rate = errors / requests;
    const t = parseFloat(env.FREEBUFF_ALERT_ERR_RATE || "0.2");
    if (rate >= t && !thresholdAlerts.has("err:" + today)) {
      thresholdAlerts.set("err:" + today, true);
      notify(env, "[freebuff2api] error rate " + Math.round(rate * 100) + "% >= " + Math.round(t * 100) + "% (" + errors + "/" + requests + ")");
    }
  }
  const qt = parseFloat(env.FREEBUFF_ALERT_QUOTA || "0.9");
  for (const a of parseAccounts(env)) {
    const info = await probeAccount(a.token);
    if (!info || !info.quota) continue;
    for (const [model, v] of Object.entries(info.quota)) {
      const used = typeof v.recentCount === "number" ? v.recentCount : typeof v.used === "number" ? v.used : null;
      const lim = typeof v.limit === "number" ? v.limit : null;
      if (used != null && lim > 0 && used / lim >= qt) {
        const key = "quota:" + a.token.slice(0, 8) + ":" + model + ":" + today;
        if (!thresholdAlerts.has(key)) {
          thresholdAlerts.set(key, true);
          notify(env, "[freebuff2api] quota " + Math.round((used / lim) * 100) + "% on " + model + " (" + used + "/" + lim + ") account " + a.token.slice(0, 8) + "...");
        }
      }
    }
  }
}

// --- model daily limits + key x model allowlist (env-configured) ---
const modelBase = new Map(); // model id -> { date, requests }
function modelLimitOf(env, id) {
  const raw = (env.FREEBUFF_MODEL_LIMITS || "").trim();
  if (!raw) return 0;
  for (const part of raw.split(",")) {
    const m = part.match(/^([^:]+):(\d+)$/);
    if (m && m[1] === id) return parseInt(m[2], 10);
  }
  return 0;
}
function keyModelAllowed(env, key, model) {
  const raw = (env.FREEBUFF_KEY_MODELS || "").trim();
  if (!raw) return true;
  for (const part of raw.split(";")) {
    const ci = part.indexOf(":");
    if (ci <= 0) continue;
    const k = part.slice(0, ci), list = part.slice(ci + 1);
    if (k === key) return list.split(",").map((x) => x.trim()).filter(Boolean).includes(model);
  }
  return true; // key not listed -> unrestricted
}
async function modelTodayUsed(env, id) {
  const date = todayStr();
  let b = modelBase.get(id);
  if (!b || b.date !== date) {
    const s = await getStore(env);
    b = { date, requests: (await s.get(["usage", "day", date, "model", id, "requests"])) || 0 };
    modelBase.set(id, b);
  }
  const d = usageStats.byDayModel.get(date + "\u0000" + id);
  return b.requests + (d ? d.requests : 0);
}

// --- KV-backed key management (/admin/keys: add|remove|limit|disable|enable) ---
async function handleAdminKeys(request, env) {
  await ensureKeyRegistry(env);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: { message: "Invalid JSON", type: "parse_error" } }, 400); }
  const action = body && body.action;
  const key = body && typeof body.key === "string" ? body.key.trim() : "";
  const limit = body && typeof body.limit === "number" && body.limit >= 0 ? Math.floor(body.limit) : 0;
  const s = await getStore(env);
  const list = () => allKeys(env).map((k) => ({ prefix: keyPrefixOf(k.key), limit: k.limit || null, enabled: k.enabled !== false, managed: !!k.kv }));
  if (action === "add") {
    if (key.length < 4) return jsonResponse({ error: { message: "key too short", type: "invalid_request_error" } }, 400);
    if (allKeys(env).some((k) => k.key === key)) return jsonResponse({ error: { message: "key already exists", type: "invalid_request_error" } }, 400);
    extraKeys.push({ key, limit, enabled: true, kv: true });
    await s.put(["keys", key], JSON.stringify({ limit, enabled: true }));
    return jsonResponse({ keys: list(), version: VERSION }, 200);
  }
  if (action === "remove") {
    const i = extraKeys.findIndex((k) => k.key === key);
    if (i >= 0) extraKeys.splice(i, 1);
    await s.del(["keys", key]);
    return jsonResponse({ keys: list(), version: VERSION }, 200);
  }
  const entry = allKeys(env).find((k) => k.key === key);
  if (!entry) return jsonResponse({ error: { message: "unknown key", type: "invalid_request_error" } }, 400);
  if (action === "limit") {
    if (!entry.kv) return jsonResponse({ error: { message: "env-managed key: set limit via FREEBUFF_API_KEYS", type: "invalid_request_error" } }, 400);
    entry.limit = limit;
    await s.put(["keys", key], JSON.stringify({ limit, enabled: entry.enabled }));
    return jsonResponse({ keys: list(), version: VERSION }, 200);
  }
  if (action === "disable" || action === "enable") {
    if (!entry.kv) return jsonResponse({ error: { message: "env-managed key: cannot disable", type: "invalid_request_error" } }, 400);
    entry.enabled = action === "enable";
    await s.put(["keys", key], JSON.stringify({ limit: entry.limit, enabled: entry.enabled }));
    return jsonResponse({ keys: list(), version: VERSION }, 200);
  }
  return jsonResponse({ error: { message: "action must be add|remove|limit|disable|enable", type: "invalid_request_error" } }, 400);
}
