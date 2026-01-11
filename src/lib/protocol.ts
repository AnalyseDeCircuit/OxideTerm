/**
 * OxideTerm Wire Protocol v1
 * 
 * Frame Format:
 * +--------+--------+--------+--------+--------+-- ... --+
 * | Type   | Length (4 bytes, big-endian)      | Payload |
 * +--------+--------+--------+--------+--------+-- ... --+
 * 
 * Message Types:
 * - 0x00: Data      - Terminal I/O data
 * - 0x01: Resize    - Window size change (cols: u16, rows: u16)
 * - 0x02: Heartbeat - Keep-alive ping/pong
 * - 0x03: Error     - Error notification
 */

export const PROTOCOL_VERSION = 1;
export const HEADER_SIZE = 5;
export const MAX_PAYLOAD_SIZE = 16 * 1024 * 1024; // 16 MB

export enum MessageType {
  Data = 0x00,
  Resize = 0x01,
  Heartbeat = 0x02,
  Error = 0x03,
}

export type Frame =
  | { type: MessageType.Data; data: Uint8Array }
  | { type: MessageType.Resize; cols: number; rows: number }
  | { type: MessageType.Heartbeat; seq: number }
  | { type: MessageType.Error; message: string };

/**
 * Encode a frame into binary format
 */
export function encodeFrame(frame: Frame): Uint8Array {
  let payload: Uint8Array;
  
  switch (frame.type) {
    case MessageType.Data:
      payload = frame.data;
      break;
    case MessageType.Resize: {
      const buf = new ArrayBuffer(4);
      const view = new DataView(buf);
      view.setUint16(0, frame.cols, false); // big-endian
      view.setUint16(2, frame.rows, false);
      payload = new Uint8Array(buf);
      break;
    }
    case MessageType.Heartbeat: {
      const buf = new ArrayBuffer(4);
      const view = new DataView(buf);
      view.setUint32(0, frame.seq, false);
      payload = new Uint8Array(buf);
      break;
    }
    case MessageType.Error: {
      const encoder = new TextEncoder();
      payload = encoder.encode(frame.message);
      break;
    }
  }
  
  const result = new Uint8Array(HEADER_SIZE + payload.length);
  const view = new DataView(result.buffer);
  
  result[0] = frame.type;
  view.setUint32(1, payload.length, false); // big-endian
  result.set(payload, HEADER_SIZE);
  
  return result;
}

/**
 * Frame decoder with buffering for streaming data
 */
export class FrameDecoder {
  private buffer: Uint8Array = new Uint8Array(0);
  
  /**
   * Feed raw bytes into the decoder
   */
  feed(data: Uint8Array): void {
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;
  }
  
  /**
   * Try to decode the next frame
   * Returns null if not enough data
   */
  decode(): Frame | null {
    return this.decodeNext();
  }

  /**
   * Try to decode the next frame (alias for decode)
   * Returns null if not enough data
   */
  decodeNext(): Frame | null {
    if (this.buffer.length < HEADER_SIZE) {
      return null;
    }
    
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset);
    const msgType = this.buffer[0];
    const length = view.getUint32(1, false); // big-endian
    
    if (length > MAX_PAYLOAD_SIZE) {
      throw new Error(`Payload too large: ${length} bytes`);
    }
    
    if (this.buffer.length < HEADER_SIZE + length) {
      return null;
    }
    
    const payload = this.buffer.slice(HEADER_SIZE, HEADER_SIZE + length);
    this.buffer = this.buffer.slice(HEADER_SIZE + length);
    
    switch (msgType) {
      case MessageType.Data:
        return { type: MessageType.Data, data: payload };
      
      case MessageType.Resize: {
        if (length !== 4) {
          throw new Error('Resize frame must have 4 bytes payload');
        }
        const payloadView = new DataView(payload.buffer, payload.byteOffset);
        return {
          type: MessageType.Resize,
          cols: payloadView.getUint16(0, false),
          rows: payloadView.getUint16(2, false),
        };
      }
      
      case MessageType.Heartbeat: {
        if (length !== 4) {
          throw new Error('Heartbeat frame must have 4 bytes payload');
        }
        const payloadView = new DataView(payload.buffer, payload.byteOffset);
        return {
          type: MessageType.Heartbeat,
          seq: payloadView.getUint32(0, false),
        };
      }
      
      case MessageType.Error: {
        const decoder = new TextDecoder();
        return {
          type: MessageType.Error,
          message: decoder.decode(payload),
        };
      }
      
      default:
        throw new Error(`Unknown message type: ${msgType}`);
    }
  }
  
  /**
   * Clear the internal buffer
   */
  clear(): void {
    this.buffer = new Uint8Array(0);
  }
  
  /**
   * Get remaining buffer size
   */
  get remaining(): number {
    return this.buffer.length;
  }
}

// Helper functions to create frames
export function dataFrame(data: Uint8Array | string): Frame {
  if (typeof data === 'string') {
    const encoder = new TextEncoder();
    return { type: MessageType.Data, data: encoder.encode(data) };
  }
  return { type: MessageType.Data, data };
}

export function resizeFrame(cols: number, rows: number): Frame {
  return { type: MessageType.Resize, cols, rows };
}

export function heartbeatFrame(seq: number): Frame {
  return { type: MessageType.Heartbeat, seq };
}

export function errorFrame(message: string): Frame {
  return { type: MessageType.Error, message };
}
