use crate::recorder::RecordedEvent;
use parking_lot::Mutex;
use rdev::{simulate, Button, EventType, Key};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

pub struct Player {
    is_playing: Arc<Mutex<bool>>,
    should_stop: Arc<Mutex<bool>>,
}

impl Player {
    pub fn new() -> Self {
        Self {
            is_playing: Arc::new(Mutex::new(false)),
            should_stop: Arc::new(Mutex::new(false)),
        }
    }

    pub fn play_events(&self, events: Vec<RecordedEvent>, repeat_count: u32) -> Result<(), String> {
        if events.is_empty() {
            return Err("没有可回放的事件".to_string());
        }

        let mut is_playing = self.is_playing.lock();
        if *is_playing {
            return Err("正在回放中".to_string());
        }

        *is_playing = true;
        *self.should_stop.lock() = false;

        let is_playing_clone = Arc::clone(&self.is_playing);
        let should_stop = Arc::clone(&self.should_stop);

        thread::spawn(move || {
            let infinite = repeat_count == 0;
            let mut current_repeat = 0u32;

            'outer: loop {
                if *should_stop.lock() {
                    break;
                }

                if !infinite {
                    current_repeat += 1;
                    if current_repeat > repeat_count {
                        break;
                    }
                }

                let mut last_timestamp = 0u64;

                for event in &events {
                    if *should_stop.lock() {
                        break 'outer;
                    }

                    // 等待到事件应该发生的时间
                    let delay = event.timestamp.saturating_sub(last_timestamp);
                    if delay > 0 {
                        thread::sleep(Duration::from_millis(delay));
                    }
                    last_timestamp = event.timestamp;

                    // 模拟事件
                    let result = match event.event_type.as_str() {
                        "MouseMove" => {
                            if let (Some(x), Some(y)) = (event.x, event.y) {
                                simulate(&EventType::MouseMove { x, y })
                            } else {
                                Ok(())
                            }
                        }
                        "ButtonPress" => {
                            if let Some(button_str) = &event.button {
                                let button = parse_button(button_str);
                                simulate(&EventType::ButtonPress(button))
                            } else {
                                Ok(())
                            }
                        }
                        "ButtonRelease" => {
                            if let Some(button_str) = &event.button {
                                let button = parse_button(button_str);
                                simulate(&EventType::ButtonRelease(button))
                            } else {
                                Ok(())
                            }
                        }
                        "KeyPress" => {
                            if let Some(key_str) = &event.key {
                                if let Some(key) = parse_key(key_str) {
                                    simulate(&EventType::KeyPress(key))
                                } else {
                                    Ok(())
                                }
                            } else {
                                Ok(())
                            }
                        }
                        "KeyRelease" => {
                            if let Some(key_str) = &event.key {
                                if let Some(key) = parse_key(key_str) {
                                    simulate(&EventType::KeyRelease(key))
                                } else {
                                    Ok(())
                                }
                            } else {
                                Ok(())
                            }
                        }
                        _ => Ok(()),
                    };

                    if let Err(e) = result {
                        eprintln!("模拟事件失败: {:?}", e);
                    }
                }

                // 每次循环之间稍微延迟
                if infinite || current_repeat < repeat_count {
                    thread::sleep(Duration::from_millis(500));
                }
            }

            *is_playing_clone.lock() = false;
        });

        Ok(())
    }

    pub fn stop_playing(&self) {
        *self.should_stop.lock() = true;
    }

    pub fn is_playing(&self) -> bool {
        *self.is_playing.lock()
    }
}

fn parse_button(button_str: &str) -> Button {
    match button_str {
        "Left" => Button::Left,
        "Right" => Button::Right,
        "Middle" => Button::Middle,
        _ => Button::Left,
    }
}

fn parse_key(key_str: &str) -> Option<Key> {
    match key_str {
        "KeyA" => Some(Key::KeyA),
        "KeyB" => Some(Key::KeyB),
        "KeyC" => Some(Key::KeyC),
        "KeyD" => Some(Key::KeyD),
        "KeyE" => Some(Key::KeyE),
        "KeyF" => Some(Key::KeyF),
        "KeyG" => Some(Key::KeyG),
        "KeyH" => Some(Key::KeyH),
        "KeyI" => Some(Key::KeyI),
        "KeyJ" => Some(Key::KeyJ),
        "KeyK" => Some(Key::KeyK),
        "KeyL" => Some(Key::KeyL),
        "KeyM" => Some(Key::KeyM),
        "KeyN" => Some(Key::KeyN),
        "KeyO" => Some(Key::KeyO),
        "KeyP" => Some(Key::KeyP),
        "KeyQ" => Some(Key::KeyQ),
        "KeyR" => Some(Key::KeyR),
        "KeyS" => Some(Key::KeyS),
        "KeyT" => Some(Key::KeyT),
        "KeyU" => Some(Key::KeyU),
        "KeyV" => Some(Key::KeyV),
        "KeyW" => Some(Key::KeyW),
        "KeyX" => Some(Key::KeyX),
        "KeyY" => Some(Key::KeyY),
        "KeyZ" => Some(Key::KeyZ),
        "Num0" => Some(Key::Num0),
        "Num1" => Some(Key::Num1),
        "Num2" => Some(Key::Num2),
        "Num3" => Some(Key::Num3),
        "Num4" => Some(Key::Num4),
        "Num5" => Some(Key::Num5),
        "Num6" => Some(Key::Num6),
        "Num7" => Some(Key::Num7),
        "Num8" => Some(Key::Num8),
        "Num9" => Some(Key::Num9),
        "Return" => Some(Key::Return),
        "Space" => Some(Key::Space),
        "BackSpace" => Some(Key::Backspace),
        "Tab" => Some(Key::Tab),
        "ShiftLeft" => Some(Key::ShiftLeft),
        "ShiftRight" => Some(Key::ShiftRight),
        "ControlLeft" => Some(Key::ControlLeft),
        "ControlRight" => Some(Key::ControlRight),
        "Alt" => Some(Key::Alt),
        "AltGr" => Some(Key::AltGr),
        "CapsLock" => Some(Key::CapsLock),
        "Delete" => Some(Key::Delete),
        "End" => Some(Key::End),
        "Home" => Some(Key::Home),
        "PageDown" => Some(Key::PageDown),
        "PageUp" => Some(Key::PageUp),
        "UpArrow" => Some(Key::UpArrow),
        "DownArrow" => Some(Key::DownArrow),
        "LeftArrow" => Some(Key::LeftArrow),
        "RightArrow" => Some(Key::RightArrow),
        "Escape" => Some(Key::Escape),
        "F1" => Some(Key::F1),
        "F2" => Some(Key::F2),
        "F3" => Some(Key::F3),
        "F4" => Some(Key::F4),
        "F5" => Some(Key::F5),
        "F6" => Some(Key::F6),
        "F7" => Some(Key::F7),
        "F8" => Some(Key::F8),
        "F9" => Some(Key::F9),
        "F10" => Some(Key::F10),
        "F11" => Some(Key::F11),
        "F12" => Some(Key::F12),
        _ => None,
    }
}
