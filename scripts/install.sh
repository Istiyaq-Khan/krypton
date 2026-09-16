#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# Krypton Single-Step Universal Installer for macOS & Linux
# Installs everything into $HOME/.krypton/ and adds krypton to PATH.
# Supports both remote one-liner (curl ... | bash) and local development.
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
TARGET_BIN="$BIN_DIR/krypton"

echo "• Installing Krypton into: $KRYPTON_DIR"

mkdir -p "$BIN_DIR"
mkdir -p "$KRYPTON_DIR/agents/default"
mkdir -p "$KRYPTON_DIR/worktrees"
mkdir -p "$KRYPTON_DIR/cache/outputs"
mkdir -p "$KRYPTON_DIR/browser_binaries"
mkdir -p "$KRYPTON_DIR/browser_profiles/whatsapp"
mkdir -p "$KRYPTON_DIR/logs"

# 2. Detect platform & architecture
OS_TYPE="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH_TYPE="$(uname -m | tr '[:upper:]' '[:lower:]')"

if [ "$OS_TYPE" = "darwin" ]; then
  PLATFORM="macos"
  if [ "$ARCH_TYPE" = "arm64" ] || [ "$ARCH_TYPE" = "aarch64" ]; then
    RELEASE_ASSET="krypton-macos-aarch64"
  else
    RELEASE_ASSET="krypton-macos-x86_64"
  fi
elif [ "$OS_TYPE" = "linux" ]; then
  PLATFORM="linux"
  if [ "$ARCH_TYPE" = "aarch64" ] || [ "$ARCH_TYPE" = "arm64" ]; then
    RELEASE_ASSET="krypton-linux-aarch64"
  else
    RELEASE_ASSET="krypton-linux-x86_64"
  fi
else
  PLATFORM="unix"
  RELEASE_ASSET="krypton"
fi

echo "• Detected system: $PLATFORM ($ARCH_TYPE)"

INSTALLED=0

# Check if running locally in a cloned repository
if [ -n "${BASH_SOURCE[0]}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

  if [ -f "$REPO_ROOT/package.json" ]; then
    echo "• Detected local Krypton repository at $REPO_ROOT"
    DIST_BIN="$REPO_ROOT/packages/cli/dist/krypton"
    ROOT_BIN="$REPO_ROOT/krypton"

    if [ -f "$DIST_BIN" ]; then
      cp "$DIST_BIN" "$TARGET_BIN"
      INSTALLED=1
    elif [ -f "$ROOT_BIN" ]; then
      cp "$ROOT_BIN" "$TARGET_BIN"
      INSTALLED=1
    else
      echo "• Building standalone CLI binary..."
      node "$SCRIPT_DIR/build-cli.mjs" || true
      if [ -f "$DIST_BIN" ]; then
        cp "$DIST_BIN" "$TARGET_BIN"
        INSTALLED=1
      fi
    fi
  fi
fi

# Download prebuilt binary from GitHub Releases if not installed from local repo
if [ $INSTALLED -eq 0 ]; then
  echo "• Downloading standalone binary from GitHub Releases..."
  RELEASE_URL="https://github.com/Istiyaq-Khan/krypton/releases/latest/download/$RELEASE_ASSET"
  FALLBACK_URL="https://github.com/Istiyaq-Khan/krypton/releases/latest/download/krypton"

  DOWNLOADED=0
  if command -v curl >/dev/null 2>&1; then
    if curl -fsSL "$RELEASE_URL" -o "$TARGET_BIN" 2>/dev/null; then
      DOWNLOADED=1
    elif curl -fsSL "$FALLBACK_URL" -o "$TARGET_BIN" 2>/dev/null; then
      DOWNLOADED=1
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -qO "$TARGET_BIN" "$RELEASE_URL" 2>/dev/null; then
      DOWNLOADED=1
    elif wget -qO "$TARGET_BIN" "$FALLBACK_URL" 2>/dev/null; then
      DOWNLOADED=1
    fi
  fi

  if [ $DOWNLOADED -eq 1 ] && [ -s "$TARGET_BIN" ]; then
    echo "✔ Downloaded release binary to $TARGET_BIN"
    INSTALLED=1
  else
    echo "• Note: Pre-compiled binary will be available upon official release tag."
    echo "• Creating portable CLI fallback launcher..."
    cat <<'EOF' > "$TARGET_BIN"
#!/bin/sh
echo "Krypton standalone binary will be available with the next GitHub release."
echo "To run from source in the meantime, run: pnpm --filter @krypton/cli dev -- \"$@\""
EOF
    INSTALLED=1
  fi
fi

chmod +x "$TARGET_BIN"

# 3. Create default config.json if not present
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
      echo "# Krypton Autonomous Desktop AI" >> "$profile"
      echo "$EXPORT_LINE" >> "$profile"
      echo "✔ Added $BIN_DIR to $profile"
      UPDATED=1
    fi
  fi
done

if [ $UPDATED -eq 0 ] && [ -f "$HOME/.profile" ]; then
  echo "$EXPORT_LINE" >> "$HOME/.profile"
fi

echo ""
echo "=========================================="
echo "✔ Installation Complete!"
echo "  Directory: $KRYPTON_DIR"
echo "  Binary   : $TARGET_BIN"
echo "=========================================="
echo ""
echo "You can now run:"
echo "  krypton --help"
echo "  krypton run \"Build a fullstack landing page\""
echo ""
