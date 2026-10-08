# Hive mobile — offline-first v1

This branch turns the existing production web application into a Capacitor iOS/Android app without rewriting the frozen scientific workflow.

## Architecture

Bundled web UI/scientific logic
→ Capacitor native shell
→ native OfflineAsr plugin
→ sherpa-onnx streaming Zipformer
→ existing deterministic Inspection parser
→ user review
→ structured fields + raw transcript in Notes.

Core inspection work must function with airplane mode enabled. Cloud sync is opportunistic only.

## The five previously missing functions

Recovered from the earlier `feature-five-gaps-v1` work:

1. **Quick Inspection mode** — collapse non-core inspection sections without changing scientific fields.
2. **Structured Voice Inspection** — now routes to native offline ASR instead of browser/cloud STT.
3. **Offline Inspection + reconnect sync** — edits remain local and flush to Supabase when connectivity returns.
4. **Data export / backup** — JSON backup, Inspections CSV, all-records CSV, printable report.
5. **Environmental context** — weather + airborne pollen when online; cached/stale context only when offline and never used in health scoring.

## Hard mobile constraints

- No per-use transcription fee.
- Voice works with no network.
- Model is packaged in the app.
- Raw transcript remains reviewable and is written to Notes only after Apply.
- Formal Varroa/Treatment records stay isolated from casual voice text.
- Existing scientific score/risk/routing logic is not modified by the mobile shell.

## Development bundle id

`app.hivefield.mobile` is temporary. Replace before App Store / Play Store release after the final brand name is frozen.

## Build

```bash
npm install
npm run mobile:prepare
npx cap add android
npx cap add ios
npm run mobile:sync
```

Native OfflineAsr implementations are added as local Capacitor plugins in the next step. The JS compatibility shim is already wired so the existing Inspection voice UI does not need another rewrite.
