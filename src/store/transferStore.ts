import { create } from 'zustand';

export type TransferState = 'pending' | 'active' | 'paused' | 'completed' | 'error';
export type TransferDirection = 'upload' | 'download';

export interface TransferItem {
  id: string;
  sessionId: string;
  name: string;
  localPath: string;
  remotePath: string;
  direction: TransferDirection;
  size: number;           // Total bytes
  transferred: number;    // Bytes transferred
  state: TransferState;
  error?: string;
  startTime: number;      // Unix timestamp ms
  endTime?: number;       // Unix timestamp ms
}

interface TransferStore {
  // State
  transfers: Map<string, TransferItem>;
  
  // Actions
  addTransfer: (transfer: Omit<TransferItem, 'transferred' | 'state' | 'startTime'>) => string;
  updateProgress: (id: string, transferred: number, total: number) => void;
  setTransferState: (id: string, state: TransferState, error?: string) => void;
  removeTransfer: (id: string) => void;
  clearCompleted: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  pauseTransfer: (id: string) => void;
  resumeTransfer: (id: string) => void;
  cancelTransfer: (id: string) => void;
  
  // Computed helpers
  getTransfersBySession: (sessionId: string) => TransferItem[];
  getActiveTransfers: () => TransferItem[];
  getAllTransfers: () => TransferItem[];
}

export const useTransferStore = create<TransferStore>((set, get) => ({
  transfers: new Map(),
  
  addTransfer: (transfer) => {
    const id = transfer.id || `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newTransfer: TransferItem = {
      ...transfer,
      id,
      transferred: 0,
      state: 'pending',
      startTime: Date.now(),
    };
    
    set((state) => {
      const newTransfers = new Map(state.transfers);
      newTransfers.set(id, newTransfer);
      return { transfers: newTransfers };
    });
    
    return id;
  },
  
  updateProgress: (id, transferred, total) => {
    set((state) => {
      const transfer = state.transfers.get(id);
      if (!transfer) return state;
      
      const newTransfers = new Map(state.transfers);
      newTransfers.set(id, {
        ...transfer,
        transferred,
        size: total,
        state: transferred >= total ? 'completed' : 'active',
        endTime: transferred >= total ? Date.now() : undefined,
      });
      return { transfers: newTransfers };
    });
  },
  
  setTransferState: (id, newState, error) => {
    set((state) => {
      const transfer = state.transfers.get(id);
      if (!transfer) return state;
      
      const newTransfers = new Map(state.transfers);
      newTransfers.set(id, {
        ...transfer,
        state: newState,
        error,
        endTime: (newState === 'completed' || newState === 'error') ? Date.now() : transfer.endTime,
      });
      return { transfers: newTransfers };
    });
  },
  
  removeTransfer: (id) => {
    set((state) => {
      const newTransfers = new Map(state.transfers);
      newTransfers.delete(id);
      return { transfers: newTransfers };
    });
  },
  
  clearCompleted: () => {
    set((state) => {
      const newTransfers = new Map(state.transfers);
      for (const [id, transfer] of newTransfers) {
        if (transfer.state === 'completed') {
          newTransfers.delete(id);
        }
      }
      return { transfers: newTransfers };
    });
  },
  
  pauseAll: () => {
    set((state) => {
      const newTransfers = new Map(state.transfers);
      for (const [id, transfer] of newTransfers) {
        if (transfer.state === 'active' || transfer.state === 'pending') {
          newTransfers.set(id, { ...transfer, state: 'paused' });
        }
      }
      return { transfers: newTransfers };
    });
  },
  
  resumeAll: () => {
    set((state) => {
      const newTransfers = new Map(state.transfers);
      for (const [id, transfer] of newTransfers) {
        if (transfer.state === 'paused') {
          newTransfers.set(id, { ...transfer, state: 'pending' });
        }
      }
      return { transfers: newTransfers };
    });
  },
  
  pauseTransfer: (id) => {
    set((state) => {
      const transfer = state.transfers.get(id);
      if (!transfer || (transfer.state !== 'active' && transfer.state !== 'pending')) return state;
      
      const newTransfers = new Map(state.transfers);
      newTransfers.set(id, { ...transfer, state: 'paused' });
      return { transfers: newTransfers };
    });
  },
  
  resumeTransfer: (id) => {
    set((state) => {
      const transfer = state.transfers.get(id);
      if (!transfer || transfer.state !== 'paused') return state;
      
      const newTransfers = new Map(state.transfers);
      newTransfers.set(id, { ...transfer, state: 'pending' });
      return { transfers: newTransfers };
    });
  },
  
  cancelTransfer: (id) => {
    // Mark as error/cancelled, actual cancellation needs backend support
    get().setTransferState(id, 'error', 'Cancelled by user');
  },
  
  getTransfersBySession: (sessionId) => {
    return Array.from(get().transfers.values()).filter(t => t.sessionId === sessionId);
  },
  
  getActiveTransfers: () => {
    return Array.from(get().transfers.values()).filter(t => 
      t.state === 'active' || t.state === 'pending'
    );
  },
  
  getAllTransfers: () => {
    return Array.from(get().transfers.values());
  },
}));

// Helper function to format bytes
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// Helper function to format transfer speed
export const formatSpeed = (bytesPerSecond: number): string => {
  return `${formatBytes(bytesPerSecond)}/s`;
};

// Helper function to calculate speed from transfer
export const calculateSpeed = (transfer: TransferItem): number => {
  if (transfer.state !== 'active' || transfer.transferred === 0) return 0;
  const elapsed = (Date.now() - transfer.startTime) / 1000; // seconds
  if (elapsed <= 0) return 0;
  return transfer.transferred / elapsed;
};
