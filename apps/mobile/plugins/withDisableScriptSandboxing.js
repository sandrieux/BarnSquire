const { withXcodeProject } = require("@expo/config-plugins");

// Xcode 15+ "User Script Sandboxing" (ENABLE_USER_SCRIPT_SANDBOXING = YES)
// forbids build-phase scripts from reading undeclared files, which breaks the
// Expo/CocoaPods scripts (e.g. `expo-configure-project`) with
//   Sandbox: bash(...) deny(1) file-read-data ...
// RN/Expo projects need it off on the app target.
module.exports = function withDisableScriptSandboxing(config) {
  return withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      if (buildSettings) {
        buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
      }
    }
    return cfg;
  });
};
