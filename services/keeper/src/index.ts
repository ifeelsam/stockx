import { createServer } from "node:http";
import { connect, getProgram, vaultPda } from "@scratchers/sdk";
import { PublicKey } from "@solana/web3.js";
import { loadConfig } from "./config.js";
import { makeFaucet } from "./faucet.js";
import { startInventory, vaultHealth } from "./inventory.js";
import { log } from "./log.js";
import { DevSource, HermesSource } from "./prices.js";
import { lastPush, startPusher } from "./pusher.js";
import { startQuotes } from "./quotes.js";
import { startRepair } from "./repair.runtime.js";

const cfg = loadConfig();
const c = connect({ baseUrl: cfg.rpcUrl, region: cfg.region });
const program = getProgram(c.base);
const feeds = Object.entries(cfg.deployments.feeds).map(([name, f]) => ({ name, idHex: f.id }));
const stales = new Map<string, number>(); // feed → age in seconds (watcher)

startPusher({ program, rollup: c.rollup, keeper: cfg.keeper, feeds, source: cfg.priceSource === "dev" ? new DevSource() : new HermesSource(cfg.hermesUrl, cfg.hermesAuthHeader) });
startRepair({ program, base: c.base, rollup: c.rollup, keeper: cfg.keeper, deployments: cfg.deployments, graceMs: cfg.repairGraceMs });
startInventory({ program, base: c.base, rollup: c.rollup, keeper: cfg.keeper, mintAuthority: cfg.faucet, deployments: cfg.deployments, refill: cfg.refillStock });
startQuotes({ program, base: c.base, rollup: c.rollup, keeper: cfg.keeper, deployments: cfg.deployments });
const faucet = makeFaucet({ base: c.base, authority: cfg.faucet, deployments: cfg.deployments, cooldownMs: cfg.faucetCooldownMs });

// Staleness watcher: age of each on-chain price; warn once a feed goes stale (market closed or relay down).
setInterval(async () => {
  for (const [name, f] of Object.entries(cfg.deployments.feeds)) {
    const info = await c.rollup.getAccountInfo(new PublicKey(f.pda), "confirmed").catch(() => null);
    if (!info) continue;
    const ts = program.coder.accounts.decode("priceFeed", info.data).publishTs.toNumber();
    const age = Math.floor(Date.now() / 1000) - ts;
    if (age > 60 && (stales.get(name) ?? 0) <= 60) log("warn", "price feed stale", { feed: name, ageS: age });
    stales.set(name, age);
  }
}, 5000);

const metrics = () => [
  ...[...stales].map(([f, a]) => `scratchers_price_age_seconds{feed="${f}"} ${a}`),
  ...[...lastPush].map(([f, p]) => `scratchers_last_push_unixtime{feed="${f}"} ${Math.floor(p.at / 1000)}`),
  ...[...vaultHealth.values()].flatMap((v) => [`scratchers_vault_free_shares{stock="${v.stock}"} ${v.free}`, `scratchers_vault_reserved_shares{stock="${v.stock}"} ${v.reserved}`]),
].join("\n") + "\n";

createServer(async (req, res) => {
  const cors = { "access-control-allow-origin": cfg.faucetOrigin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST,GET,OPTIONS" };
  const send = (status: number, body: unknown, type = "application/json") => { res.writeHead(status, { "content-type": type, ...cors }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204, "");
  if (req.url === "/healthz") return send(200, { ok: true, vaults: [...vaultHealth.keys()].map((k) => vaultPda(new PublicKey(cfg.deployments.mints[k])).toBase58()) });
  if (req.url === "/metrics") return send(200, metrics(), "text/plain");
  if (req.url === "/faucet" && req.method === "POST") {
    let raw = ""; for await (const ch of req) { raw += ch; if (raw.length > 1024) return send(413, { error: "too large" }); }
    try { const { wallet } = JSON.parse(raw); const r = await faucet(String(wallet), String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress)); return send(r.status, r.body); }
    catch (e) { log("error", "faucet failed", { err: (e as Error).message }); return send(500, { error: "faucet failed" }); }
  }
  send(404, { error: "not found" });
}).listen(cfg.port, () => log("info", "keeper listening", { port: cfg.port, program: cfg.deployments.program, priceSource: cfg.priceSource }));
