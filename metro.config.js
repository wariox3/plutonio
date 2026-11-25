const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

// Sentry marca cada bundle con un id para emparejarlo con su source map.
module.exports = withSentryConfig(
  mergeConfig(getDefaultConfig(__dirname), config),
);
