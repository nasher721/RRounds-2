#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ELECTRON_BIN="$ROOT_DIR/node_modules/.bin/electron"
LOG_FILE="${TMPDIR:-/tmp}/rolling-rounds-electron.log"

kill_local_desktop() {
  pkill -f "$ROOT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" >/dev/null 2>&1 || true
  pkill -f "$ROOT_DIR/release/mac-arm64/Rolling Rounds.app/Contents/MacOS/Rolling Rounds" >/dev/null 2>&1 || true
}

build_app() {
  cd "$ROOT_DIR"
  npm run build:dev
}

launch_app() {
  cd "$ROOT_DIR"
  ELECTRON_SERVE_DIST=1 ELECTRON_DEBUG=1 "$ELECTRON_BIN" .
}

launch_background() {
  cd "$ROOT_DIR"
  nohup env ELECTRON_SERVE_DIST=1 ELECTRON_DEBUG=1 "$ELECTRON_BIN" . \
    >"$LOG_FILE" 2>&1 < /dev/null &
  echo "$!"
}

kill_local_desktop
build_app

case "$MODE" in
  run)
    launch_app
    ;;
  --debug|debug)
    ELECTRON_ENABLE_LOGGING=1 launch_app
    ;;
  --logs|logs|--telemetry|telemetry)
    : >"$LOG_FILE"
    launch_app 2>&1 | tee "$LOG_FILE"
    ;;
  --verify|verify)
    APP_PID="$(launch_background)"
    sleep 2
    if ! kill -0 "$APP_PID" 2>/dev/null; then
      cat "$LOG_FILE"
      exit 1
    fi
    pgrep -f "$ROOT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" >/dev/null
    echo "Rolling Rounds desktop process is running (pid $APP_PID)."
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
