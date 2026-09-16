#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# Krypton Single-Step Universal Installer for macOS / Linux
# Installs everything into $HOME/.krypton/ and adds krypton to PATH
# ------------------------------------------------------------------------------

set -e

echo ""
echo "⚡ =========================================="
echo "   Krypton Autonomous Desktop AI Installer   "
echo "=========================================="
echo ""

# 1. Resolve target directory: $HOME/.krypton
KRYPTON_DIR="$HOME/.krypton"
BIN_DIR="$KRYPTON_DIR/bin"

echo "• Installing Krypton into: $KRYPTON_DIR"

mkdir -p "$BIN_DIR"
mkdir -p "$KRYPTON_DIR/agents/default"
mkdir -p "$KRYPTON_DIR/worktrees"
mkdir -p "$KRYPTON_DIR/cache/outputs"
mkdir -p "$KRYPTON_DIR/browser_binaries"
mkdir -p "$KRYPTON_DIR/browser_profiles/whatsapp"
mkdir -p "$KRYPTON_DIR/logs"

# 2. Resolve or build binary
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DIST_BIN="$REPO_ROOT/packages/cli/dist/krypton"
ROOT_BIN="$REPO_ROOT/krypton"
TARGET_BIN="$BIN_DIR/krypton"

if [ -f "$DIST_BIN" ]; then
  cp "$DIST_BIN" "$TARGET_BIN"
elif [ -f "$ROOT_BIN" ]; then
  cp "$ROOT_BIN" "$TARGET_BIN"
else
  echo "• Building standalone CLI binary..."
  node "$SCRIPT_DIR/build-cli.mjs" || true
  if [ -f "$DIST_BIN" ]; then
    cp "$DIST_BIN" "$TARGET_BIN"
  else
    # Fallback shell runner
    cat <<EOF > "$TARGET_BIN"
#!/bin/sh
exec node "$REPO_ROOT/packages/cli/dist/index.js" "\$@"
EOF
  fi
fi

chmod +x "$TARGET_BIN"

# 3. Create default config.json
CONFIG_FILE="$KRYPTON_DIR/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  cat <<EOF > "$CONFIG_FILE"
{
  "version": "0.1.0",
  "activeModel": "claude-3-7-sonnet",
  "concurrencyLimit": 5,
  "maxRecursionDepth": 3
}
EOF
fi

# 4. Add to Shell Profile PATH if not present
EXPORT_LINE="export PATH=\"$BIN_DIR:\$PATH\""
SHELL_PROFILES=("$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile")

UPDATED=0
for profile in "${SHELL_PROFILES[@]}"; do
  if [ -f "$profile" ]; then
    if ! grep -q "$BIN_DIR" "$profile"; then
      echo "" >> "$profile"
      echo "# Krypton Autonomous CLI" >> "$profile"
      echo "$EXPORT_LINE" >> "$profile"
      echo "✔ Added $BIN_DIR to $profile"
      UPDATED=1
    fi
  fi
done

if [ $UPDATED -eq 0 ]; then
  # If none of the files existed, append to .profile
  echo "$EXPORT_LINE" >> "$HOME/.profile"
fi

echo ""
echo "=========================================="
echo "✔ Installation Complete!"
echo "  Location: $KRYPTON_DIR"
echo "  Binary  : $TARGET_BIN"
echo "=========================================="
echo ""
echo "You can now run:"
echo "  krypton --help"
echo "  krypton run \"Build a fullstack landing page\""
echo ""
