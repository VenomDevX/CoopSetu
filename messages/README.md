# i18n message dictionaries

`en.json` is the baseline, extracted 1:1 from the English strings already live in the app (Phase 9 — no copy changed).

`hi.json` is currently an **exact copy of `en.json`**, not a translation. It exists so the language switcher (`components/layout/language-switcher.tsx`) has a real, loadable dictionary for `hi` and never 404s on the dynamic `import(../messages/${locale}.json)` in `i18n/request.ts` — selecting Hindi today shows the same English text. Phase 10 replaces this file's values with real Hindi translations for its scoped "core subset" of pages.

Keep both files' key structure identical — `i18n/request.ts` doesn't fall back per-key, so a key present in `en.json` but missing from `hi.json` renders as a blank/missing-key warning in next-intl, not an English fallback.
