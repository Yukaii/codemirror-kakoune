import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  ...obsidianmd.configs.recommended.map(config => {
    if (!config.files) return config;
    const flatFiles = Array.isArray(config.files) ? config.files.flat(Infinity) : [config.files];
    return {
      ...config,
      files: flatFiles.map(pattern => {
        if (typeof pattern !== "string") return pattern;
        if (pattern.startsWith("packages/")) return pattern;
        return `packages/obsidian-kakoune/**/${pattern.replace(/^\*\*\//, "")}`;
      })
    };
  }),
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      }
    }
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/main.js",
      "test/**",
      "scripts/**",
      "**/*.test.ts",
      "**/test/**",
      "**/*.config.*",
      "**/jest.config.*",
      "**/esbuild.config.*",
      "eslint.config.mjs"
    ]
  }
];
