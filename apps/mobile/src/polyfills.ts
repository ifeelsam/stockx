// Order matters: random values first (web3.js / Privy need crypto.getRandomValues), then Buffer.
import "react-native-get-random-values";
import "@privy-io/expo/polyfills";
import { Buffer } from "buffer";
import { patchBuffer } from "@scratchers/sdk/pure";

(globalThis as { Buffer?: unknown }).Buffer ??= Buffer;
patchBuffer(Buffer); // buffer@6 has no BigInt read/write; web3.js/anchor need them for u64
