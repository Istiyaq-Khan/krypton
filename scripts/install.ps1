# ------------------------------------------------------------------------------
# Krypton Single-Step Universal Installer for Windows
# Installs everything into %USERPROFILE%\.krypton\ and adds krypton to User PATH
# ------------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Krypton Autonomous Desktop AI Runtime   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Resolve target installation directory: %USERPROFILE%\.krypton
$UserHome = [Environment]::GetFolderPath("UserProfile")
$KryptonDir = Join-Path $UserHome ".krypton"
$BinDir = Join-Path $KryptonDir "bin"

Write-Host "Installing Krypton into: $KryptonDir" -ForegroundColor Yellow

# Create standard directories
$SubDirs = @(
    $BinDir,
    (Join-Path $KryptonDir "agents\default"),
    (Join-Path $KryptonDir "worktrees"),
    (Join-Path $KryptonDir "cache\outputs"),
    (Join-Path $KryptonDir "browser_binaries"),
    (Join-Path $KryptonDir "browser_profiles\whatsapp"),
    (Join-Path $KryptonDir "logs")
)

foreach ($dir in $SubDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# 2. Check source directory or copy standalone executable
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir
$BuiltBinary = Join-Path $RepoRoot "krypton.exe"
$DistBinary = Join-Path $RepoRoot "packages\cli\dist\krypton.exe"
$TargetBinary = Join-Path $BinDir "krypton.exe"

if (Test-Path $DistBinary) {
    Copy-Item $DistBinary $TargetBinary -Force
    Write-Host "[OK] Installed binary to $TargetBinary" -ForegroundColor Green
} elseif (Test-Path $BuiltBinary) {
    Copy-Item $BuiltBinary $TargetBinary -Force
    Write-Host "[OK] Installed binary to $TargetBinary" -ForegroundColor Green
} else {
    Write-Host "Building standalone Krypton binary..." -ForegroundColor Gray
    try {
        node (Join-Path $ScriptDir "build-cli.mjs")
        if (Test-Path $DistBinary) {
            Copy-Item $DistBinary $TargetBinary -Force
            Write-Host "[OK] Installed binary to $TargetBinary" -ForegroundColor Green
        }
    } catch {
        # Fallback batch wrapper
        $WrapperPath = Join-Path $BinDir "krypton.cmd"
        $CliEntry = Join-Path $RepoRoot "packages\cli\dist\index.js"
        $lines = @(
            "@echo off",
            "node `"$CliEntry`" %*"
        )
        $lines | Out-File -FilePath $WrapperPath -Encoding ascii -Force
        Write-Host "[OK] Created wrapper at $WrapperPath" -ForegroundColor Green
    }
}

# 3. Create default config.json if not present
$ConfigFile = Join-Path $KryptonDir "config.json"
if (-not (Test-Path $ConfigFile)) {
    $DefaultConfig = @{
        version = "0.1.0"
        activeModel = "claude-3-7-sonnet"
        concurrencyLimit = 5
        maxRecursionDepth = 3
    } | ConvertTo-Json -Depth 4
    $DefaultConfig | Out-File -FilePath $ConfigFile -Encoding utf8 -Force
}

# 4. Automatically configure User PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*$BinDir*") {
    Write-Host "Adding $BinDir to User PATH..." -ForegroundColor Gray
    $NewPath = if ([string]::IsNullOrWhiteSpace($CurrentPath)) { $BinDir } else { "$CurrentPath;$BinDir" }
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$BinDir"
    Write-Host "[OK] User PATH updated successfully." -ForegroundColor Green
} else {
    Write-Host "[OK] $BinDir is already in User PATH." -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "[OK] Installation Complete!" -ForegroundColor Green
Write-Host "  Location: $KryptonDir" -ForegroundColor Green
Write-Host "  Binary  : $TargetBinary" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run:" -ForegroundColor Yellow
Write-Host "  krypton --help" -ForegroundColor Cyan
Write-Host "  krypton run 'Build a fullstack landing page'" -ForegroundColor Cyan
Write-Host ""
