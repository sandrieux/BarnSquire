const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Works around the React Native iOS build error where the bundled `fmt` library
// fails to compile under newer Xcode/Clang:
//   "call to consteval function ... is not a constant expression" (format-inl.h)
// Defining FMT_USE_CONSTEVAL=0 makes fmt fall back to non-consteval format
// strings. Applied to every Pod target so any unit that compiles fmt headers
// (fmt, RCT-Folly, …) picks it up.
module.exports = function withFmtBuildFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");

      const marker = "# fmt-consteval-fix";
      if (!contents.includes(marker) && /post_install do \|installer\|/.test(contents)) {
        // Put -DFMT_USE_CONSTEVAL=0 directly on the C/C++ compiler command line so
        // it can't be overridden by a pod's generated xcconfig. This disables
        // fmt's consteval format-string checks that newer Clang rejects.
        const patch = `
    ${marker}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |bc|
        ['OTHER_CPLUSPLUSFLAGS', 'OTHER_CFLAGS'].each do |key|
          flags = bc.build_settings[key] || '$(inherited)'
          flags = flags.join(' ') if flags.is_a?(Array)
          unless flags.include?('FMT_USE_CONSTEVAL')
            bc.build_settings[key] = flags + ' -DFMT_USE_CONSTEVAL=0'
          end
        end
      end
    end
`;
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|\n${patch}`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
