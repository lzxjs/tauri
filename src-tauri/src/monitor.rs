use rdev::{listen, EventType, Key};
use std::sync::Arc;
use parking_lot::Mutex;
use crate::recorder::Recorder;
use crate::player::Player;

pub fn start_monitor(
    recorder: Arc<Mutex<Recorder>>, 
    player: Arc<Mutex<Player>>
) {
    std::thread::spawn(move || {
        if let Err(error) = listen(move |event| {
            // 处理 ESC 键 - 全局停止
            if let EventType::KeyPress(Key::Escape) = event.event_type {
                // 停止录制
                let mut recorder_guard = recorder.lock();
                if recorder_guard.is_recording() {
                    recorder_guard.stop_recording_flag();
                }

                // 停止回放
                let player_guard = player.lock();
                if player_guard.is_playing() {
                    player_guard.stop_playing();
                }
                
                // ESC 键本身不被录制
                return;
            }

            // 处理录制
            let mut recorder_guard = recorder.lock();
            if recorder_guard.is_recording() {
                recorder_guard.process_event(event);
            }
        }) {
            eprintln!("Monitor error: {:?}", error);
        }
    });
}
