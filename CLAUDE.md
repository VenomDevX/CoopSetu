# CoopSetu — working agreements

Next.js 15 (App Router) + Supabase + Capacitor Android. One codebase serves the
web app and the Android app; there is no separate mobile project.

## Branching: always base on `main`

Branch from `main`, open the PR against `main`, merge, delete the branch.

**Do not stack PRs on other feature branches.** 19 of the first 30 PRs in this
repo were merged into another feature branch rather than `main` (#38→#39→#36→
#35→…→#29, and the same shape across the i18n/offline work). Two consequences
cost real time:

- A PR showing "Merged" meant only that it reached its parent branch. Content
  did not land on `main` until the chain *tip* merged, so checking one PR's
  state told you nothing about whether the work shipped.
- After `main`'s history was rewritten, those branches stopped being ancestors
  of `main`. `git branch -r --no-merged` now reports 20+ branches as unmerged
  when their content is fully present.

To ask whether a branch's work is really on `main`, compare *patches*, not
ancestry — this is immune to rebases and history rewrites:

```bash
git cherry origin/main origin/<branch>   # '+' = genuinely missing, '-' = already applied
```

## Android: `npm run android:sync` after every pull

The app is a WebView pointing at a running Next server, so the UI comes from
whatever `CAPACITOR_DEV_SERVER_URL` (in `.env.local`) points at — the emulator
needs `http://10.0.2.2:3000`, a physical device your LAN IP. `localhost` refers
to the phone itself and will never reach your machine.

**The native UI is selected by a user-agent sentinel.**
`android.appendUserAgent: 'CoopSetuApp/1'` in `capacitor.config.ts` marks the
WebView's UA; `middleware.ts` normalizes it into `x-coopsetu-native`, and
`getIsNative()` (`lib/native/server.ts`) branches the layout server-side.

The WebView reads that sentinel from
`android/app/src/main/assets/capacitor.config.json`, which `npx cap sync`
generates and `android/.gitignore` excludes — **every developer has their own
copy, and `git pull` never updates it.** A copy generated before the sentinel
landed (commit `e947650`) keeps sending an unmarked UA, so the server serves the
**web** layout and the app looks like it never got the mobile UI. Rebuilding the
APK does not help.

```bash
npm run android:sync    # regenerate the config (fixes the above)
npm run android:build   # sync + assembleDebug
npm run android:run     # sync + run on a device/emulator
```

`NativeProvider` logs a console warning in dev when it detects this exact
mismatch (native bridge present, server said web).

## Verification

```bash
npm run lint && npx tsc --noEmit
npm test                              # 230 unit
npm run test:integration              # 145 integration (needs local Supabase)
npx playwright test --project=native  # 47 native-app e2e
npx playwright test --project=e2e     # web e2e — see caveat below
```

The `native` Playwright project emulates a Pixel 7 **plus the UA sentinel**;
`e2e` runs Desktop Chrome and must stay unaffected by any native change. Several
native specs are anti-leak canaries: the same device *without* the sentinel must
still get the web UI. Keep them.

**Known-red:** the full `e2e` project is not green on `main` (13 failures as of
`d0f3ffe`), and the nightly `full-regression` workflow has failed every night
since 2026-08-31 — the demo-session seeding step errors with
`invalid input syntax for type uuid: ""`, which is why the `demo-workspace`
specs fail. CI's PR gate runs only the smoke subset, so this stays hidden on
PRs. Do not read a green PR check as "the whole suite passes".

## Conventions

- Tailwind v4, CSS-first (`app/globals.css`); there is no `tailwind.config.*`.
  Native structural overrides are scoped under `html.app-native` — never
  redefine a colour token there; the palette is shared with web by design.
- `messages/en.json` and `messages/hi.json` must stay key-identical
  (`tests/unit/i18n-config.test.ts` enforces it).
- Never commit `.env.local`, or anything under `.idea/`.
