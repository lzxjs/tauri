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
        let mut ctrl_pressed = false;

        if let Err(error) = listen(move |event| {
            // 更新 Ctrl 键状态
            match event.event_type {
                EventType::KeyPress(Key::ControlLeft) | EventType::KeyPress(Key::ControlRight) => {
                    ctrl_pressed = true;
                }
                EventType::KeyRelease(Key::ControlLeft) | EventType::KeyRelease(Key::ControlRight) => {
                    ctrl_pressed = false;
                }
                _ => {}
            }

            // 处理停止逻辑 - Ctrl + ESC
            if let EventType::KeyPress(Key::Escape) = event.event_type {
                if ctrl_pressed {
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
                    
                    // 组合键触发后不录制该 ESC 事件
                    return;
                }
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
