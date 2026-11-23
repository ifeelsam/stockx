/** Structured JSON logs (one line per event) for Railway/Fly. */
export const log = (level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra }));
