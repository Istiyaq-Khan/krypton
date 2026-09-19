#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# Krypton Unix Uninstaller Script (macOS & Linux)
# Removes binaries, desktop integration, LaunchAgents / systemd user services,
# PATH configuration, and optionally purges all runtime application state.
# ------------------------------------------------------------------------------

set -e

QUIET=0
PURGE_DATA=0

for arg in "$@"; do
  case "$arg" in
    --quiet|-q)
      QUIET=1
      ;;
    --purge-data|-p)
      PURGE_DATA=1
      ;;
  esac
done

if [ "$QUIET" -eq 0 ]; then
  echo ""
  echo "⚡ =========================================="
  echo "       Krypton Unix Uninstaller            "
  echo "=========================================="
  echo ""
fi

# 1. Terminate running background daemons & processes
if [ "$QUIET" -eq 0 ]; then echo "• Terminating running Krypton daemons..."; fi
pkill -TERM -f "krypton-daemon" 2>/dev/null || true
pkill -TERM -f "krypton" 2>/dev/null || true

# 2. Resolve paths
KRYPTON_DIR="$HOME/.krypton"
BIN_DIR="$KRYPTON_DIR/bin"

# 3. macOS LaunchAgent & App cleanup
if [ "$(uname -s)" = "Darwin" ]; then
  if [ "$QUIET" -eq 0 ]; then echo "• Unloading macOS LaunchAgents..."; fi
  LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.krypton.daemon.plist"
  if [ -f "$LAUNCH_AGENT" ]; then
    launchctl unload "$LAUNCH_AGENT" 2>/dev/null || true
    rm -f "$LAUNCH_AGENT"
  fi
fi

# 4. Linux FreeDesktop integration & systemd service cleanup
if [ "$(uname -s)" = "Linux" ]; then
  if [ "$QUIET" -eq 0 ]; then echo "• Removing Linux FreeDesktop shortcuts and services..."; fi
  DESKTOP_ENTRY="$HOME/.local/share/applications/krypton.desktop"
  if [ -f "$DESKTOP_ENTRY" ]; then
    rm -f "$DESKTOP_ENTRY"
  fi
  rm -f "$HOME/.local/share/icons/hicolor/"*"/apps/krypton.png" 2>/dev/null || true

  # Stop and disable systemd user service if registered
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user stop krypton-daemon.service 2>/dev/null || true
    systemctl --user disable krypton-daemon.service 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/krypton-daemon.service" 2>/dev/null || true
  fi
fi

# 5. Remove CLI binaries
if [ "$QUIET" -eq 0 ]; then echo "• Removing Krypton CLI binaries..."; fi
rm -f "$BIN_DIR/krypton"
rm -f "$BIN_DIR/krypton-cli"
rm -f "$BIN_DIR/krypton-daemon"
rm -f "/usr/local/bin/krypton" 2>/dev/null || true
rm -f "$HOME/.local/bin/krypton" 2>/dev/null || true

# 6. Clean Shell Profile PATH entries
if [ "$QUIET" -eq 0 ]; then echo "• Cleaning shell profile PATH entries..."; fi
SHELL_PROFILES=("$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile")
for profile in "${SHELL_PROFILES[@]}"; do
  if [ -f "$profile" ]; then
    grep -v 'Krypton Autonomous Desktop AI' "$profile" | grep -v "$BIN_DIR" > "${profile}.tmp" || true
    mv "${profile}.tmp" "$profile"
  fi
done

# 7. Purge user data if requested
if [ "$PURGE_DATA" -eq 1 ]; then
  if [ "$QUIET" -eq 0 ]; then echo "• Purging user application data and workspaces..."; fi
  rm -rf "$KRYPTON_DIR"

  if [ "$(uname -s)" = "Darwin" ]; then
    rm -rf "$HOME/Library/Application Support/krypton"
    rm -rf "$HOME/Library/Application Support/com.krypton.desktop"
    rm -rf "$HOME/Library/Caches/krypton"
    rm -rf "$HOME/Library/Caches/com.krypton.desktop"
    rm -f "$HOME/Library/Preferences/com.krypton.desktop.plist"
  elif [ "$(uname -s)" = "Linux" ]; then
    XDG_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"
    XDG_DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
    XDG_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}"
    rm -rf "$XDG_CONFIG/krypton" "$XDG_CONFIG/com.krypton.desktop"
    rm -rf "$XDG_DATA/krypton" "$XDG_DATA/com.krypton.desktop"
    rm -rf "$XDG_CACHE/krypton" "$XDG_CACHE/com.krypton.desktop"
  fi
fi

if [ "$QUIET" -eq 0 ]; then
  echo ""
  echo "=========================================="
  echo "✔ Krypton successfully uninstalled!"
  echo "=========================================="
  echo ""
fi
