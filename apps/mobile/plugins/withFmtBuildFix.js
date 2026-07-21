const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Works around the React Native iOS build error where the bundled `fmt` library
// fails to compile under newer Xcode/Clang (expo/expo#44229):
//   "call to consteval function ... is not a constant expression" (format-inl.h)
// A -DFMT_USE_CONSTEVAL=0 compiler flag does NOT work: fmt/base.h redefines the
// macro unconditionally. The only reliable fix is patching the header itself,
// done here from the Podfile's post_install so it re-applies on every
// `pod install`. Fixed upstream in RN 0.83; delete this plugin once the Expo
// SDK ships it.
module.exports = function withFmtBuildFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");

      const marker = "# fmt-consteval-fix";
      if (!contents.includes(marker) && /post_install do \|installer\|/.test(contents)) {
        const patch = `
    ${marker}
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/^(#\\s*define FMT_USE_CONSTEVAL) 1$/, '\\1 0')
      if patched != content
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
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
