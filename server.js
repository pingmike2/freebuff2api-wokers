import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load worker module
const worker = await import('./worker.js');
const handler = worker.default;

// === Build env from config ===

// Read tokens from credentials/ directory
const credDir = resolve(__dirname, 'credentials');
let tokenLines = [];
if (existsSync(credDir)) {
  for (const f of readdirSync(credDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = readFileSync(resolve(credDir, f), 'utf-8');
      const obj = JSON.parse(raw);
      if (obj.authToken) tokenLines.push(obj.authToken.trim());
    } catch (err) {
      console.error(`[server] skip bad credential ${f}: ${err.message}`);
    }
  }
}

// Also allow FREEBUFF_TOKEN env var for non-credential token sources
const envToken = process.env.FREEBUFF_TOKEN || '';
if (envToken) {
  for (const tok of envToken.split(/[\n,]/)) {
    const t = tok.trim();
    if (t && !tokenLines.includes(t)) tokenLines.push(t);
  }
}

const env = {
  FREEBUFF_TOKEN: tokenLines.join(','),
  FREEBUFF_API_KEY: process.env.FREEBUFF_API_KEY || 'freebuff-default-key',
  FREEBUFF_DEBUG: process.env.FREEBUFF_DEBUG || 'false',
  CODEBUFF_API: process.env.CODEBUFF_API || '',
  RELAY_KEY: process.env.RELAY_KEY || '',
};

console.log(`[server] start: ${tokenLines.length} tokens, apiKey=${env.FREEBUFF_API_KEY.slice(0,8)}..., debug=${env.FREEBUFF_DEBUG}`);
if (env.CODEBUFF_API) console.log(`[server] CODEBUFF_API=${env.CODEBUFF_API}`);
if (env.RELAY_KEY) console.log(`[server] RELAY_KEY set`);

// === HTTP server ===
const port = parseInt(process.env.PORT || '8787', 10);
const host = process.env.HOST || '0.0.0.0';

const server = createServer(async (nodeReq, nodeRes) => {
  try {
    // Build array of raw bytes from Node request
    const chunks = [];
    for await (const chunk of nodeReq) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    // Build a CF-compatible Request
    const url = `http://${nodeReq.headers.host || 'localhost'}${nodeReq.url}`;
    const request = new Request(url, {
      method: nodeReq.method,
      headers: new Headers(nodeReq.headers),
      body: body.length > 0 ? body : null,
    });

    // Call the worker's fetch handler
    const response = await handler.fetch(request, env);

    // Write response back to Node socket
    nodeRes.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) nodeRes.write(Buffer.from(value));
        }
      } catch (err) {
        // Stream errors are expected on client disconnect
        if (!nodeRes.writableEnded) nodeRes.end();
        return;
      }
    }
    if (!nodeRes.writableEnded) nodeRes.end();
  } catch (err) {
    console.error('[server] request error:', err.message);
    if (!nodeRes.headersSent) {
      nodeRes.writeHead(502, { 'content-type': 'application/json' });
      nodeRes.end(JSON.stringify({ error: { message: 'proxy error', type: 'proxy_error' } }));
    } else if (!nodeRes.writableEnded) {
      nodeRes.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(`[server] listening on ${host}:${port}`);
});