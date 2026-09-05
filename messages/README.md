# i18n message dictionaries

`en.json` is the baseline, extracted 1:1 from the English strings already live in the app.

`hi.json` now carries real Hindi translations for this project's "core subset" (Phase 10): `Nav`, `Shell`, `Language`, `Auth` (login/signup), `Dashboard` (command center home), `Trainees`, `Certificates`, `Attendance`, and `Courses`.

**Deliberately not translated, even within the covered namespaces** — a documented scope boundary, not an oversight:
- Nav group titles (`Main_SYS`, `OPS_MGT`, ...) and similar uppercase/underscore tags (e.g. `Delivery_Trend`, `Attention_Queue`) — these are styled as terminal/system labels throughout this app's design language, not natural-language prose, the same way a product name isn't translated.
- Signup's dense password-strength checklist micro-copy (12+ characters, Uppercase, etc.) and dynamic/interpolated strings (validation errors, server error messages, per-row data).
- Every other page in the dashboard tree (~450+ remaining strings — projects, sprints, tasks, incidents, QA/security, releases, analytics, settings, and all pages restored in Phase 7) and all marketing pages. Out of scope for this pass; a future phase's work.

Keep both files' key structure identical — `i18n/request.ts` doesn't fall back per-key, so a key present in `en.json` but missing from `hi.json` renders as a blank/missing-key warning in next-intl, not an English fallback. `tests/unit/i18n-config.test.ts` guards this.
