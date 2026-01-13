//! WebSocket Server for SSH bridge with Wire Protocol support

use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

use super::protocol::{data_frame, error_frame, heartbeat_frame, Frame, FrameCodec};
use crate::ssh::{SessionHandle, ExtendedSessionHandle as SshExtendedSessionHandle, SessionCommand};

/// Heartbeat interval (seconds)
const HEARTBEAT_INTERVAL_SECS: u64 = 30;
/// Heartbeat timeout - consider connection dead if no response (seconds)
const HEARTBEAT_TIMEOUT_SECS: u64 = 90;

/// Shared state for a connection
struct ConnectionState {
    /// Last activity timestamp (unix millis)
    last_seen: AtomicU64,
    /// Heartbeat sequence counter
    heartbeat_seq: AtomicU32,
}

impl ConnectionState {
    fn new() -> Self {
        Self {
            last_seen: AtomicU64::new(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
            ),
            heartbeat_seq: AtomicU32::new(0),
        }
    }

    fn touch(&self) {
        self.last_seen.store(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            Ordering::SeqCst,
        );
    }

    fn next_seq(&self) -> u32 {
        self.heartbeat_seq.fetch_add(1, Ordering::SeqCst)
    }

    fn last_seen_millis(&self) -> u64 {
        self.last_seen.load(Ordering::SeqCst)
    }
}

/// Channel for sending resize events back to SSH
pub type ResizeTx = mpsc::Sender<(u16, u16)>;
pub type ResizeRx = mpsc::Receiver<(u16, u16)>;

/// Extended session handle with resize channel
pub struct ExtendedSessionHandle {
    pub handle: SessionHandle,
    pub resize_tx: ResizeTx,
}

/// WebSocket Bridge server
pub struct WsBridge;

impl WsBridge {
    /// Start a new WebSocket bridge for an SSH session
    /// Returns the port number the WS server is listening on
    pub async fn start(session_handle: SessionHandle) -> Result<(String, u16, String), String> {
        // Generate one-time authentication token to prevent local process hijacking
        let token = uuid::Uuid::new_v4().to_string();
        
        // Bind to localhost (not 127.0.0.1) to avoid macOS sandbox issues with WebView
        // Using port 0 lets the OS assign an available port
        let listener = TcpListener::bind("localhost:0")
            .await
            .map_err(|e| format!("Failed to bind WebSocket server: {}", e))?;

        let addr = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?;

        let port = addr.port();
        let session_id = session_handle.id.clone();

        info!(
            "WebSocket bridge started on port {} for session {} with token auth",
            port, session_id
        );

        // Create a oneshot channel to signal when server is ready to accept
        let (ready_tx, ready_rx) = oneshot::channel::<()>();

        // Spawn the server task with token validation
        let token_clone = token.clone();
        tokio::spawn(Self::run_server(listener, session_handle, ready_tx, token_clone));

        // Wait for server to be ready (with timeout)
        let _ = tokio::time::timeout(Duration::from_millis(500), ready_rx).await;

        Ok((session_id, port, token))
    }

    /// Start with resize channel support
    pub async fn start_with_resize(
        session_handle: SessionHandle,
    ) -> Result<(String, u16, String, ResizeRx), String> {
        // Generate one-time authentication token to prevent local process hijacking
        let token = uuid::Uuid::new_v4().to_string();
        
        let (resize_tx, resize_rx) = mpsc::channel::<(u16, u16)>(32);

        let listener = TcpListener::bind("localhost:0")
            .await
            .map_err(|e| format!("Failed to bind WebSocket server: {}", e))?;

        let addr = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?;

        let port = addr.port();
        let session_id = session_handle.id.clone();

        info!(
            "WebSocket bridge (with resize) started on port {} for session {} with token auth",
            port, session_id
        );

        let (ready_tx, ready_rx) = oneshot::channel::<()>();

        let extended = ExtendedSessionHandle {
            handle: session_handle,
            resize_tx,
        };

        let token_clone = token.clone();
        tokio::spawn(Self::run_server_extended(listener, extended, ready_tx, token_clone));

        let _ = tokio::time::timeout(Duration::from_millis(500), ready_rx).await;

        Ok((session_id, port, token, resize_rx))
    }

    /// Start bridge for ExtendedSessionHandle (with command channel)
    /// This is the v2 API that works with SessionRegistry
    pub async fn start_extended(
        session_handle: SshExtendedSessionHandle,
    ) -> Result<(String, u16, String), String> {
        // Generate one-time authentication token to prevent local process hijacking
        let token = uuid::Uuid::new_v4().to_string();
        
        let listener = TcpListener::bind("localhost:0")
            .await
            .map_err(|e| format!("Failed to bind WebSocket server: {}", e))?;

        let addr = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?;

        let port = addr.port();
        let session_id = session_handle.id.clone();

        info!(
            "WebSocket bridge (v2) started on port {} for session {} with token auth",
            port, session_id
        );

        let (ready_tx, ready_rx) = oneshot::channel::<()>();

        let token_clone = token.clone();
        tokio::spawn(Self::run_server_v2(listener, session_handle, ready_tx, token_clone));

        let _ = tokio::time::timeout(Duration::from_millis(500), ready_rx).await;

        Ok((session_id, port, token))
    }

    /// Run the WebSocket server (legacy mode - backward compatible)
    async fn run_server(
        listener: TcpListener,
        session_handle: SessionHandle,
        ready_tx: oneshot::Sender<()>,
        expected_token: String,
    ) {
        let session_id = session_handle.id.clone();

        // Signal that we're ready to accept connections
        let _ = ready_tx.send(());

        // Accept only one connection per session (with timeout)
        let accept_result =
            tokio::time::timeout(Duration::from_secs(30), listener.accept()).await;

        match accept_result {
            Ok(Ok((stream, addr))) => {
                info!(
                    "WebSocket connection from {} for session {}",
                    addr, session_id
                );
                if let Err(e) = Self::handle_connection_v1(stream, session_handle, None, expected_token).await {
                    error!("WebSocket connection error: {}", e);
                }
            }
            Ok(Err(e)) => {
                error!("Failed to accept WebSocket connection: {}", e);
            }
            Err(_) => {
                warn!("WebSocket accept timeout for session {}", session_id);
            }
        }

        info!("WebSocket server stopped for session {}", session_id);
    }

    /// Run the WebSocket server with extended features
    async fn run_server_extended(
        listener: TcpListener,
        extended: ExtendedSessionHandle,
        ready_tx: oneshot::Sender<()>,
        expected_token: String,
    ) {
        let session_id = extended.handle.id.clone();

        let _ = ready_tx.send(());

        let accept_result =
            tokio::time::timeout(Duration::from_secs(30), listener.accept()).await;

        match accept_result {
            Ok(Ok((stream, addr))) => {
                info!(
                    "WebSocket connection (extended) from {} for session {}",
                    addr, session_id
                );
                if let Err(e) =
                    Self::handle_connection_v1(stream, extended.handle, Some(extended.resize_tx), expected_token)
                        .await
                {
                    error!("WebSocket connection error: {}", e);
                }
            }
            Ok(Err(e)) => {
                error!("Failed to accept WebSocket connection: {}", e);
            }
            Err(_) => {
                warn!("WebSocket accept timeout for session {}", session_id);
            }
        }

        info!(
            "WebSocket server (extended) stopped for session {}",
            session_id
        );
    }

    /// Handle a single WebSocket connection with v1 protocol
    async fn handle_connection_v1(
        stream: TcpStream,
        session_handle: SessionHandle,
        resize_tx: Option<ResizeTx>,
        expected_token: String,
    ) -> Result<(), String> {
        // Perform WebSocket handshake (no auth yet)
        let ws_stream = accept_async(stream)
            .await
            .map_err(|e| format!("WebSocket handshake failed: {}", e))?;
        
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        
        // Authenticate: expect first message to contain token
        let auth_result = tokio::time::timeout(
            Duration::from_secs(5),
            ws_receiver.next()
        ).await;
        
        match auth_result {
            Ok(Some(Ok(Message::Text(token)))) => {
                if token.trim() == expected_token {
                    debug!("WebSocket token authentication successful");
                } else {
                    error!("WebSocket token authentication failed: invalid token");
                    return Err("Authentication failed: invalid token".to_string());
                }
            }
            Ok(Some(Ok(Message::Binary(data)))) => {
                let token = String::from_utf8_lossy(&data);
                if token.trim() == expected_token {
                    debug!("WebSocket token authentication successful (binary)");
                } else {
                    error!("WebSocket token authentication failed: invalid token");
                    return Err("Authentication failed: invalid token".to_string());
                }
            }
            Ok(Some(Err(e))) => {
                error!("WebSocket error during authentication: {}", e);
                return Err(format!("Authentication failed: {}", e));
            }
            Ok(None) => {
                error!("WebSocket closed before authentication");
                return Err("Authentication failed: connection closed".to_string());
            }
            Err(_) => {
                error!("WebSocket authentication timeout");
                return Err("Authentication failed: timeout".to_string());
            }
            _ => {
                error!("WebSocket authentication failed: unexpected message type");
                return Err("Authentication failed: unexpected message".to_string());
            }
        }
        
        // Reunite the split stream for further processing
        let ws_stream = ws_sender.reunite(ws_receiver)
            .map_err(|e| format!("Failed to reunite WebSocket stream: {}", e))?;

        debug!(
            "WebSocket handshake and authentication completed for session {}",
            session_handle.id
        );

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        // Extract parts from handle, consuming it properly
        let (id, stdin_tx, mut stdout_rx) = session_handle.into_parts();

        let state = Arc::new(ConnectionState::new());
        let state_out = state.clone();
        let state_hb = state.clone();

        // Channel for sending frames to WebSocket (increased capacity to prevent deadlock)
        let (frame_tx, mut frame_rx) = mpsc::channel::<Bytes>(4096);
        let frame_tx_ssh = frame_tx.clone();
        let frame_tx_hb = frame_tx.clone();

        // Task: Frame sender - consolidates all outgoing frames
        let sender_task = tokio::spawn(async move {
            while let Some(data) = frame_rx.recv().await {
                // Use timeout to detect dead clients (prevents deadlock)
                match tokio::time::timeout(
                    Duration::from_secs(5),
                    ws_sender.send(Message::Binary(data.to_vec()))
                ).await {
                    Ok(Ok(_)) => {
                        // Send successful
                    }
                    Ok(Err(e)) => {
                        debug!("WebSocket send failed: {:?}", e);
                        break;
                    }
                    Err(_) => {
                        warn!("WebSocket send timeout after 5s - client unresponsive, disconnecting");
                    break;
                    }
                }
            }
            debug!("Frame sender stopped");
        });

        // Task: Forward SSH output to WebSocket as Data frames
        let ssh_out_task = tokio::spawn(async move {
            while let Some(data) = stdout_rx.recv().await {
                let frame = data_frame(Bytes::from(data));
                if frame_tx_ssh.send(frame.encode()).await.is_err() {
                    debug!("Frame channel closed");
                    break;
                }
                state_out.touch();
            }
            debug!("SSH -> WS forwarder stopped");
        });

        // Task: Heartbeat sender
        let sid_hb = id.clone();
        let heartbeat_task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(HEARTBEAT_INTERVAL_SECS));
            loop {
                interval.tick().await;

                // Check for timeout
                let now_millis = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                let last = state_hb.last_seen_millis();
                let elapsed_secs = (now_millis - last) / 1000;

                if elapsed_secs > HEARTBEAT_TIMEOUT_SECS {
                    warn!(
                        "Heartbeat timeout for session {} ({}s since last activity)",
                        sid_hb, elapsed_secs
                    );
                    // Send error frame before closing
                    let err = error_frame("Connection timeout - no heartbeat response");
                    let _ = frame_tx_hb.send(err.encode()).await;
                    break;
                }

                // Send heartbeat (non-blocking to avoid backpressure)
                let seq = state_hb.next_seq();
                let frame = heartbeat_frame(seq);
                if frame_tx_hb.try_send(frame.encode()).is_err() {
                    // Channel full means frontend is overloaded - abort heartbeat
                    debug!("Heartbeat channel full, terminating heartbeat task for session {}", sid_hb);
                    break;
                }
                debug!("Sent heartbeat seq={} for session {}", seq, sid_hb);
            }
            debug!("Heartbeat task stopped for session {}", sid_hb);
        });

        // Task: Process incoming WebSocket messages
        let sid_in = id.clone();
        let input_task = tokio::spawn(async move {
            let mut codec = FrameCodec::new();
            let start = Instant::now();

            while let Some(msg) = ws_receiver.next().await {
                match msg {
                    Ok(Message::Binary(data)) => {
                        state.touch();

                        // Feed data to codec
                        codec.feed(&data);

                        // Process all complete frames
                        loop {
                            match codec.decode_next() {
                                Ok(Some(frame)) => {
                                    match frame {
                                        Frame::Data(payload) => {
                                            // Forward to SSH stdin
                                            if stdin_tx.send(payload.to_vec()).await.is_err() {
                                                debug!("SSH stdin channel closed");
                                                return;
                                            }
                                        }
                                        Frame::Resize { cols, rows } => {
                                            info!(
                                                "Resize request: {}x{} for session {}",
                                                cols, rows, sid_in
                                            );
                                            if let Some(ref tx) = resize_tx {
                                                let _ = tx.send((cols, rows)).await;
                                            }
                                        }
                                        Frame::Heartbeat(seq) => {
                                            debug!(
                                                "Received heartbeat ack seq={} for session {}",
                                                seq, sid_in
                                            );
                                            // Heartbeat response received - connection is alive
                                        }
                                        Frame::Error(msg) => {
                                            warn!(
                                                "Received error frame from client: {} for session {}",
                                                msg, sid_in
                                            );
                                        }
                                    }
                                }
                                Ok(None) => {
                                    // Need more data
                                    break;
                                }
                                Err(e) => {
                                    warn!("Protocol decode error: {} for session {}", e, sid_in);
                                    // For backward compatibility, treat as raw data
                                    // This handles legacy clients that don't use the protocol
                                    if start.elapsed() < Duration::from_secs(5) {
                                        // Early in connection, might be legacy client
                                        debug!("Falling back to raw mode for legacy client");
                                        if stdin_tx.send(data.clone()).await.is_err() {
                                            return;
                                        }
                                    }
                                    codec.clear();
                                    break;
                                }
                            }
                        }
                    }
                    Ok(Message::Text(text)) => {
                        state.touch();
                        // Legacy text mode - treat as raw data
                        if stdin_tx.send(text.into_bytes()).await.is_err() {
                            debug!("SSH stdin channel closed");
                            break;
                        }
                    }
                    Ok(Message::Close(_)) => {
                        info!("WebSocket close message received for session {}", sid_in);
                        break;
                    }
                    Ok(Message::Ping(_)) => {
                        debug!("Received ping");
                        state.touch();
                    }
                    Ok(Message::Pong(_)) => {
                        debug!("Received pong");
                        state.touch();
                    }
                    Ok(Message::Frame(_)) => {
                        // Raw frame, ignore
                    }
                    Err(e) => {
                        warn!("WebSocket receive error: {} for session {}", e, sid_in);
                        break;
                    }
                }
            }
            debug!("WS -> SSH forwarder stopped for session {}", sid_in);
        });

        // Wait for any task to complete
        tokio::select! {
            _ = sender_task => {
                debug!("Sender task completed for session {}", id);
            }
            _ = ssh_out_task => {
                debug!("SSH output task completed for session {}", id);
            }
            _ = heartbeat_task => {
                debug!("Heartbeat task completed for session {}", id);
            }
            _ = input_task => {
                debug!("Input task completed for session {}", id);
            }
        }

        info!("WebSocket bridge terminated for session {}", id);
        Ok(())
    }

    /// Run the WebSocket server v2 (with SessionCommand support)
    async fn run_server_v2(
        listener: TcpListener,
        session_handle: SshExtendedSessionHandle,
        ready_tx: oneshot::Sender<()>,
        expected_token: String,
    ) {
        let session_id = session_handle.id.clone();

        let _ = ready_tx.send(());

        let accept_result =
            tokio::time::timeout(Duration::from_secs(30), listener.accept()).await;

        match accept_result {
            Ok(Ok((stream, addr))) => {
                info!(
                    "WebSocket connection (v2) from {} for session {}",
                    addr, session_id
                );
                if let Err(e) = Self::handle_connection_v2(stream, session_handle, expected_token).await {
                    error!("WebSocket connection error: {}", e);
                }
            }
            Ok(Err(e)) => {
                error!("Failed to accept WebSocket connection: {}", e);
            }
            Err(_) => {
                warn!("WebSocket accept timeout for session {}", session_id);
            }
        }

        info!("WebSocket server (v2) stopped for session {}", session_id);
    }

    /// Handle connection with v2 protocol (uses SessionCommand)
    async fn handle_connection_v2(
        stream: TcpStream,
        session_handle: SshExtendedSessionHandle,
        expected_token: String,
    ) -> Result<(), String> {
        // Perform WebSocket handshake (no auth yet)
        let ws_stream = accept_async(stream)
            .await
            .map_err(|e| format!("WebSocket handshake failed: {}", e))?;
        
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        
        // Authenticate: expect first message to contain token
        let auth_result = tokio::time::timeout(
            Duration::from_secs(5),
            ws_receiver.next()
        ).await;
        
        match auth_result {
            Ok(Some(Ok(Message::Text(token)))) => {
                if token.trim() == expected_token {
                    debug!("WebSocket token authentication successful (v2)");
                } else {
                    error!("WebSocket token authentication failed (v2): invalid token");
                    return Err("Authentication failed: invalid token".to_string());
                }
            }
            Ok(Some(Ok(Message::Binary(data)))) => {
                let token = String::from_utf8_lossy(&data);
                if token.trim() == expected_token {
                    debug!("WebSocket token authentication successful (v2, binary)");
                } else {
                    error!("WebSocket token authentication failed (v2): invalid token");
                    return Err("Authentication failed: invalid token".to_string());
                }
            }
            Ok(Some(Err(e))) => {
                error!("WebSocket error during authentication (v2): {}", e);
                return Err(format!("Authentication failed: {}", e));
            }
            Ok(None) => {
                error!("WebSocket closed before authentication (v2)");
                return Err("Authentication failed: connection closed".to_string());
            }
            Err(_) => {
                error!("WebSocket authentication timeout (v2)");
                return Err("Authentication failed: timeout".to_string());
            }
            _ => {
                error!("WebSocket authentication failed (v2): unexpected message type");
                return Err("Authentication failed: unexpected message".to_string());
            }
        }
        
        // Reunite the split stream for further processing
        let ws_stream = ws_sender.reunite(ws_receiver)
            .map_err(|e| format!("Failed to reunite WebSocket stream: {}", e))?;

        debug!(
            "WebSocket handshake (v2) completed for session {}",
            session_handle.id
        );

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        // Extract parts from handle, consuming it properly
        let (id, cmd_tx, mut stdout_rx) = session_handle.into_parts();

        let state = Arc::new(ConnectionState::new());
        let state_out = state.clone();
        let state_hb = state.clone();

        // Channel for sending frames to WebSocket (increased capacity to prevent deadlock)
        let (frame_tx, mut frame_rx) = mpsc::channel::<Bytes>(4096);
        let frame_tx_ssh = frame_tx.clone();
        let frame_tx_hb = frame_tx.clone();

        let sid_in = id.clone();
        let sid_out = id.clone();

        // Task: WebSocket sender (multiplexes frame_tx)
        let sender_task = tokio::spawn(async move {
            while let Some(frame) = frame_rx.recv().await {
                // Use timeout to detect dead clients (prevents deadlock)
                match tokio::time::timeout(
                    Duration::from_secs(5),
                    ws_sender.send(Message::Binary(frame.to_vec().into()))
                ).await {
                    Ok(Ok(_)) => {
                        // Send successful
                    }
                    Ok(Err(e)) => {
                        debug!("WebSocket send failed: {:?}", e);
                        break;
                    }
                    Err(_) => {
                        warn!("WebSocket send timeout after 5s - client unresponsive, disconnecting");
                    break;
                    }
                }
            }
            debug!("WebSocket sender task stopped");
        });

        // Task: SSH stdout -> WebSocket
        let ssh_out_task = tokio::spawn(async move {
            while let Some(data) = stdout_rx.recv().await {
                state_out.touch();
                let frame = data_frame(Bytes::from(data)).encode();
                if frame_tx_ssh.send(frame).await.is_err() {
                    break;
                }
            }
            debug!("SSH -> WS forwarder stopped for session {}", sid_out);
        });

        // Task: Heartbeat sender
        let heartbeat_task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(HEARTBEAT_INTERVAL_SECS));
            loop {
                interval.tick().await;

                // Check if connection is dead
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64;
                let last = state_hb.last_seen_millis();
                if now.saturating_sub(last) > HEARTBEAT_TIMEOUT_SECS * 1000 {
                    warn!("Heartbeat timeout detected");
                    break;
                }

                let seq = state_hb.next_seq();
                let frame = heartbeat_frame(seq).encode();
                if frame_tx_hb.try_send(frame).is_err() {
                    // Channel full means frontend is overloaded - abort heartbeat
                    debug!("Heartbeat channel full, terminating heartbeat task");
                    break;
                }
            }
            debug!("Heartbeat task stopped");
        });

        // Task: WebSocket -> SSH (uses cmd_tx with SessionCommand)
        let cmd_tx_clone = cmd_tx.clone();
        let input_task = tokio::spawn(async move {
            let mut codec = FrameCodec::new();
            let start = Instant::now();

            while let Some(msg) = ws_receiver.next().await {
                match msg {
                    Ok(Message::Binary(data)) => {
                        state.touch();
                        codec.feed(&data);

                        while let Ok(Some(frame)) = codec.decode_next() {
                            match frame {
                                Frame::Data(payload) => {
                                    if cmd_tx_clone
                                        .send(SessionCommand::Data(payload.to_vec()))
                                        .await
                                        .is_err()
                                    {
                                        debug!("SSH cmd channel closed");
                                        return;
                                    }
                                }
                                Frame::Resize { cols, rows } => {
                                    info!("Resize request: {}x{} for session {}", cols, rows, sid_in);
                                    if cmd_tx_clone
                                        .send(SessionCommand::Resize(cols, rows))
                                        .await
                                        .is_err()
                                    {
                                        debug!("SSH cmd channel closed");
                                        return;
                                    }
                                }
                                Frame::Heartbeat(seq) => {
                                    debug!("Received heartbeat echo: seq={}", seq);
                                }
                                Frame::Error(msg) => {
                                    error!("Error frame from client: {}", msg);
                                }
                            }
                        }

                        if codec.is_overflow() {
                            if start.elapsed() < Duration::from_secs(5) {
                                debug!("Falling back to raw mode for legacy client");
                                if cmd_tx_clone
                                    .send(SessionCommand::Data(data.to_vec()))
                                    .await
                                    .is_err()
                                {
                                    return;
                                }
                            }
                            codec.clear();
                            break;
                        }
                    }
                    Ok(Message::Text(text)) => {
                        state.touch();
                        if cmd_tx_clone
                            .send(SessionCommand::Data(text.into_bytes()))
                            .await
                            .is_err()
                        {
                            debug!("SSH cmd channel closed");
                            break;
                        }
                    }
                    Ok(Message::Close(_)) => {
                        info!("WebSocket close message received for session {}", sid_in);
                        let _ = cmd_tx_clone.send(SessionCommand::Close).await;
                        break;
                    }
                    Ok(Message::Ping(_)) | Ok(Message::Pong(_)) => {
                        state.touch();
                    }
                    Ok(Message::Frame(_)) => {}
                    Err(e) => {
                        warn!("WebSocket receive error: {} for session {}", e, sid_in);
                        break;
                    }
                }
            }
            debug!("WS -> SSH forwarder (v2) stopped for session {}", sid_in);
        });

        // Wait for any task to complete
        tokio::select! {
            _ = sender_task => {
                debug!("Sender task completed for session {}", id);
            }
            _ = ssh_out_task => {
                debug!("SSH output task completed for session {}", id);
            }
            _ = heartbeat_task => {
                debug!("Heartbeat task completed for session {}", id);
            }
            _ = input_task => {
                debug!("Input task completed for session {}", id);
            }
        }

        // Send close command to SSH
        let _ = cmd_tx.send(SessionCommand::Close).await;

        info!("WebSocket bridge (v2) terminated for session {}", id);
        Ok(())
    }
}
