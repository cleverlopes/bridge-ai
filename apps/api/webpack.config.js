const { composePlugins, withNx } = require('@nx/webpack');
const { join } = require('path');
const nodeExternals = require('webpack-node-externals');

/**
 * Bundle non-buildable workspace libs into the app (production Docker image only
 * copies dist + node_modules; workspace packages live as symlinks to ../../packages
 * which are not present in the runner stage, so @bridge-ai/* must not stay external).
 */
module.exports = composePlugins(
  withNx(),
  (config, { context }) => {
    config.output = {
      ...config.output,
      path: join(context.root, 'dist/apps/api'),
    };
    const modulesDir = join(context.root, 'node_modules');
    const workspaceBridgeAi = [
      /^@bridge-ai\/nest-core(\/.*)?$/,
      /^@bridge-ai\/bridge-sdk(\/.*)?$/,
      /^@bridge-ai\/gsd-sdk(\/.*)?$/,
    ];
    config.externals = [
      nodeExternals({
        modulesDir,
        allowlist: workspaceBridgeAi,
      }),
    ];
    return config;
  },
);
