# Project Runbook: Install Release App on Android Emulator

This runbook documents the exact local commands to:
- build the Android release app
- install it on an emulator
- launch it
- save logs and token-related traces locally

## One-click option
Run the automated script:

```bash
./scripts/run-android-release-emulator.sh --avd <YOUR_AVD_NAME>
```

If an emulator is already running:

```bash
./scripts/run-android-release-emulator.sh
```

Non-interactive mode (captures logs immediately):

```bash
./scripts/run-android-release-emulator.sh --non-interactive
```

## 1) Set local variables
Run from any directory:

```bash
ROOT=/Users/e113257/react-native-sdk
DEMO_ANDROID=$ROOT/ConnectReactNativeDemoApp/android
ADB=/Users/e113257/Library/Android/sdk/platform-tools/adb
EMULATOR_BIN=/Users/e113257/Library/Android/sdk/emulator/emulator
APP_ID=com.connectreactnativedemoapp
MAIN_ACTIVITY=.MainActivity
RUN_ID=$(date +%Y%m%d_%H%M%S)
ARTIFACT_DIR=$ROOT/artifacts/release_run_$RUN_ID
mkdir -p "$ARTIFACT_DIR"
```

## 2) Start emulator (if not already running)
List devices first:

```bash
$ADB devices
```

If no emulator is online, list AVDs and start one:

```bash
$EMULATOR_BIN -list-avds
$EMULATOR_BIN -avd <YOUR_AVD_NAME>
```

Wait for boot completion:

```bash
$ADB wait-for-device
until [ "$("$ADB" shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do
  echo "waiting for emulator boot..."
  sleep 2
done
$ADB devices
```

## 3) Optional clean uninstall of previous app
```bash
$ADB uninstall $APP_ID || true
```

## 4) Build and install release APK
This is the default release flow for this repo:

```bash
/usr/bin/env -C "$DEMO_ANDROID" ./gradlew :app:assembleRelease :app:installRelease --stacktrace 2>&1 | tee "$ARTIFACT_DIR/gradle_release_install.log"
```

Save APK checksum for traceability:

```bash
shasum -a 256 "$DEMO_ANDROID/app/build/outputs/apk/release/app-release.apk" | tee "$ARTIFACT_DIR/app-release.apk.sha256"
```

## 5) Verify install and launch app
```bash
$ADB shell pm list packages | grep "$APP_ID" | tee "$ARTIFACT_DIR/package_check.txt"
$ADB shell am start -n "$APP_ID/$MAIN_ACTIVITY" | tee "$ARTIFACT_DIR/launch_output.txt"
```

## 6) Capture runtime logs and token traces
Clear old logs, reproduce the flow in app, then dump logs:

```bash
$ADB logcat -c
# Reproduce login/connect flow in emulator now
$ADB logcat -d -v time > "$ARTIFACT_DIR/logcat_full.txt"
```

Extract token-related lines (if present in logs):

```bash
grep -E -i "token|access[_-]?token|refresh[_-]?token|id[_-]?token|auth(code|orization)" "$ARTIFACT_DIR/logcat_full.txt" > "$ARTIFACT_DIR/token_hits.txt" || true
```

## 7) Capture screenshot evidence
```bash
$ADB exec-out screencap -p > "$ARTIFACT_DIR/emulator_app_foreground.png"
ls -lh "$ARTIFACT_DIR/emulator_app_foreground.png" | tee "$ARTIFACT_DIR/screenshot_info.txt"
```

## 8) Useful troubleshooting commands
```bash
$ADB shell getprop ro.build.version.release
$ADB shell dumpsys package $APP_ID | grep -E "versionName|versionCode"
/usr/bin/env -C "$DEMO_ANDROID" ./gradlew :app:tasks --all > "$ARTIFACT_DIR/gradle_tasks.txt"
```

## Notes
- Release builds are usually non-debuggable; direct reading of app-private storage is typically blocked.
- Token extraction here relies on what the app/backend logs to logcat.
- All evidence from a run is saved under:
  - /Users/e113257/react-native-sdk/artifacts/release_run_<timestamp>/
