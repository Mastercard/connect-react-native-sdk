const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');

const config = {
	watchFolders: [workspaceRoot],
	resolver: {
		unstable_enableSymlinks: true,
		disableHierarchicalLookup: true,
		extraNodeModules: {
			// Ensure local linked SDK resolves to the app runtime copies.
			react: path.resolve(appNodeModules, 'react'),
			'react-native': path.resolve(appNodeModules, 'react-native'),
			'react-native-safe-area-context': path.resolve(
				appNodeModules,
				'react-native-safe-area-context'
			),
			'react-native-webview': path.resolve(appNodeModules, 'react-native-webview'),
			'react-native-url-polyfill': path.resolve(appNodeModules, 'react-native-url-polyfill')
		},
		nodeModulesPaths: [appNodeModules]
	}
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
