# ------------------------------------------------------------------------------
# Krypton Windows Uninstaller Script
# Removes Krypton binaries, PATH configuration, registry uninstall metadata,
# Start Menu shortcuts, and optionally purges all application runtime data.
# ------------------------------------------------------------------------------

param(
    [switch]$Quiet,
    [switch]$PurgeData
)

$ErrorActionPreference = "SilentlyContinue"

if (-not $Quiet) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "       Krypton Windows Uninstaller        " -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

# 1. Stop active processes
if (-not $Quiet) { Write-Host "• Stopping active Krypton daemons and processes..." -ForegroundColor Gray }
Get-Process -Name "krypton", "krypton-daemon", "krypton-cli" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Resolve paths
$UserHome = [Environment]::GetFolderPath("UserProfile")
$KryptonDir = Join-Path $UserHome ".krypton"
$BinDir = Join-Path $KryptonDir "bin"

# 3. Remove Start Menu and Desktop Shortcuts
if (-not $Quiet) { Write-Host "• Removing shortcuts..." -ForegroundColor Gray }
$StartMenuPath = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\Krypton.lnk"
if (Test-Path $StartMenuPath) { Remove-Item $StartMenuPath -Force -ErrorAction SilentlyContinue }

$DesktopPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Krypton.lnk"
if (Test-Path $DesktopPath) { Remove-Item $DesktopPath -Force -ErrorAction SilentlyContinue }

# 4. Remove binaries from ~/.krypton/bin
if (-not $Quiet) { Write-Host "• Removing application binaries..." -ForegroundColor Gray }
$Binaries = @("krypton.exe", "krypton.cmd", "krypton-cli.exe", "krypton-daemon.exe")
foreach ($bin in $Binaries) {
    $p = Join-Path $BinDir $bin
    if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
}

# 5. Remove from User PATH
if (-not $Quiet) { Write-Host "• Cleaning User PATH environment variable..." -ForegroundColor Gray }
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -like "*$BinDir*") {
    $PathParts = $CurrentPath.Split(';') | Where-Object { $_ -and $_.Trim() -ne $BinDir }
    $NewPath = $PathParts -join ';'
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + $NewPath
}

# 6. Unregister Windows Uninstall Registry Key
if (-not $Quiet) { Write-Host "• Unregistering Windows Uninstall metadata..." -ForegroundColor Gray }
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\krypton"
if (Test-Path $RegPath) {
    Remove-Item -Path $RegPath -Recurse -Force -ErrorAction SilentlyContinue
}

# 7. Purge data directories if requested
if ($PurgeData) {
    if (-not $Quiet) { Write-Host "• Purging all user data directories..." -ForegroundColor Yellow }
    $DataDirs = @(
        $KryptonDir,
        (Join-Path $env:APPDATA "krypton"),
        (Join-Path $env:APPDATA "com.krypton.desktop"),
        (Join-Path $env:LOCALAPPDATA "krypton"),
        (Join-Path $env:LOCALAPPDATA "com.krypton.desktop")
    )
    foreach ($dir in $DataDirs) {
        if ($dir -and (Test-Path $dir)) {
            Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

if (-not $Quiet) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "[OK] Krypton uninstalled successfully!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
}
