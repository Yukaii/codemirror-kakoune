import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  ...obsidianmd.configs.recommended,
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
