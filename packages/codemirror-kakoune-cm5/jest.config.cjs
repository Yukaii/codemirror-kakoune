module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          module: "CommonJS",
          moduleResolution: "Node",
          strict: true,
          esModuleInterop: true,
          types: ["jest"]
        }
      }
    ]
  },
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    "^kakoune-core-js$": "<rootDir>/../kakoune-core/src/index.ts"
  },
  clearMocks: true
};
