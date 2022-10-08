/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    globals: {
        "ts-jest": {
            tsconfig: "./tsconfig.json",
        },
    },
    transform: {
        "^.+\\.ts?$": "esbuild-jest",
    },
    verbose: true,
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: "coverage",
    coverageProvider: "v8",
    testMatch: ["**/tests/unit/*.test.ts"],
}
