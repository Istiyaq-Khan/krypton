# ------------------------------------------------------------------------------
# Krypton Single-Step Universal Installer for Windows
# Installs everything into %USERPROFILE%\.krypton\ and adds krypton to User PATH
# Works for both remote one-liner (irm ... | iex) and local development.
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

# Create required directories
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

# 2. Resolve or download binary
$TargetBinary = Join-Path $BinDir "krypton.exe"
$Installed = $false

# Check if running locally within repository
$ScriptDir = $null
if ($MyInvocation -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Definition) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

$RepoRoot = if ($ScriptDir) { Split-Path -Parent $ScriptDir } else { $null }

if ($RepoRoot -and (Test-Path (Join-Path $RepoRoot "package.json"))) {
    Write-Host "Detected local Krypton repository at $RepoRoot" -ForegroundColor Gray
    $DistBinary = Join-Path $RepoRoot "packages\cli\dist\krypton.exe"
    $RootBinary = Join-Path $RepoRoot "krypton.exe"

    if (Test-Path $DistBinary) {
        Copy-Item $DistBinary $TargetBinary -Force
        $Installed = $true
    } elseif (Test-Path $RootBinary) {
        Copy-Item $RootBinary $TargetBinary -Force
        $Installed = $true
    } else {
        Write-Host "Building local standalone CLI executable..." -ForegroundColor Gray
        try {
            node (Join-Path $ScriptDir "build-cli.mjs")
            if (Test-Path $DistBinary) {
                Copy-Item $DistBinary $TargetBinary -Force
                $Installed = $true
            }
        } catch {
            Write-Host "Local build failed, will try release download..." -ForegroundColor Yellow
        }
    }
}

# If not installed from local repo, download from GitHub Releases
if (-not $Installed) {
    Write-Host "Downloading latest Krypton release from GitHub..." -ForegroundColor Cyan
    $ReleaseUrls = @(
        "https://github.com/Istiyaq-Khan/krypton/releases/latest/download/krypton-windows-x86_64.exe",
        "https://github.com/Istiyaq-Khan/krypton/releases/latest/download/krypton.exe"
    )

    foreach ($url in $ReleaseUrls) {
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $url -OutFile $TargetBinary -UseBasicParsing -TimeoutSec 30
            if ((Test-Path $TargetBinary) -and (Get-Item $TargetBinary).Length -gt 1000) {
                Write-Host "[OK] Successfully downloaded executable from $url" -ForegroundColor Green
                $Installed = $true
                break
            }
        } catch {
            # Try next URL
        }
    }

    # Fallback wrapper if offline or pre-release
    if (-not $Installed) {
        if (-not (Test-Path $TargetBinary)) {
            Write-Host "Notice: No published GitHub release binary found yet." -ForegroundColor Yellow
            Write-Host "Creating portable CLI starter shim..." -ForegroundColor Gray
            $ShimContent = @"
@echo off
echo Krypton standalone binary will be available with the next GitHub release.
echo To run from source in the meantime, run: pnpm --filter @krypton/cli dev -- %*
"@
            $ShimPath = Join-Path $BinDir "krypton.cmd"
            $ShimContent | Out-File -FilePath $ShimPath -Encoding ascii -Force
            # Also write placeholder exe
            "MZ" | Out-File -FilePath $TargetBinary -Encoding ascii -Force
        }
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
Write-Host "  Directory: $KryptonDir" -ForegroundColor Green
Write-Host "  Binary   : $TargetBinary" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run:" -ForegroundColor Yellow
Write-Host "  krypton --help" -ForegroundColor Cyan
Write-Host "  krypton run 'Build a fullstack landing page'" -ForegroundColor Cyan
Write-Host ""
