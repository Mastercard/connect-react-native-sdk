#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/build-android-release-bundle.sh [options]

Options:
  --install             Install release APK on currently connected Android device/emulator.
  --skip-aab            Build APK only (skip Play Store AAB generation).
  --out-dir <path>      Output directory for copied artifacts (default: artifacts/release_bundle_<timestamp>).
  --open-finder         Open the output folder in Finder when build completes.
  -h, --help            Show this help.

Environment overrides:
  ADB=/path/to/adb
EOF
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
APP_ANDROID_DIR="$ROOT_DIR/ConnectReactNativeDemoApp/android"

RUN_ID="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="${ROOT_DIR}/artifacts/release_bundle_${RUN_ID}"
INSTALL_APK=0
BUILD_AAB=1
OPEN_FINDER=0
ADB="${ADB:-/Users/e113257/Library/Android/sdk/platform-tools/adb}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install)
      INSTALL_APK=1
      shift
      ;;
    --skip-aab)
      BUILD_AAB=0
      shift
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    --open-finder)
      OPEN_FINDER=1
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

if [[ ! -d "$APP_ANDROID_DIR" ]]; then
  echo "Android app directory not found: $APP_ANDROID_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

GRADLE_TASKS=(":app:assembleRelease")
if [[ "$BUILD_AAB" -eq 1 ]]; then
  GRADLE_TASKS+=(":app:bundleRelease")
fi
if [[ "$INSTALL_APK" -eq 1 ]]; then
  GRADLE_TASKS+=(":app:installRelease")
fi

log "Running Gradle tasks: ${GRADLE_TASKS[*]}"
(
  cd "$APP_ANDROID_DIR"
  ./gradlew "${GRADLE_TASKS[@]}" --stacktrace
) 2>&1 | tee "$OUT_DIR/gradle_release_bundle.log"

APK_PATH="$APP_ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
AAB_PATH="$APP_ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

if [[ ! -f "$APK_PATH" ]]; then
  echo "Release APK not found at: $APK_PATH" >&2
  exit 1
fi

cp "$APK_PATH" "$OUT_DIR/"
shasum -a 256 "$APK_PATH" | tee "$OUT_DIR/app-release.apk.sha256"
ls -lh "$APK_PATH" | tee "$OUT_DIR/app-release.apk.info.txt"
OUT_APK_PATH="$OUT_DIR/$(basename "$APK_PATH")"

if [[ "$BUILD_AAB" -eq 1 ]]; then
  if [[ ! -f "$AAB_PATH" ]]; then
    echo "Release AAB not found at: $AAB_PATH" >&2
    exit 1
  fi
  cp "$AAB_PATH" "$OUT_DIR/"
  shasum -a 256 "$AAB_PATH" | tee "$OUT_DIR/app-release.aab.sha256"
  ls -lh "$AAB_PATH" | tee "$OUT_DIR/app-release.aab.info.txt"
  OUT_AAB_PATH="$OUT_DIR/$(basename "$AAB_PATH")"
fi

if [[ "$INSTALL_APK" -eq 1 ]]; then
  if [[ ! -x "$ADB" ]]; then
    if command -v adb >/dev/null 2>&1; then
      ADB="$(command -v adb)"
    else
      echo "adb not found. Set ADB environment variable." >&2
      exit 1
    fi
  fi

  log "Verifying installed package on connected device"
  "$ADB" shell pm list packages | grep -E "com\.connectreactnativedemoapp|com\.mastercard\.openbanking\.connect\.demo" | tee "$OUT_DIR/installed_packages.txt" || true
fi

cat <<EOF

Build complete.
APK: $APK_PATH
$( [[ "$BUILD_AAB" -eq 1 ]] && echo "AAB: $AAB_PATH" )
Artifacts copied to: $OUT_DIR

Locate files in Finder:
1) Open artifacts folder:
   open "$OUT_DIR"
2) Reveal APK file:
   open -R "$OUT_APK_PATH"
$( [[ "$BUILD_AAB" -eq 1 ]] && echo "3) Reveal AAB file:" )
$( [[ "$BUILD_AAB" -eq 1 ]] && echo "   open -R \"$OUT_AAB_PATH\"" )

EOF

if [[ "$OPEN_FINDER" -eq 1 ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$OUT_DIR"
  else
    log "Finder open command not available on this system."
  fi
fi
