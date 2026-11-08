#!/usr/bin/env bash
set -Eeuo pipefail

mkdir -p android-auth-results
capture_diagnostics() {
  local rc=$?
  echo "script_exit_code=$rc" > android-auth-results/script-exit.txt
  timeout 15s adb logcat -b all -d -t 8000 > android-auth-results/logcat-on-exit.txt 2>&1 || true
  timeout 15s adb shell df -h > android-auth-results/disk-on-exit.txt 2>&1 || true
  timeout 15s adb shell dumpsys meminfo > android-auth-results/meminfo-on-exit.txt 2>&1 || true
  exit "$rc"
}
trap capture_diagnostics EXIT

echo "Waiting for Android device"
timeout 120s adb wait-for-device
adb devices -l | tee android-auth-results/adb-devices-before-install.txt
test "$(adb get-state)" = "device"
test "$(timeout 30s adb shell getprop sys.boot_completed | tr -d '\r')" = "1"

echo "APK size"
ls -lh candidate-apk/app-debug.apk | tee android-auth-results/apk-size.txt
timeout 20s adb shell df -h /data > android-auth-results/data-partition.txt 2>&1 || true
timeout 20s adb shell cat /proc/meminfo > android-auth-results/device-meminfo.txt 2>&1 || true
timeout 20s adb shell service check package > android-auth-results/package-service.txt 2>&1 || true

echo "Checking Android Package Manager"
package_manager_ready=0
for attempt in $(seq 1 8); do
  if timeout 20s adb shell cmd package list packages > android-auth-results/package-list-check.txt 2>&1; then
    package_manager_ready=1
    break
  fi
  echo "Package Manager not ready, attempt $attempt/8"
  sleep 5
done
echo "package_manager_ready=$package_manager_ready" | tee android-auth-results/package-manager-ready.txt
if [[ "$package_manager_ready" -ne 1 ]]; then
  echo "Package Manager did not become ready; refusing to attempt APK install"
  exit 21
fi

echo "Installing APK"
timeout 240s adb install -r candidate-apk/app-debug.apk 2>&1 | tee android-auth-results/install-output.txt
timeout 30s adb shell pm path app.hivefield.mobile.fix | tee android-auth-results/installed-package-path.txt

echo "Launching APK and capturing logcat"
adb logcat -c
adb logcat -v threadtime > android-auth-results/logcat-live.txt 2>&1 &
logcat_pid=$!
set +e
timeout 20s adb shell am start -n app.hivefield.mobile.fix/app.hivefield.mobile.MainActivity
start_rc=$?
set -e
echo "am_start_exit_code=$start_rc" | tee android-auth-results/launch-status.txt
sleep 25
set +e
timeout 20s adb get-state > android-auth-results/adb-state-after-launch.txt 2>&1
state_rc=$?
timeout 20s adb shell pidof app.hivefield.mobile.fix > android-auth-results/app-pid.txt 2>&1
pid_rc=$?
set -e
echo "adb_state_exit_code=$state_rc" >> android-auth-results/launch-status.txt
echo "app_pid_exit_code=$pid_rc" >> android-auth-results/launch-status.txt
kill "$logcat_pid" 2>/dev/null || true
wait "$logcat_pid" 2>/dev/null || true
cat android-auth-results/launch-status.txt
cat android-auth-results/app-pid.txt || true
test "$start_rc" -eq 0
test "$state_rc" -eq 0
test "$pid_rc" -eq 0

echo "Running real APK WebView and Supabase isolation tests"
node .github/tests/android-authenticated-apk.cjs
