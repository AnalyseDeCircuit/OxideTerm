//! State persistence using redb + postcard
//! Handles session metadata and forward rules persistence

pub mod forwarding;
pub mod session;
pub mod store;

pub use forwarding::PersistedForward;
pub use session::{BufferConfig, PersistedSession, SessionPersistence};
pub use store::{StateError, StateStore};

/// Serde helper for DateTime<Utc> as i64 timestamp (postcard compatible)
pub mod datetime_serde {
    use chrono::{DateTime, TimeZone, Utc};
    use serde::{self, Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(date: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_i64(date.timestamp_millis())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let millis = i64::deserialize(deserializer)?;
        Utc.timestamp_millis_opt(millis)
            .single()
            .ok_or_else(|| serde::de::Error::custom("invalid timestamp"))
    }
}
