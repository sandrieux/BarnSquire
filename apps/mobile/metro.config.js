// Metro config for a pnpm monorepo. Watches the workspace root so changes in
// shared packages (@barnsquire/*) hot-reload, and resolves modules from both the
// app's and the root node_modules. Symlink support is required for pnpm.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Resolve pnpm symlinks; keep hierarchical lookup ON so Metro can walk up the
// isolated pnpm trees (do NOT disable it under pnpm's default linker).
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
