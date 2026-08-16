module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          module: "CommonJS",
          strict: true,
          esModuleInterop: true,
          types: ["jest"]
        }
      }
    ]
  },
  moduleNameMapper: {
    "^kakoune-core-js$": "<rootDir>/../../packages/kakoune-core/src/index.ts",
    "^codemirror-kakoune$": "<rootDir>/../../packages/codemirror-kakoune/src/index.ts",
    "^codemirror-kakoune-cm5$": "<rootDir>/../../packages/codemirror-kakoune-cm5/src/index.ts"
  },
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true
};
