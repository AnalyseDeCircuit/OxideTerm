//! Transfer Manager for SFTP operations
//!
//! Provides concurrent transfer control with pause/cancel support.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::RwLock;
use tokio::sync::Semaphore;
use tracing::{debug, info, warn};

use super::types::constants;

/// Transfer control signals
#[derive(Debug)]
pub struct TransferControl {
    /// Cancelled flag
    cancelled: AtomicBool,
    /// Pause signal
    paused: AtomicBool,
}

impl TransferControl {
    pub fn new() -> Self {
        Self {
            cancelled: AtomicBool::new(false),
            paused: AtomicBool::new(false),
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn pause(&self) {
        self.paused.store(true, Ordering::SeqCst);
    }

    pub fn resume(&self) {
        self.paused.store(false, Ordering::SeqCst);
    }
}

impl Default for TransferControl {
    fn default() -> Self {
        Self::new()
    }
}

/// Transfer Manager handles concurrent transfers
pub struct TransferManager {
    /// Semaphore for limiting concurrent transfers
    semaphore: Arc<Semaphore>,
    /// Active transfer controls
    controls: RwLock<HashMap<String, Arc<TransferControl>>>,
    /// Active transfer count
    active_count: RwLock<usize>,
}

impl TransferManager {
    pub fn new() -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(constants::MAX_CONCURRENT_TRANSFERS)),
            controls: RwLock::new(HashMap::new()),
            active_count: RwLock::new(0),
        }
    }

    /// Register a new transfer and get its control handle
    pub fn register(&self, transfer_id: &str) -> Arc<TransferControl> {
        let control = Arc::new(TransferControl::new());
        self.controls.write().insert(transfer_id.to_string(), control.clone());
        info!("Registered transfer: {}", transfer_id);
        control
    }

    /// Get control handle for a transfer
    pub fn get_control(&self, transfer_id: &str) -> Option<Arc<TransferControl>> {
        self.controls.read().get(transfer_id).cloned()
    }

    /// Remove a transfer from tracking
    pub fn unregister(&self, transfer_id: &str) {
        self.controls.write().remove(transfer_id);
        debug!("Unregistered transfer: {}", transfer_id);
    }

    /// Acquire a permit for concurrent transfer (blocks if at limit)
    pub async fn acquire_permit(&self) -> tokio::sync::OwnedSemaphorePermit {
        let permit = self.semaphore.clone().acquire_owned().await
            .expect("Semaphore closed unexpectedly");
        *self.active_count.write() += 1;
        debug!("Acquired transfer permit, active count: {}", *self.active_count.read());
        permit
    }

    /// Get current active transfer count
    pub fn active_count(&self) -> usize {
        *self.active_count.read()
    }

    /// Get maximum concurrent transfers
    pub fn max_concurrent(&self) -> usize {
        constants::MAX_CONCURRENT_TRANSFERS
    }

    /// Cancel a specific transfer
    pub fn cancel(&self, transfer_id: &str) -> bool {
        if let Some(control) = self.controls.read().get(transfer_id) {
            control.cancel();
            info!("Cancelled transfer: {}", transfer_id);
            true
        } else {
            warn!("Transfer not found for cancel: {}", transfer_id);
            false
        }
    }

    /// Pause a specific transfer (simplified: pause = cancel, resume = restart)
    pub fn pause(&self, transfer_id: &str) -> bool {
        if let Some(control) = self.controls.read().get(transfer_id) {
            // Simplified approach: pause is same as cancel
            // User must restart transfer to resume
            control.cancel();
            info!("Paused (cancelled) transfer: {}", transfer_id);
            true
        } else {
            warn!("Transfer not found for pause: {}", transfer_id);
            false
        }
    }

    /// Resume a specific transfer (simplified: not supported, must restart transfer)
    pub fn resume(&self, transfer_id: &str) -> bool {
        // Simplified: resume not supported in v0.1.0
        // User must re-initiate the transfer
        warn!("Resume not supported - transfer was cancelled: {}", transfer_id);
        false
    }

    /// Cancel all active transfers
    pub fn cancel_all(&self) {
        let controls = self.controls.read();
        for (id, control) in controls.iter() {
            control.cancel();
            info!("Cancelled transfer: {}", id);
        }
    }

    /// Decrement active count (called when transfer completes)
    pub fn on_transfer_complete(&self) {
        let mut count = self.active_count.write();
        if *count > 0 {
            *count -= 1;
        }
        debug!("Transfer complete, active count: {}", *count);
    }
}

impl Default for TransferManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Check loop helper for pause/cancel during transfer
pub async fn check_transfer_control(control: &TransferControl) -> Result<(), super::error::SftpError> {
    // Simplified: only check cancellation (pause = cancel in v0.1.0)
    if control.is_cancelled() {
        return Err(super::error::SftpError::TransferCancelled);
    }

    // Note: Pause functionality removed - pause now directly cancels the transfer
    // Users must restart the transfer to continue

    Ok(())
}
