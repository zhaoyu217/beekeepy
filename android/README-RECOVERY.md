# Beekeepy Android independent QA rebuild

This is a newly built Android Gradle *source scaffold*. It is not the lost November 23 original Gradle project and it has **not** been compiled into an APK.

- Package: `app.hivefield.mobile.recoveryqa`, intentionally different from the historical installed application to avoid data loss through overwrite.
- Capacitor Android 8.0.0, Android SDK 36, JDK 21, Gradle 8.14.3, Kotlin plugin 2.1.20.
- Kotlin native plugins copied byte-for-byte from the November 10 source ZIP.
- Offline ASR requires separately downloaded, **hash-verified** Sherpa AAR and ONNX models. This archive does not contain them.
- `gradle-wrapper.jar` is absent; use a verified Gradle 8.14.3 installation to generate it. Never claim that the Gradle wrapper or an APK is ready until that happens.
- **Do not install** over an existing Beekeepy or Hive mobile package until signing key and local-data migration are independently verified.
- `mobile/dist` is generated using `npm run mobile:prepare`; copy it under `android/app/src/main/assets/public` only after passing bundle smoke checks and adding the pinned Supabase UMD runtime.
- Build gate: `node android/qa/preflight.mjs`, then `gradle -p android :app:assembleDebug`, after network dependencies are installed. Preflight intentionally fails until the pinned binary dependencies and bundled WebView resources are in place.
- This source uses a deliberately isolated QA app ID, not the historical production signing key or release application identity.
