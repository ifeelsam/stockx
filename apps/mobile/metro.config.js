const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Privy / web3.js / jose publish `exports` maps. Without the "browser" condition on native, jose resolves to its
// Node build (needs `zlib`) and the bundle fails.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionsByPlatform = { ...config.resolver.unstable_conditionsByPlatform, android: ["browser", "react-native"], ios: ["browser", "react-native"] };
module.exports = config;
