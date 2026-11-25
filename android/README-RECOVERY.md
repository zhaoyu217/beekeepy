# Beekeepy Android independent QA rebuild

This is a newly built Android Gradle source scaffold, not the lost Nov 23 original Gradle project, and it has NOT yet been compiled into an APK.

- Package: `app.hivefield.mobile.recoveryqa`, not the historical installed application.
- Capacitor Android 8.0.0, Android SDK 36, JDK 21, Gradle 8.14.3, Kotlin plugin 2.1.20.
- Offline ASR requires external Sherpa AAR and model binaries with hash verification; they are NOT included.
- `gradle-wrapper.jar` is absent. Build must use an installed verified Gradle 8.14.3.
- Do not install over an existing Beekeepy package without independent data migration verification.
- The full rebuilt source ZIP is still held separately; this GitHub branch contains an incremental recovery upload, NOT the complete Nov 23 reconstruction.
