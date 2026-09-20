pub mod commands;
pub mod overlay;
pub mod paths;

use commands::*;
use overlay::*;
use paths::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .runtime(tauri_runtime_wry::Wry::default())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|_app| {
            // Ensure standard ~/.krypton folders exist on startup
            if let Err(err) = paths::ensure_krypton_directories() {
                log::warn!("Krypton directory bootstrap warning: {}", err);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_krypton_paths,
            spawn_daemon,
            stop_daemon,
            get_daemon_status,
            ping_daemon,
            toggle_synapse,
            show_synapse,
            hide_synapse,
            center_synapse,
            set_synapse_clickthrough,
            toggle_overlay,
            show_overlay,
            hide_overlay,
            center_overlay,
            set_overlay_clickthrough,
            get_global_hotkey,
            set_global_hotkey,
            trigger_hotkey_overlay,
            broadcast_synapse_transcription,
            get_audio_status,
            start_audio_capture,
            stop_audio_capture,
            get_audio_devices,
            set_stt_provider,
            submit_chat_turn,
            install_cli_to_path,
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_is_maximized,
            check_setup_status,
            save_setup_configuration,
            get_cached_models,
            save_cached_models,
            get_provider_config,
            get_app_settings,
            save_app_settings,
            save_agent_config,
            list_agents_config,
            create_backup_vault,
            select_backup_save_dialog,
            purge_app_data_and_reset,
            trigger_app_uninstall,
            get_storage_paths_info,
        ])

        .run(tauri::generate_context!())
        .expect("error while running krypton desktop application");
}
