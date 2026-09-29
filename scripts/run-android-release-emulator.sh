#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/run-android-release-emulator.sh [options]

Options:
  --avd <name>            Start this AVD if no emulator is currently online.
  --app-id <id>           Android application id (default: com.connectreactnativedemoapp).
  --main-activity <name>  Launch activity (default: .MainActivity).
  --artifacts-dir <path>  Custom artifacts output directory.
  --no-uninstall          Skip uninstall before install.
  --non-interactive       Do not pause before log capture.
  -h, --help              Show this help text.

Environment overrides:
  ADB=/path/to/adb
  EMULATOR_BIN=/path/to/emulator
  APP_ID=com.example.app
  MAIN_ACTIVITY=.MainActivity
  AVD_NAME=Pixel_8_API_35
  ARTIFACT_DIR=/custom/path
EOF
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
DEMO_ANDROID="$ROOT_DIR/ConnectReactNativeDemoApp/android"

ADB="${ADB:-/Users/e113257/Library/Android/sdk/platform-tools/adb}"
EMULATOR_BIN="${EMULATOR_BIN:-/Users/e113257/Library/Android/sdk/emulator/emulator}"
APP_ID="${APP_ID:-com.connectreactnativedemoapp}"
MAIN_ACTIVITY="${MAIN_ACTIVITY:-.MainActivity}"
AVD_NAME="${AVD_NAME:-}"
UNINSTALL_FIRST=1
INTERACTIVE=1
RUN_ID="$(date +%Y%m%d_%H%M%S)"
ARTIFACT_DIR="${ARTIFACT_DIR:-$ROOT_DIR/artifacts/release_run_$RUN_ID}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --avd)
      AVD_NAME="${2:-}"
      shift 2
      ;;
    --app-id)
      APP_ID="${2:-}"
      shift 2
      ;;
    --main-activity)
      MAIN_ACTIVITY="${2:-}"
      shift 2
      ;;
    --artifacts-dir)
      ARTIFACT_DIR="${2:-}"
      shift 2
      ;;
    --no-uninstall)
      UNINSTALL_FIRST=0
      shift
      ;;
    --non-interactive)
      INTERACTIVE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$APP_ID" || -z "$MAIN_ACTIVITY" ]]; then
  echo "APP_ID and MAIN_ACTIVITY must not be empty." >&2
  exit 1
fi

if [[ ! -x "$ADB" ]]; then
  if command -v adb >/dev/null 2>&1; then
    ADB="$(command -v adb)"
  else
    echo "adb not found. Set ADB env var or install Android platform-tools." >&2
    exit 1
  fi
fi

if [[ ! -d "$DEMO_ANDROID" ]]; then
  echo "Demo Android project not found at: $DEMO_ANDROID" >&2
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"

log "Artifacts directory: $ARTIFACT_DIR"
log "Using adb: $ADB"

ONLINE_EMULATOR="$($ADB devices | awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/{print $1; exit}')"

if [[ -z "$ONLINE_EMULATOR" ]]; then
  if [[ -z "$AVD_NAME" ]]; then
    if [[ -x "$EMULATOR_BIN" ]]; then
      log "No online emulator detected. Available AVDs:"
      "$EMULATOR_BIN" -list-avds | tee "$ARTIFACT_DIR/available_avds.txt"
    fi
    echo "No online emulator found. Start one manually or pass --avd <name>." >&2
    exit 1
  fi

  if [[ ! -x "$EMULATOR_BIN" ]]; then
    echo "emulator binary not found at: $EMULATOR_BIN" >&2
    exit 1
  fi

  log "Starting emulator AVD: $AVD_NAME"
  nohup "$EMULATOR_BIN" -avd "$AVD_NAME" > "$ARTIFACT_DIR/emulator_start.log" 2>&1 &
  echo "$!" > "$ARTIFACT_DIR/emulator_pid.txt"

  log "Waiting for emulator device"
  "$ADB" wait-for-device

  BOOTED=0
  for _ in $(seq 1 180); do
    BOOT_STATE="$($ADB shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
    if [[ "$BOOT_STATE" == "1" ]]; then
      BOOTED=1
      break
    fi
    sleep 2
  done

  if [[ "$BOOTED" -ne 1 ]]; then
    echo "Emulator did not finish booting in time." >&2
    exit 1
  fi
fi

ONLINE_EMULATOR="$($ADB devices | awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/{print $1; exit}')"
if [[ -z "$ONLINE_EMULATOR" ]]; then
  echo "No online emulator found after startup." >&2
  exit 1
fi

log "Using emulator: $ONLINE_EMULATOR"
$ADB devices | tee "$ARTIFACT_DIR/adb_devices.txt"

if [[ "$UNINSTALL_FIRST" -eq 1 ]]; then
  log "Uninstalling existing app (if installed)"
  "$ADB" uninstall "$APP_ID" > "$ARTIFACT_DIR/uninstall_output.txt" 2>&1 || true
fi

log "Building and installing release APK"
(
  cd "$DEMO_ANDROID"
  ./gradlew :app:assembleRelease :app:installRelease --stacktrace
) 2>&1 | tee "$ARTIFACT_DIR/gradle_release_install.log"

APK_PATH="$DEMO_ANDROID/app/build/outputs/apk/release/app-release.apk"
if [[ -f "$APK_PATH" ]]; then
  shasum -a 256 "$APK_PATH" | tee "$ARTIFACT_DIR/app-release.apk.sha256"
fi

log "Verifying package install"
"$ADB" shell pm list packages | grep "$APP_ID" | tee "$ARTIFACT_DIR/package_check.txt"

log "Launching app"
"$ADB" shell am start -n "$APP_ID/$MAIN_ACTIVITY" | tee "$ARTIFACT_DIR/launch_output.txt"

log "Preparing log capture"
"$ADB" logcat -c

if [[ "$INTERACTIVE" -eq 1 ]]; then
  echo "Reproduce login/connect flow on emulator, then press Enter to capture logs."
  read -r
fi

"$ADB" logcat -d -v time > "$ARTIFACT_DIR/logcat_full.txt"
grep -E -i "token|access[_-]?token|refresh[_-]?token|id[_-]?token|auth(code|orization)" \
  "$ARTIFACT_DIR/logcat_full.txt" > "$ARTIFACT_DIR/token_hits.txt" || true

log "Capturing screenshot"
"$ADB" exec-out screencap -p > "$ARTIFACT_DIR/emulator_app_foreground.png"
ls -lh "$ARTIFACT_DIR/emulator_app_foreground.png" | tee "$ARTIFACT_DIR/screenshot_info.txt"

"$ADB" shell getprop ro.build.version.release > "$ARTIFACT_DIR/android_version.txt"
"$ADB" shell dumpsys package "$APP_ID" | grep -E "versionName|versionCode" > "$ARTIFACT_DIR/app_version_info.txt" || true
(
  cd "$DEMO_ANDROID"
  ./gradlew :app:tasks --all
) > "$ARTIFACT_DIR/gradle_tasks.txt" 2>&1

log "Done. Artifacts saved to: $ARTIFACT_DIR"
