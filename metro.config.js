const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// The 'input' should point to your main CSS file
module.exports = withNativeWind(config, { input: "./global.css" });