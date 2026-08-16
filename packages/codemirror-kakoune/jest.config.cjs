module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json"
      }
    ]
  },
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    "^kakoune-core-js$": "<rootDir>/../kakoune-core/src/index.ts"
  },
  transformIgnorePatterns: ["/node_modules/(?!kakoune-core-js/)"],
  clearMocks: true
};
