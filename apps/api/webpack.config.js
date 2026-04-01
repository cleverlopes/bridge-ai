const { composePlugins, withNx } = require('@nx/webpack');
const { join } = require('path');
const nodeExternals = require('webpack-node-externals');

/**
 * Bundle the non-buildable workspace lib @bridge-ai/nest-core into the app.
 * Nx only auto-allowlists non-buildable libs when the repo uses TS "solution" style;
 * this repo uses tsconfig.base paths, so we explicitly allowlist nest-core here.
 */
module.exports = composePlugins(
  withNx(),
  (config, { context }) => {
    config.output = {
      ...config.output,
      path: join(context.root, 'dist/apps/api'),
    };
    const modulesDir = join(context.root, 'node_modules');
    config.externals = [
      nodeExternals({
        modulesDir,
        allowlist: [/^@bridge-ai\/nest-core(\/.*)?$/],
      }),
    ];
    return config;
  },
);
