import worker from "../worker.js";
const env = {
  FREEBUFF_TOKEN: Deno.env.get("FREEBUFF_TOKEN") || "",
  FREEBUFF_API_KEY: Deno.env.get("FREEBUFF_API_KEY") || "",
};
Deno.serve({ port: 8788 }, (req) => worker.fetch(req, env));
