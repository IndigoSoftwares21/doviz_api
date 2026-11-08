/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    moduleNameMapper: {
        "^@/config/(.*)$": "<rootDir>/src/config/$1",
        "^@/controllers/(.*)$": "<rootDir>/src/controllers/$1",
        "^@/routes/(.*)$": "<rootDir>/src/routes/$1",
        "^@/services/(.*)$": "<rootDir>/src/services/$1",
        "^@/utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@/types/(.*)$": "<rootDir>/src/types/$1",
        "^@/database/(.*)$": "<rootDir>/src/database/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
};
