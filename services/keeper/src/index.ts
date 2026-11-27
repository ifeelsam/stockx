import { createServer } from "node:http";
import { connect, getProgram, vaultPda } from "@scratchers/sdk";
import { PublicKey } from "@solana/web3.js";
import { loadConfig } from "./config.js";
import { makeFaucet } from "./faucet.js";
import { startInventory, vaultHealth } from "./inventory.js";
import { log } from "./log.js";
import { DevSource, HermesSource, PythProSource } from "./prices.js";
import { lastPush, startPusher } from "./pusher.js";
import { startQuotes } from "./quotes.js";
import { clientIp, routePath } from "./ratelimit.js";
import { startRepair } from "./repair.runtime.js";

// An RPC hiccup (429 on a public endpoint, a dropped websocket) must never take the price relay down.
process.on("unhandledRejection", (e) => log("error", "unhandled rejection", { err: (e as Error)?.message ?? String(e) }));
process.on("uncaughtException", (e) => log("error", "uncaught exception", { err: e.message }));
process.on("SIGTERM", () => process.exit(0)); // as PID 1 in a container, node ignores it otherwise

const cfg = loadConfig();
function priceSource(c: typeof cfg) {
  if (c.priceSource === "dev") return new DevSource();
  if (c.priceSource === "pythpro") {
    if (!c.pythProToken) throw new Error("PRICE_SOURCE=pythpro needs PYTH_PRO_TOKEN");
    return new PythProSource(c.pythProToken, c.pythProIds, c.pythProUrl);
  }
  return new HermesSource(c.hermesUrl, c.hermesAuthHeader);
}
const c = connect({ baseUrl: cfg.rpcUrl, region: cfg.region });
const program = getProgram(c.base);
const feeds = Object.entries(cfg.deployments.feeds).map(([name, f]) => ({ name, idHex: f.id }));
const stales = new Map<string, number>(); // feed → age in seconds (watcher)

const faucet = makeFaucet({ base: c.base, authority: cfg.faucet, deployments: cfg.deployments, cooldownMs: cfg.faucetCooldownMs, solDripsPerHour: cfg.solDripsPerHour });

/** The always-on work: price relay, payout repair, inventory, sell quotes. Exactly one process may run it. */
function startLoops() {
  if (cfg.holdFeeds.size) log("warn", "holding last price for feeds even without source data: their price may be far from the market", { feeds: [...cfg.holdFeeds] });
  startPusher({ program, rollup: c.rollup, keeper: cfg.keeper, feeds, source: priceSource(cfg), holdFeeds: cfg.holdFeeds });
  startRepair({ program, base: c.base, rollup: c.rollup, keeper: cfg.keeper, deployments: cfg.deployments, graceMs: cfg.repairGraceMs });
  startInventory({ program, base: c.base, rollup: c.rollup, keeper: cfg.keeper, mintAuthority: cfg.faucet, deployments: cfg.deployments, refill: cfg.refillStock });
  startQuotes({ program, base: c.base, rollup: c.rollup, keeper: cfg.keeper, deployments: cfg.deployments });

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
}
// A --web instance scales to zero and runs several at a time, so the loops belong to the worker process only.
if (!cfg.web) startLoops();

const metrics = () => [
  ...[...stales].map(([f, a]) => `scratchers_price_age_seconds{feed="${f}"} ${a}`),
  ...[...lastPush].map(([f, p]) => `scratchers_last_push_unixtime{feed="${f}"} ${Math.floor(p.at / 1000)}`),
  ...[...vaultHealth.values()].flatMap((v) => [`scratchers_vault_free_shares{stock="${v.stock}"} ${v.free}`, `scratchers_vault_reserved_shares{stock="${v.stock}"} ${v.reserved}`]),
].join("\n") + "\n";

const server = createServer(async (req, res) => {
  const cors = { "access-control-allow-origin": cfg.faucetOrigin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST,GET,OPTIONS" };
  const send = (status: number, body: unknown, type = "application/json") => { res.writeHead(status, { "content-type": type, ...cors }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
  if (req.method === "OPTIONS") return send(204, "");
  const path = routePath(req.url);
  if (path === "/healthz") return send(200, { ok: true, vaults: [...vaultHealth.keys()].map((k) => vaultPda(new PublicKey(cfg.deployments.mints[k])).toBase58()) });
  if (path === "/deployments") return send(200, cfg.deployments); // public addresses only; apps bootstrap from here
  if (path === "/metrics") return send(200, metrics(), "text/plain");
  if (path === "/faucet" && req.method === "POST") {
    let raw = ""; for await (const ch of req) { raw += ch; if (raw.length > 1024) return send(413, { error: "too large" }); }
    try { const { wallet } = JSON.parse(raw); const r = await faucet(String(wallet), clientIp(req.headers, cfg.web, req.socket.remoteAddress)); return send(r.status, r.body); }
    catch (e) { log("error", "faucet failed", { err: (e as Error).message }); return send(500, { error: "faucet failed" }); }
  }
  send(404, { error: "not found" });
});
// A taken port means another keeper is running. Two keepers fight over prices and the apps keep talking to the old one,
// so stop here (the process guards would otherwise swallow this and carry on).
server.on("error", (e: NodeJS.ErrnoException) => {
  log("error", e.code === "EADDRINUSE" ? "port in use: another keeper is already running, stop it first" : "http server failed", { port: cfg.port, err: e.message });
  process.exit(1);
});
server.listen(cfg.port, () => log("info", "keeper listening", { port: cfg.port, web: cfg.web, program: cfg.deployments.program, priceSource: cfg.priceSource }));
