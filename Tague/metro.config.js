const { getDefaultConfig } = require('@expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Get the default Expo config
const defaultConfig = getDefaultConfig(__dirname);

// Modify the resolver's sourceExts
defaultConfig.resolver.sourceExts.push('cjs');

// Disable package.json exports resolution
defaultConfig.resolver.unstable_enablePackageExports = false;

// Apply the NativeWind plugin and merge it with the default config
const config = withNativeWind(defaultConfig, { input: './global.css' });

// Export the combined config
module.exports = config;