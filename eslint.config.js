import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            eqeqeq: "off",
            "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
            "require-await": "warn",
            "no-console": ["warn", { allow: ["warn", "error"] }],
        },
    }
);
