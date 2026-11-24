/**
 * Installs on `Uint8Array.prototype` (not just one Buffer class) because bundlers inject their *own* copy of the
 * polyfill for modules that use the bare global `Buffer` (Next does this for the ER SDK), and every copy inherits
 * from Uint8Array.
 * Always patched (a copy having the methods says nothing about the others); methods already present are kept.
 *
 * The `buffer` npm polyfill (v6, used in browsers and React Native) has no BigInt read/write methods, but
 * web3.js / anchor call `writeBigUInt64LE` etc. for u64 fields. Add them to a Buffer class's prototype.
 * Node's native Buffer already has them (patching is a no-op there).
 */
export function patchBuffer(_B?: unknown): void {
  const p = Uint8Array.prototype as unknown as Record<string, any>;
  const put = (name: string, fn: unknown) => {
    if (typeof p[name] !== "function") p[name] = fn;
  };
  const write = (le: boolean, signed: boolean) =>
    function (this: Uint8Array, value: bigint | number, offset = 0): number {
      let v = BigInt.asUintN(64, BigInt(value));
      if (!signed && BigInt(value) < 0n) throw new RangeError("value out of range");
      for (let i = 0; i < 8; i++) {
        this[offset + (le ? i : 7 - i)] = Number(v & 0xffn);
        v >>= 8n;
      }
      return offset + 8;
    };
  const read = (le: boolean, signed: boolean) =>
    function (this: Uint8Array, offset = 0): bigint {
      let v = 0n;
      for (let i = 0; i < 8; i++) v |= BigInt(this[offset + (le ? i : 7 - i)]) << BigInt(8 * i);
      return signed ? BigInt.asIntN(64, v) : v;
    };
  for (const [le, end] of [[true, "LE"], [false, "BE"]] as const) {
    put(`writeBigUInt64${end}`, write(le, false));
    put(`writeBigUint64${end}`, write(le, false));
    put(`writeBigInt64${end}`, write(le, true));
    put(`readBigUInt64${end}`, read(le, false));
    put(`readBigUint64${end}`, read(le, false));
    put(`readBigInt64${end}`, read(le, true));
  }
}
