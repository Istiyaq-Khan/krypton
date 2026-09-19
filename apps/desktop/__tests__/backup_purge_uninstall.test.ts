import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("Issue #12: Cross-Platform Uninstallation Registration, Backup Vault & Complete Purge Engine", () => {
  const kryptonSettingsPath = path.resolve(__dirname, "../src/components/settings/KryptonSettings.tsx")
  const windowHeaderPath = path.resolve(__dirname, "../src/components/layout/WindowHeader.tsx")
  const maintenanceRustPath = path.resolve(__dirname, "../src-tauri/src/commands/maintenance.rs")
  const libRustPath = path.resolve(__dirname, "../src-tauri/src/lib.rs")
  const installPs1Path = path.resolve(__dirname, "../../../scripts/install.ps1")
  const uninstallPs1Path = path.resolve(__dirname, "../../../scripts/uninstall.ps1")
  const installShPath = path.resolve(__dirname, "../../../scripts/install.sh")
  const uninstallShPath = path.resolve(__dirname, "../../../scripts/uninstall.sh")
  const desktopEntryPath = path.resolve(__dirname, "../../../scripts/linux/krypton.desktop")
  const prermPath = path.resolve(__dirname, "../../../scripts/linux/prerm")
  const postrmPath = path.resolve(__dirname, "../../../scripts/linux/postrm")


  it("1. Settings Navigation: registers 'data' category and Data & Maintenance sidebar item", () => {
    expect(fs.existsSync(kryptonSettingsPath)).toBe(true)
    const settingsSource = fs.readFileSync(kryptonSettingsPath, "utf-8")

    expect(settingsSource).toContain('type SettingsCategory = "general" | "agents" | "providers" | "appearance"')
    expect(settingsSource).toContain('"data"')
    expect(settingsSource).toContain('onClick={() => setActiveCategory("data")}')
    expect(settingsSource).toContain("Data & Maintenance")
  })

  it("2. Window Header: wires Data & Maintenance in Settings dropdown menu", () => {
    expect(fs.existsSync(windowHeaderPath)).toBe(true)
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    expect(headerSource).toContain('onOpenSettings?.("data")')
    expect(headerSource).toContain("Data & Maintenance")
  })

  it("3. Backup Vault: integrates recursive export, native dialog, and compressed archive generation", () => {
    const settingsSource = fs.readFileSync(kryptonSettingsPath, "utf-8")

    expect(settingsSource).toContain("Backup & Export Vault")
    expect(settingsSource).toContain("handleExportBackup")
    expect(settingsSource).toContain("select_backup_save_dialog")
    expect(settingsSource).toContain("create_backup_vault")
    expect(settingsSource).toContain("krypton-vault-backup-")
  })

  it("4. Factory Reset: enforces double-confirmation modal with 'RESET' confirmation token", () => {
    const settingsSource = fs.readFileSync(kryptonSettingsPath, "utf-8")

    expect(settingsSource).toContain("Factory Reset & Complete Data Purge")
    expect(settingsSource).toContain("isPurgeModalOpen")
    expect(settingsSource).toContain("purgeStep")
    expect(settingsSource).toContain("RESET")
    expect(settingsSource).toContain("purge_app_data_and_reset")
    expect(settingsSource).toContain("handleExecutePurge")
  })

  it("5. In-App Uninstallation Trigger: integrates platform-aware teardown with optional purge", () => {
    const settingsSource = fs.readFileSync(kryptonSettingsPath, "utf-8")

    expect(settingsSource).toContain("Uninstall Krypton")
    expect(settingsSource).toContain("isUninstallModalOpen")
    expect(settingsSource).toContain("uninstallWithPurge")
    expect(settingsSource).toContain("trigger_app_uninstall")
    expect(settingsSource).toContain("handleExecuteUninstall")
  })

  it("6. Rust Backend: maintenance commands registered and compiled", () => {
    expect(fs.existsSync(maintenanceRustPath)).toBe(true)
    const maintSource = fs.readFileSync(maintenanceRustPath, "utf-8")

    expect(maintSource).toContain("pub fn create_backup_vault")
    expect(maintSource).toContain("pub fn select_backup_save_dialog")
    expect(maintSource).toContain("pub fn purge_app_data_and_reset")
    expect(maintSource).toContain("pub fn trigger_app_uninstall")
    expect(maintSource).toContain("pub fn get_storage_paths_info")

    const libSource = fs.readFileSync(libRustPath, "utf-8")
    expect(libSource).toContain("create_backup_vault,")
    expect(libSource).toContain("select_backup_save_dialog,")
    expect(libSource).toContain("purge_app_data_and_reset,")
    expect(libSource).toContain("trigger_app_uninstall,")
    expect(libSource).toContain("get_storage_paths_info,")
  })

  it("7. Windows Packaging: install.ps1 registers complete uninstall registry keys and provides uninstall.ps1", () => {
    expect(fs.existsSync(installPs1Path)).toBe(true)
    expect(fs.existsSync(uninstallPs1Path)).toBe(true)

    const installPs1 = fs.readFileSync(installPs1Path, "utf-8")
    expect(installPs1).toContain("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\krypton")
    expect(installPs1).toContain("DisplayName")
    expect(installPs1).toContain("DisplayVersion")
    expect(installPs1).toContain("Publisher")
    expect(installPs1).toContain("DisplayIcon")
    expect(installPs1).toContain("UninstallString")
    expect(installPs1).toContain("QuietUninstallString")
    expect(installPs1).toContain("InstallLocation")

    const uninstallPs1 = fs.readFileSync(uninstallPs1Path, "utf-8")
    expect(uninstallPs1).toContain("Uninstall\\krypton")
    expect(uninstallPs1).toContain("PurgeData")
  })

  it("8. Unix Packaging: install.sh & uninstall.sh configure FreeDesktop shortcuts, LaunchAgents, and package hooks", () => {
    expect(fs.existsSync(installShPath)).toBe(true)
    expect(fs.existsSync(uninstallShPath)).toBe(true)
    expect(fs.existsSync(desktopEntryPath)).toBe(true)
    expect(fs.existsSync(prermPath)).toBe(true)
    expect(fs.existsSync(postrmPath)).toBe(true)

    const installSh = fs.readFileSync(installShPath, "utf-8")
    expect(installSh).toContain("krypton.desktop")
    expect(installSh).toContain("uninstall.sh")

    const uninstallSh = fs.readFileSync(uninstallShPath, "utf-8")
    expect(uninstallSh).toContain("com.krypton.daemon.plist")
    expect(uninstallSh).toContain("krypton.desktop")
    expect(uninstallSh).toContain("PURGE_DATA")
  })
})
