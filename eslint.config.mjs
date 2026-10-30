import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
    {
        // The Capacitor Android project is a native build tree, not app source.
        // Once `./gradlew assembleDebug` has run it contains generated JS
        // (Capacitor's native-bridge.js under app/build/intermediates/), which
        // otherwise fails lint with rule-definition errors for anyone who has
        // built the app locally. Nothing under android/ is ours to lint.
        ignores: ['android/**'],
    },
    {
        extends: [...next],
    },
]);
