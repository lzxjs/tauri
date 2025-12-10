use rdev::{Event, EventType};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedEvent {
    pub event_type: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub button: Option<String>,
    pub key: Option<String>,
    pub timestamp: u64,
}

pub struct Recorder {
    events: Vec<RecordedEvent>,
    is_recording: bool,
    start_time: u64,
}

impl Recorder {
    pub fn new() -> Self {
        Self {
            events: Vec::new(),
            is_recording: false,
            start_time: 0,
        }
    }

    pub fn start_recording(&mut self) {
        if self.is_recording {
            return;
        }

        self.is_recording = true;
        self.events.clear();
        self.start_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
    }

    pub fn stop_recording(&mut self) -> Vec<RecordedEvent> {
        self.is_recording = false;
        self.events.clone()
    }

    pub fn stop_recording_flag(&mut self) {
        self.is_recording = false;
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording
    }

    pub fn get_events(&self) -> Vec<RecordedEvent> {
        self.events.clone()
    }

    pub fn process_event(&mut self, event: Event) {
        if !self.is_recording {
            return;
        }

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
            - self.start_time;

        let recorded_event = match event.event_type {
            EventType::MouseMove { x, y } => Some(RecordedEvent {
                event_type: "MouseMove".to_string(),
                x: Some(x),
                y: Some(y),
                button: None,
                key: None,
                timestamp,
            }),
            EventType::ButtonPress(button) => Some(RecordedEvent {
                event_type: "ButtonPress".to_string(),
                x: None,
                y: None,
                button: Some(format!("{:?}", button)),
                key: None,
                timestamp,
            }),
            EventType::ButtonRelease(button) => Some(RecordedEvent {
                event_type: "ButtonRelease".to_string(),
                x: None,
                y: None,
                button: Some(format!("{:?}", button)),
                key: None,
                timestamp,
            }),
            EventType::KeyPress(key) => Some(RecordedEvent {
                event_type: "KeyPress".to_string(),
                x: None,
                y: None,
                button: None,
                key: Some(format!("{:?}", key)),
                timestamp,
            }),
            EventType::KeyRelease(key) => Some(RecordedEvent {
                event_type: "KeyRelease".to_string(),
                x: None,
                y: None,
                button: None,
                key: Some(format!("{:?}", key)),
                timestamp,
            }),
            _ => None,
        };

        if let Some(evt) = recorded_event {
            self.events.push(evt);
        }
    }
}
