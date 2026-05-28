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
  testMatch: ["**/test/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true
};
