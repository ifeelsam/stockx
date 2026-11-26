import { log } from "./log.js";

export type Quote = { feed: string; price: bigint; conf: bigint; publishTs: number };
/** One interface so the keeper can swap Hermes, an authenticated provider, or a dev feed. */
export interface PriceSource {
  readonly name: string;
  fetch(feedIdsHex: Record<string, string>): Promise<Quote[]>;
  /** Feeds this source can never serve (e.g. not entitled). They are never "held": their series stays paused. */
  unavailable?(): ReadonlySet<string>;
}

/**
 * Tokenized stocks trade around the clock and the app tolerates coarse prices, so when the source has nothing
 * new (US market closed) the pusher re-publishes the last known price with a fresh timestamp instead of letting
 * the series pause. Feeds the source cannot serve at all are never held.
 */
export function shouldHold(feed: string, lastPushAtMs: number | undefined, nowMs: number, unavailable: ReadonlySet<string>, forced: ReadonlySet<string> = new Set(), everyMs = 30_000): boolean {
  return (forced.has(feed) || !unavailable.has(feed)) && nowMs - (lastPushAtMs ?? 0) >= everyMs;
}

/** Rescale a Pyth-style (price, conf, expo) to the feed's fixed exponent (default -8), flooring. */
export function toFeedUnits(price: string | bigint, conf: string | bigint, expo: number, target = -8): { price: bigint; conf: bigint } {
  const shift = expo - target; // value × 10^expo = units × 10^target  →  units = value × 10^shift
  const scale = (v: bigint) => (shift >= 0 ? v * 10n ** BigInt(shift) : v / 10n ** BigInt(-shift));
  return { price: scale(BigInt(price)), conf: scale(BigInt(conf)) };
}

/**
 * Pyth Hermes. As of 2026-11-24 the public host answers 401 to price requests, so credentials are
 * configurable: HERMES_AUTH_HEADER="Header-Name: value" (for example a provider key).
 */
export class HermesSource implements PriceSource {
  readonly name = "hermes";
  constructor(private url = "https://hermes.pyth.network", private authHeader?: string) {}
  async fetch(feeds: Record<string, string>): Promise<Quote[]> {
    const q = Object.values(feeds).map((id) => `ids[]=${id}`).join("&");
    const headers: Record<string, string> = {};
    if (this.authHeader) {
      const i = this.authHeader.indexOf(":");
      headers[this.authHeader.slice(0, i).trim()] = this.authHeader.slice(i + 1).trim();
    }
    const res = await fetch(`${this.url}/v2/updates/price/latest?parsed=true&${q}`, { headers });
    if (!res.ok) throw new Error(`hermes ${res.status}`);
    const body = (await res.json()) as { parsed: { id: string; price: { price: string; conf: string; expo: number; publish_time: number } }[] };
    const byId = new Map(Object.entries(feeds).map(([name, id]) => [id.toLowerCase().replace(/^0x/, ""), name]));
    return body.parsed.flatMap((p) => {
      const feed = byId.get(p.id.toLowerCase().replace(/^0x/, ""));
      if (!feed) return [];
      const u = toFeedUnits(p.price.price, p.price.conf, p.price.expo);
      return [{ feed, price: u.price, conf: u.conf, publishTs: p.price.publish_time }];
    });
  }
}

type ProRow = { price: number | string; confidence?: number | string; exponent: number; publish_time: number };

/** One Pyth Pro (Lazer) price row → keeper quote in feed units (-8). `publish_time` is microseconds. */
export function parseProRow(feed: string, r: ProRow): Quote {
  const u = toFeedUnits(String(r.price), String(r.confidence ?? 0), r.exponent);
  return { feed, price: u.price, conf: u.conf, publishTs: Math.floor(r.publish_time / 1_000_000) };
}

/**
 * Pyth Pro (Lazer) REST: GET {url}/v1/fixed_rate@1000ms/price?ids=<id>&timestamp=<µs aligned to 1 s>, bearer token.
 * Requests must be aligned to a whole second (unaligned timestamps return `[]`). The token's grant decides which
 * feeds work: a 403 "Not entitled" feed is skipped (logged once) and its series stays paused.
 */
export class PythProSource implements PriceSource {
  readonly name = "pyth-pro";
  private lastSec = new Map<string, number>();
  private warned = new Set<string>();
  unavailable() { return this.warned as ReadonlySet<string>; }
  constructor(private token: string, private ids: Record<string, number>, private url = "https://pyth.dourolabs.app", private lagS = 2) {}
  async fetch(feeds: Record<string, string>): Promise<Quote[]> {
    const sec = Math.floor(Date.now() / 1000) - this.lagS;
    const out: Quote[] = [];
    for (const feed of Object.keys(feeds)) {
      const id = this.ids[feed];
      if (!id || this.lastSec.get(feed) === sec) continue; // at most one request per feed per second
      this.lastSec.set(feed, sec);
      const res = await fetch(`${this.url}/v1/fixed_rate@1000ms/price?ids=${id}&timestamp=${sec * 1_000_000}`, { headers: { authorization: `Bearer ${this.token}` } });
      if (res.status === 403) {
        if (!this.warned.has(feed)) { this.warned.add(feed); log("warn", "pyth pro: feed not entitled, series stays paused", { feed, id }); }
        continue;
      }
      if (!res.ok) throw new Error(`pyth pro ${res.status}`);
      const rows = (await res.json()) as ProRow[];
      if (rows[0]) out.push(parseProRow(feed, rows[0])); // [] = no data for that second (market closed)
    }
    return out;
  }
}

/** Random walk around a base price. Devnet only, clearly logged; never a substitute for real prices. */
export class DevSource implements PriceSource {
  readonly name = "dev-random-walk";
  private px = new Map<string, number>();
  constructor(private base: Record<string, number> = { mTSLA: 250, mNVDA: 140, mSOL: 180 }) {
    log("warn", "DEV PRICES: synthetic random-walk quotes are being pushed");
  }
  async fetch(feeds: Record<string, string>): Promise<Quote[]> {
    return Object.keys(feeds).map((feed) => {
      const p = (this.px.get(feed) ?? this.base[feed] ?? 100) * (1 + (Math.random() - 0.5) * 0.002);
      this.px.set(feed, p);
      return { feed, price: BigInt(Math.round(p * 1e8)), conf: BigInt(Math.round(p * 1e8 * 0.0005)), publishTs: Math.floor(Date.now() / 1000) };
    });
  }
}

/** US cash session, Mon-Fri 09:30-16:00 America/New_York (exchange holidays not modelled). */
export function isUsMarketOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  if (["Sat", "Sun"].includes(get("weekday"))) return false;
  const m = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return m >= 9 * 60 + 30 && m < 16 * 60;
}

/**
 * `push_price` rejects moves larger than max_move_bps. After a gap (market open) walk to the target in
 * steps that stay inside the band. Intermediate steps are pushed with a stale timestamp (see pusher) so
 * buys stay paused until the final, fresh step lands.
 */
export function planWalk(prev: bigint, target: bigint, maxMoveBps: number): bigint[] {
  // an unchanged price still needs one push: it is what keeps the timestamp (and the sell quote) fresh
  if (prev <= 0n || prev === target) return [target];
  const stepBps = BigInt(Math.max(1, maxMoveBps - 10)); // stay clear of the limit
  const steps: bigint[] = [];
  let cur = prev;
  for (let i = 0; i < 200 && cur !== target; i++) {
    const max = (cur * stepBps) / 10_000n;
    const diff = target > cur ? target - cur : cur - target;
    cur = diff <= max ? target : target > cur ? cur + max : cur - max;
    steps.push(cur);
  }
  return steps;
}
