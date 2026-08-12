# freebuff2api-workers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 🎉 欢迎使用与交流！有任何问题或想法欢迎提 Issue / PR。
> 开源协议：**[MIT](#-license)**

把 **freebuff/codebuff** 的免费模型暴露成 **OpenAI-compatible API**。单文件无依赖，**推荐 Docker 容器部署**（或自建 VPS 运行），适配任意 OpenAI SDK / 客户端（QwenPaw、Hermes、ChatGPT-Next-Web、LobeChat、one-api 等）。

> ⚠️ **部署方式重要提示**：Freebuff 官方已检测 Cloudflare Worker 部署（识别 `cf-worker` / `cf-ray` 等边缘标记），**在 CF 上部署会显著增加账号被封禁的风险**。因此本项目**不推荐 Cloudflare 部署**，推荐使用 **Docker 容器**或自建 VPS 运行（见下方「[🐳 Docker 容器化部署](#-docker-容器化部署)」）。

## ✨ 特性

- ⭐ **完整访问模式模型**：Cloudflare Workers 默认使用美国出口，通常可获得 Freebuff 完整访问模式；其中 DeepSeek V4 Flash 和 MiMo 2.5 属于官方特殊的非 Premium 模型
- 🔒 **常规模型基础额度**：除上述两个特殊模型外，普通模型按每日 6 次 session 的基础额度理解；不会宣传为无限量
- 🔁 **多账号自动切换**：撞额度自动冷却并切换，逗号分隔即可
- 💡 **优先复用活跃 session**：一个 session 约 1 小时有效，创建 session 才扣额度；只要当前模型的 session 还活跃就钉在同一账号上，用满再换，最大化额度利用率
- 📢 **广告与 streak 流程兼容**：创建新 session 前，Worker 会按官方客户端流程请求广告，并调用 `GET /api/v1/freebuff/streak` 尝试签到；相关请求失败会静默跳过，不阻塞聊天
- 🧩 **OpenAI 兼容**：`/v1/models`、`/v1/chat/completions`、`/v1/responses`（流式/非流式视接口支持情况而定）
- 📨 **Anthropic Messages API**：支持 `/v1/messages`、`/messages` 及对应的 `count_tokens` 路由，可供 Anthropic SDK / 兼容客户端尝试接入
- ❤️ **健康检查**：`GET /healthz`（免鉴权），方便监控探活
- 📦 **单文件部署**：无依赖，`worker.js` 一处代码，CF / Docker / VPS 通用

## 📨 Anthropic Messages API 支持

主代码已加入 Anthropic Messages API 适配，当前支持：

- `POST /v1/messages`
- `POST /messages`
- `POST /v1/messages/count_tokens`
- `POST /messages/count_tokens`
- Anthropic 消息格式转换为 Worker 内部使用的 OpenAI-compatible 请求
- 文本消息、`tool_use` / `tool_result`、`tool_choice`
- 非流式响应和 Anthropic SSE 流式响应
- Anthropic 风格的错误响应

> ⚠️ **测试说明**：当前项目维护者没有实际使用 Anthropic Messages API 的客户端环境，因此暂未完成真实 Anthropic 客户端的端到端测试。主代码和本地 stub / 回归测试已经处理并验证转换逻辑，但不代表所有 Anthropic SDK、工具调用组合和客户端行为都已覆盖。
>
> 如果你有 Anthropic Messages API 的实际使用场景，欢迎在不影响现有 OpenAI API 线路的前提下进行测试，并反馈请求格式、流式响应、工具调用或模型兼容性问题。反馈时请尽量附上脱敏后的请求结构、响应状态码和错误信息。
>
> Anthropic API 是新增的协议适配层，不改变现有 OpenAI `/v1/chat/completions`、`/v1/responses`、账号轮换、session 生命周期和 Freebuff 主调用链。

## ⭐ 特殊模型：DeepSeek V4 Flash 与 MiMo 2.5

Worker 通过 Cloudflare Workers 访问 Freebuff，上游通常会将请求识别为美国/完整访问模式。官方 Desktop 在完整模式下将下面两个模型归入 **unlimited 非 Premium 类别**；这里的 `unlimited` 主要表示模型分类和并发类别，**不是对所有账号、地区、接口和时间都作绝对无限量保证**：

| 模型 | 完整模式下的说明 |
|---|---|
| `deepseek/deepseek-v4-flash` | 官方非 Premium 模型；主力推荐，当前 Worker 探测未显示基础日限额 |
| `mimo/mimo-v2.5` | 官方非 Premium 模型；当前 Worker 探测未显示基础日限额 |

> ⚠️ 受限模式官方明确为 DeepSeek V4 Flash 和 MiMo 2.5 每天 6 个一小时 session；Worker 默认走美国出口，通常不属于该受限模式。最终是否可用及实际额度仍以 Freebuff 上游返回为准，官方规则也可能调整。

除这两个特殊模型外，普通模型统一按 **每日 6 次基础 session / 太平洋日** 理解（北京时间约 15:00 重置）。`referral`、`streak`、独立共享池和上游临时限制属于额外条件，不能据此宣传为无限量。

> 💡 **关于额度**：扣额度按「创建 session」计（不是每次对话）。一次 session 约 1 小时有效，期间多轮对话不重复扣。所以 4 个账号 × 每天 6 次 ≈ 全天覆盖。
>
> 📝 **广告与 streak 说明**：创建新 session 前，Worker 会按官方客户端流程请求广告，并调用 `GET /api/v1/freebuff/streak` 尝试签到。连续使用是否获得额外额度、额度增加多少，由 freebuff 官方服务端决定；该流程不是额度保证，也不会改变 session 本身的扣额度规则。

## 🚀 快速开始

1. 获取 freebuff token（见下方「获取 FREEBUFF_TOKEN」）
2. 部署服务（见下方「部署」，**推荐 Docker 容器部署**）
3. 配置环境变量：
   - `FREEBUFF_TOKEN`（必需）= 你的 token
   - `FREEBUFF_API_KEY`（可选）= 自定义访问 key，缺省 `freebuff-default-key`
4. 用任意 OpenAI 客户端连接：
   - **Base URL**: `http://localhost:8877/v1`（Docker 部署）或 `https://你的worker名.你的子域.workers.dev/v1`（CF 部署，不推荐）
   - **API Key**: `<FREEBUFF_API_KEY 的值>`

> 🌐 **自定义域名**：如果 `*.workers.dev` 域名访问不通（部分地区被墙/受限），可给 Worker 绑定自己的域名，Base URL 改为 `https://你的域名/v1`。配置方法见下方「[自定义域名](#-自定义域名)」。

## ❤️ 健康检查

部署后可用（**无需 API key**）：

```bash
curl https://你的worker.workers.dev/healthz
# {"status":"ok","version":"1.4.0","time":"..."}
```

- `version` 字段=当前部署的版本号，**每次部署版本号都会变化**，用于确认线上是否已更新（CF 边缘缓存有延迟，验证时等几秒或加随机参数）
- 适合接入 UptimeRobot / 自建监控探活

## 🔑 获取 FREEBUFF_TOKEN

freebuff 登录凭证（authToken）通过官方 CLI 同款**授权码轮询**获取。项目自带提取工具 `freebuff_tools/extract_freebuff.py`，交互方式与 `cline_oauth.py` 一致。

### 方式 A：GitHub Actions 工作流（推荐，远程提取）

仓库自带工作流 `.github/workflows/extract-token.yml`，在 GitHub Actions 里跑提取，授权链接和 token 只发到你的 Telegram，日志全程掩码（`::add-mask::`），不泄露敏感信息。

**第一步：配置 Secrets**（仓库 Settings → Secrets and variables → Actions）：

| Secret | 说明 |
|---|---|
| `TG_BOT_TOKEN` | Telegram bot token（找 @BotFather 创建，如 `123456:ABC-xxx`） |
| `TG_CHAT_ID` | 你的 Telegram 数字 chat id（给 @userinfobot 发消息获取） |

**第二步：运行工作流**：

1. 仓库页面 → **Actions** → 左侧 **获取 Freebuff authToken** → **Run workflow**
2. 可选填 `poll_timeout`（授权等待秒数，默认 300）和 `fingerprint`（留空自动生成）
3. 你的 TG 会收到登录链接，浏览器打开并登录 Google 账号
4. 脚本轮询到 token 后，完整 token 直接发到你 TG（Actions 日志里只有 `***`）
5. 跑完自动清理旧运行记录，只保留最新 1 条

> 没配 `TG_BOT_TOKEN` / `TG_CHAT_ID` 时工作流第一步直接失败，不会执行提取。

### 方式 B：本地提取

```bash
cd freebuff_tools
python3 extract_freebuff.py login   # 打印授权 URL 到终端，浏览器授权后自动轮询
python3 extract_freebuff.py show    # 显示全部账号：邮箱 + token + 存活状态 + 汇总一行一个
python3 extract_freebuff.py tgsend  # 测试 TG 连通性（配了 TG 时用）
```

本地运行 `login` 时，每个账号会**分键追加**保存到 `freebuff_tools/freebuff_credentials.json`（不覆盖已有账号，支持 Google / GitHub 登录，均自动记录）。该文件已被 `.gitignore` 忽略，不会提交到 GitHub；结构参考 `freebuff_tools/freebuff_credentials.example.json`。

其他实用命令：

```bash
python3 extract_freebuff.py export           # 汇总全部账号 token，一行一个，直接复制进 CF Workers 变量
python3 extract_freebuff.py quota            # 查用量
python3 extract_freebuff.py session          # 开/查 session
python3 extract_freebuff.py chat "你好"      # 发一条消息测试模型 API
```

> 💡 `show` 内部用 `GET /api/v1/freebuff/session` 探测每个账号（**不创建 session、0 消耗**），一次显示全部状态：存活 + 额度 / token 失效 / 被封禁 / 地区受限 / 额度用完。官方对 banned 账号会在所有接口返回 `status: banned`。多账号时 `export` 输出的每行 token 直接粘贴到 Cloudflare Worker 变量 `FREEBUFF_TOKEN`（换行分隔）即可。

## 🛠️ 部署

### 🐳 Docker 容器化部署（✅ 推荐）

> 适合本地/NAS/VPS 长期运行：不受 Cloudflare Workers 限制，**不会暴露 CF 边缘标记**（`cf-worker` / `cf-ray`），账号封禁风险显著低于 CF 部署；同一套代码也可在 CF 运行（不推荐）。

**快速部署：**

```bash
# 1. 准备目录，复制以下文件：worker.js server.js package.json Dockerfile docker-compose.yml
mkdir freebuff2api && cd freebuff2api

# 2. 配置 .env（API key + 可选 RELAY_KEY）
cat > .env <<'EOF'
FREEBUFF_API_KEY=your-api-key
RELAY_KEY=
EOF

# 3. 账号凭据：credentials/ 下每个账号一个 json（server.js 读取 authToken 字段）
mkdir -p credentials
# credentials/<任意名>.json = {"email": "...", "authToken": "...", "name": "..."}

# 4. 启动
chmod 600 .env credentials/*.json
docker compose up -d --build
```

启动后监听 `0.0.0.0:8787`（compose 映射到宿主机 `8877`），Base URL 为 `http://localhost:8877/v1`。

**环境变量：**

| 变量 | 说明 |
|---|---|
| `PORT` / `HOST` | 监听端口/地址，默认 `8787` / `0.0.0.0` |
| `FREEBUFF_API_KEY` | 本 API 访问 key（缺省 `freebuff-default-key`） |
| `FREEBUFF_DEBUG` | `true` 开启请求级调试日志 |
| `CODEBUFF_API` | 上游地址，默认空=直连 `https://www.codebuff.com`；走自建中继时设为中继域名 |
| `RELAY_KEY` | 中继密钥（`CODEBUFF_API` 指向带鉴权的中继时必填） |

> ⚠️ 容器内 `credentials/` 以只读方式挂载；`server.js` 启动时读取并组装 `FREEBUFF_TOKEN`（多账号逗号分隔）。

### Cloudflare Worker 部署（❌ 不推荐）

> **Freebuff 官方已检测 Cloudflare Worker 部署**（识别 `cf-worker` / `cf-ray` 等边缘标记，源码中已点名类似本项目的代理模式）。在 CF 上部署会显著增加账号被封禁的风险，**不推荐作为主要部署方式**；以下步骤仅保留给熟悉风险的用户参考。

worker 是**单文件**（`worker.js`），如仍需在 CF 部署：

### 方式 A：CF 控制台粘贴代码

最简单可控，不依赖本地环境、不关联 GitHub：

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **创建** → **创建 Worker**
2. 名称随意（如 `freebuff2api`），点击 **部署**
3. 进入该 Worker → **编辑代码** → 把 [worker.js](worker.js) 的**全部内容**粘贴进去，覆盖默认代码 → **部署**
4. 点 **设置 → 变量和机密 → 添加**：

   | 类型 | 名称 | 值 |
   |---|---|---|
   | 机密 | `FREEBUFF_TOKEN` | 你的 freebuff token（多账号用英文逗号分隔） |
   | 机密 | `FREEBUFF_API_KEY` | 自定义访问 key（可选，不设则用 `freebuff-default-key`） |

5. 部署完成后访问验证：

   ```bash
   curl https://你的worker.workers.dev/healthz          # 健康检查（无需 key）
   curl https://你的worker.workers.dev/v1/models \
     -H "Authorization: Bearer ***"           # 模型列表
   ```

> 每次改代码只需重复第 3 步：编辑代码 → 粘贴新内容 → 部署。**不推荐关联 GitHub 自动部署**（见下文）。
> ⚠️ **版本约定**：每次部署前务必把代码里的版本号（healthz 的 `version` 字段 + `X-Freebuff2api-Version` 响应头）升一档，否则无法确认线上是否已更新。

### 关联 GitHub 自动部署（❌ 不推荐）

虽然 CF 支持连接 GitHub 仓库自动部署，但**不建议用**：

- 每次 push 都会触发上线，本地未验证的改动可能直接打到线上
- 需要额外配置构建命令/根目录，仓库里的 `freebuff_tools/` 等辅助文件也会被拉取
- secrets 与分支状态容易混乱，出问题不好排查
- 本仓库含 token 提取脚本，自动同步增加暴露面

**推荐做法**：本地改代码 → Docker 容器/自建 VPS 部署，或（了解风险的前提下）手动粘贴到 CF 控制台 → 自己点部署，完全可控。

> 免费模型对出口 IP 有 US 限制，Cloudflare Workers 默认美国出口，无需额外配置。

### 🌐 自定义域名

默认域名 `https://你的worker名.你的子域.workers.dev` 在部分地区可能访问不通（如被墙/GFW 限制）。如果遇到 `workers.dev` 连接超时或无法访问，可以给 Worker 绑定自己的域名：

1. **添加自定义域**：CF 控制台 → 你的 Worker → **设置 → 域和路由** → **添加** → **自定义域**
2. 输入你的域名（如 `api.你的域名.com`），CF 会自动引导添加 DNS 记录（CNAME 指向 `你的worker名.你的子域.workers.dev`）
3. 等待 DNS 生效（一般几分钟），自动签发免费 SSL 证书
4. 之后 Base URL 改为：`https://api.你的域名.com/v1`

> 要求：域名必须托管在 Cloudflare（或把 DNS 转到 CF）。workers.dev 子域无需配置，绑定自定义域只是给访问不通的地区多一条可用路径。

## 💬 调用示例

```bash
# 健康检查
curl https://你的worker.workers.dev/healthz

# 模型列表
curl https://你的worker.workers.dev/v1/models \
  -H "Authorization: Bearer <API_KEY>"

# 非流式
curl https://你的worker.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \
  -d '{"model":"deepseek/deepseek-v4-flash","messages":[{"role":"user","content":"你好"}]}'

# 流式
curl -N https://你的worker.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \
  -d '{"model":"deepseek/deepseek-v4-flash","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

## 📋 模型列表

> 映射来源：Freebuff Desktop 0.0.51（`orchestrator.js` 官方 `FREEBUFF_ROOT_AGENT_ID_BY_MODEL`，2026-08-07 实测同步）。
> Worker 通过 Cloudflare Workers 访问上游，默认使用美国出口，按 Freebuff 完整访问模式说明。除 Flash 和 MiMo 这两个官方特殊的非 Premium 模型外，其余模型按**每日 6 次基础 session / 太平洋日**理解（北京时间约 15:00 重置）；额度按「创建 session」扣减，一个 session 约 1 小时有效。

### ⭐ 完整模式特殊模型：非 Premium

官方 Desktop 在完整访问模式下将下面两个模型归入 `unlimited` 非 Premium 类别。这里的 `unlimited` 主要表示官方模型分类和 Desktop 并发类别，**不是任何账号、接口或时间段的绝对无限量承诺**。Worker 当前探测也未在 `rateLimitsByModel` 中看到它们的基础日限额。

| API 模型名 | session 模型 | 上游 agentId | 说明 |
|---|---|---|---|
| `deepseek/deepseek-v4-flash` | 同左 | `base2-free-deepseek-flash` | 完整模式特殊模型；主力推荐 |
| `mimo/mimo-v2.5` | 同左 | `base2-free-mimo` | 完整模式特殊模型；均衡性能 |

> ⚠️ 受限模式官方明确将这两个模型限制为每天 6 个一小时 session。Worker 默认走美国出口，通常不属于该受限模式；最终可用性和实际额度仍以 Freebuff 上游返回为准。

### 🔒 普通模型：每日 6 次基础额度

以下模型没有“无限量”说明，统一按每日 6 次基础 session 处理；实际额度可能因账号、官方 `referral` / `streak`、通道状态或上游规则变化而不同。

| API 模型名 | session 模型 | 上游 agentId |
|---|---|---|
| `minimax/minimax-m3` | 同左 | `base2-free-minimax-m3` |
| `deepseek/deepseek-v4-pro` | 同左 | `base2-free-deepseek` |
| `openai/gpt-5.6-luna` | 同左 | `base2-free-luna` |
| `poolside/laguna-s-2.1` | 同左 | `base2-free-laguna-s-2-1` |
| `openrouter/poolside/laguna-s-2.1` | 同左 | `base2-free-laguna-s-2-1-openrouter` |
| `inclusionai/ling-3.0-flash:free` | 同左 | `base2-free-ling-3-flash` |
| `crof/greg-2-ultra` | 同左 | `base2-free-greg-2-ultra` |
| `crof/greg-2-super` | 同左 | `base2-free-greg-2-super` |
| `meta/muse-spark-1.2-contributor` | 同左 | `base2-free-muse-spark` |

### 🎁 独立资格或容量限制

以下模型不属于普通模型的直接开放池，是否能创建 session 由官方资格、共享容量或上游状态决定；即使获得资格，也不代表无限量使用：

| API 模型名 | session 模型 | 上游 agentId | 限制 |
|---|---|---|---|
| `z-ai/glm-5.2` | 同左 | `base2-free-glm` | 需 referral / streak 等官方资格，使用独立额度池 |
| `anthropic/claude-fable-5` | 同左 | `base2-free-fable` | 官方容量限制试用，可能按时段开放 |

> 📝 实测补充（2026-08-08）：`ling-3.0-flash:free` 上游可能返回 404 并提示改用付费 slug；`claude-fable-5` 免费账号建 session 可能被上游拒绝（`session_model_mismatch`）。这些现象属于上游可用性问题，不代表 Worker 映射失效。

## 👥 多账号

`FREEBUFF_TOKEN` 用英文逗号分隔多个 token（`token1,token2`）。撞额度（429/空响应）时自动冷却当前账号并切下一个。

**账号选择策略**（v1.4.0 起）：

1. 优先复用**已有活跃 session 缓存**的账号——session 约 1 小时有效，创建才扣额度，复用不扣；
2. 没有活跃缓存时才轮询下一个账号。

这样 4 个账号 × 每天 6 次 ≈ 全天覆盖，额度利用率最大化。

> 注意：冷却状态存在 Worker 内存，冷启动后重置；并发多实例间不共享。日常使用影响不大。

## 🔍 上游门控说明

freebuff 免费模型不是"拿 token 直接调 chat"就行，而是有严格生命周期：

```
session(开) → agent-runs(主+context-pruner 子run) → chat/completions
```

- **session**：`POST /api/v1/freebuff/session`（带 `x-freebuff-model`）拿 `instanceId`；可能排队（queued）。
- **agent-runs**：`START` 主 agent（如 `base2-free-deepseek-flash`）+ `context-pruner` 子 run，并 `record_step` / `finish_run`。chat 校验 run_id 存在，缺了会 4xx。
- **chat**：`POST /api/v1/chat/completions`，带 `codebuff_metadata.run_id`、`x-freebuff-instance-id`、SDK UA、`stop:['"cb_easp"']`、`provider.data_collection=deny`。**上游强制流式**，非流式请求需聚合（超时已放宽至 45s）。

Worker 已自动处理以上全部生命周期，无需手动干预。另：system 消息必须以 `You are Buffy, the strategic coding assistant.` 开头（上游字节级校验），Worker 已自动注入。

### ⚠️ 单账号单会话限制（重要）

一个 Freebuff 账号同一时间**只能一个客户端在线**。因此：

- ❌ 禁止在 `/v1/models` 中查询上游 `GET /api/v1/freebuff/session` 探测额度/状态——该调用会占用 session 并顶掉正在进行的 chat（428 `waiting_room_required`）。
- ✅ `/v1/models` 返回**静态模型列表**（不额外调上游）。
- 上游请求通过**串行队列 + 300ms 间隔**执行，避免并发触发上游问题。

## 💡 使用体验

目前测试过以下方式，效果都不错：

1. **🌍 美国 IP 直连**：freebuff 免费模型对出口 IP 有 US 限制，非美区 IP 可能失败。Cloudflare Workers 默认美国出口，直连即可；本地客户端访问建议配合美国代理。

2. **🤖 Hermes Agent（美区 VPS）**：将 Hermes Agent 部署在美区 VPS 上。

3. **本地浏览器 + page-assist 插件**：配合 [page-assist](https://github.com/n4ze3m/page-assist) 浏览器插件使用，体验流畅，欢迎尝试。

## ⚠️ 免责声明

本项目仅供**技术交流与学习研究**使用。

- 本项目通过逆向 freebuff 桌面版/API 协议实现代理，**违反 freebuff 官方服务条款（ToS）**。
- 使用本项目存在**账号被封禁（banned）的风险**，且封禁为终态、不可恢复，请知悉并自行承担后果。
- 请勿用于商业用途或大规模滥用，请尊重 freebuff 服务提供方的运营。
- 使用者需自行遵守所在地法律法规及 freebuff 官方条款，本项目作者不对任何账号损失或纠纷负责。

## 📄 License

本项目采用 [MIT License](LICENSE)，欢迎自由使用、修改与分享。


