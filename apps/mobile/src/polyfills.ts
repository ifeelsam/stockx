// Order matters: random values first (web3.js / Privy need crypto.getRandomValues), then Buffer.
import "react-native-get-random-values";
import "@privy-io/expo/polyfills";
import { Buffer } from "buffer";

(globalThis as { Buffer?: unknown }).Buffer ??= Buffer;
