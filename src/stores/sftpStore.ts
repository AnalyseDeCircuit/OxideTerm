import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  FileInfo,
  PreviewContent,
  TransferProgress,
  ListFilter,
  FileTreeNode,
  SortOrder,
} from '../types/sftp';
import { sftpApi } from '../lib/sftp';

interface SftpSessionState {
  initialized: boolean;
  cwd: string;
  files: FileInfo[];
  tree: Map<string, FileTreeNode>;
  selectedFiles: Set<string>;
  loading: boolean;
  error: string | null;
}

interface TransferItem {
  id: string;
  sessionId: string;
  remotePath: string;
  localPath: string;
  direction: 'upload' | 'download';
  progress: TransferProgress;
  startedAt: number;
}

interface SftpStore {
  // Per-session state
  sessions: Map<string, SftpSessionState>;

  // Global state
  activeSessionId: string | null;
  previewContent: PreviewContent | null;
  previewPath: string | null;
  isPreviewOpen: boolean;
  transfers: TransferItem[];

  // Filter and sort
  filter: ListFilter;
  sortOrder: SortOrder;

  // Session management
  initSession: (sessionId: string) => Promise<void>;
  closeSession: (sessionId: string) => Promise<void>;
  setActiveSession: (sessionId: string | null) => void;

  // Navigation
  navigateTo: (sessionId: string, path: string) => Promise<void>;
  refresh: (sessionId: string) => Promise<void>;
  goUp: (sessionId: string) => Promise<void>;

  // Selection
  selectFile: (sessionId: string, path: string) => void;
  deselectFile: (sessionId: string, path: string) => void;
  toggleSelection: (sessionId: string, path: string) => void;
  clearSelection: (sessionId: string) => void;
  selectAll: (sessionId: string) => void;

  // File operations
  createDirectory: (sessionId: string, name: string) => Promise<void>;
  deleteSelected: (sessionId: string) => Promise<void>;
  renameFile: (
    sessionId: string,
    oldPath: string,
    newPath: string
  ) => Promise<void>;

  // Transfer
  downloadFile: (
    sessionId: string,
    remotePath: string,
    localPath: string
  ) => Promise<void>;
  uploadFile: (
    sessionId: string,
    localPath: string,
    remotePath: string
  ) => Promise<void>;
  updateTransferProgress: (
    transferId: string,
    progress: TransferProgress
  ) => void;
  removeTransfer: (transferId: string) => void;

  // Preview
  openPreview: (sessionId: string, path: string) => Promise<void>;
  closePreview: () => void;

  // Filter and sort
  setFilter: (filter: ListFilter) => void;
  setSortOrder: (sortOrder: SortOrder) => void;

  // Tree operations
  expandNode: (sessionId: string, path: string) => Promise<void>;
  collapseNode: (sessionId: string, path: string) => void;

  // Helpers
  getSessionState: (sessionId: string) => SftpSessionState | undefined;
  getActiveState: () => SftpSessionState | undefined;
}

const DEFAULT_SESSION_STATE: SftpSessionState = {
  initialized: false,
  cwd: '~',
  files: [],
  tree: new Map(),
  selectedFiles: new Set(),
  loading: false,
  error: null,
};

export const useSftpStore = create<SftpStore>()(
  subscribeWithSelector((set, get) => ({
    sessions: new Map(),
    activeSessionId: null,
    previewContent: null,
    previewPath: null,
    isPreviewOpen: false,
    transfers: [],
    filter: {},
    sortOrder: { field: 'name', ascending: true } as SortOrder,

    getSessionState: (sessionId: string) => {
      return get().sessions.get(sessionId);
    },

    getActiveState: () => {
      const { activeSessionId, sessions } = get();
      if (!activeSessionId) return undefined;
      return sessions.get(activeSessionId);
    },

    initSession: async (sessionId: string) => {
      const { sessions } = get();

      // Short-circuit if this session is already initialized in the store.
      const existingState = sessions.get(sessionId);
      if (existingState?.initialized) {
        set({ activeSessionId: sessionId });
        return;
      }

      // Update state to loading
      const newSessions = new Map(sessions);
      newSessions.set(sessionId, {
        ...(existingState ?? DEFAULT_SESSION_STATE),
        loading: true,
        error: null,
      });
      set({ sessions: newSessions });

      try {
        const alreadyInitialized = await sftpApi.isSftpInitialized(sessionId);
        const cwd = alreadyInitialized
          ? await sftpApi.pwd(sessionId)
          : await sftpApi.initSftp(sessionId);

        const files = await sftpApi.listDir(sessionId, cwd, get().filter);

        const updatedSessions = new Map(get().sessions);
        const baseState = updatedSessions.get(sessionId) ?? DEFAULT_SESSION_STATE;

        updatedSessions.set(sessionId, {
          ...baseState,
          initialized: true,
          cwd,
          files,
          loading: false,
          error: null,
        });
        set({ sessions: updatedSessions, activeSessionId: sessionId });
      } catch (error) {
        const updatedSessions = new Map(get().sessions);
        updatedSessions.set(sessionId, {
          ...DEFAULT_SESSION_STATE,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
        set({ sessions: updatedSessions });
        throw error;
      }
    },

    closeSession: async (sessionId: string) => {
      try {
        await sftpApi.closeSftp(sessionId);
      } finally {
        const { sessions, activeSessionId } = get();
        const newSessions = new Map(sessions);
        newSessions.delete(sessionId);
        set({
          sessions: newSessions,
          activeSessionId:
            activeSessionId === sessionId ? null : activeSessionId,
        });
      }
    },

    setActiveSession: (sessionId: string | null) => {
      set({ activeSessionId: sessionId });
    },

    navigateTo: async (sessionId: string, path: string) => {
      const { sessions, filter } = get();
      const state = sessions.get(sessionId);
      if (!state?.initialized) return;

      const newSessions = new Map(sessions);
      newSessions.set(sessionId, { ...state, loading: true, error: null });
      set({ sessions: newSessions });

      try {
        const newCwd = await sftpApi.cd(sessionId, path);
        const files = await sftpApi.listDir(sessionId, newCwd, filter);

        const updatedSessions = new Map(get().sessions);
        const currentState = updatedSessions.get(sessionId);
        if (currentState) {
          updatedSessions.set(sessionId, {
            ...currentState,
            cwd: newCwd,
            files,
            loading: false,
            selectedFiles: new Set(),
          });
        }
        set({ sessions: updatedSessions });
      } catch (error) {
        const updatedSessions = new Map(get().sessions);
        const currentState = updatedSessions.get(sessionId);
        if (currentState) {
          updatedSessions.set(sessionId, {
            ...currentState,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        set({ sessions: updatedSessions });
        throw error;
      }
    },

    refresh: async (sessionId: string) => {
      const { sessions } = get();
      const state = sessions.get(sessionId);
      if (!state?.initialized) return;

      await get().navigateTo(sessionId, state.cwd);
    },

    goUp: async (sessionId: string) => {
      await get().navigateTo(sessionId, '..');
    },

    selectFile: (sessionId: string, path: string) => {
      const { sessions } = get();
      const state = sessions.get(sessionId);
      if (!state) return;

      const newSelected = new Set(state.selectedFiles);
      newSelected.add(path);

      const newSessions = new Map(sessions);
      newSessions.set(sessionId, { ...state, selectedFiles: newSelected });
      set({ sessions: newSessions });
    },

    deselectFile: (sessionId: string, path: string) => {
      const { sessions } = get();
      const state = sessions.get(sessionId);
      if (!state) return;

      const newSelected = new Set(state.selectedFiles);
      newSelected.delete(path);

      const newSessions = new Map(sessions);
      newSessions.set(sessionId, { ...state, selectedFiles: newSelected });
      set({ sessions: newSessions });
    },

    toggleSelection: (sessionId: string, path: string) => {
      const { sessions } = get();
      const state = sessions.get(sessionId);
      if (!state) return;

      if (state.selectedFiles.has(path)) {
        get().deselectFile(sessionId, path);
      } else {
        get().selectFile(sessionId, path);
      }
    },

    clearSelection: (sessionId: string) => {
      const { sessions } = get();
      const state = sessions.get(sessionId);
      if (!state) return;

      const newSessions = new Map(sessions);
      newSessions.set(sessionId, { ...state, selectedFiles: new Set() });
      set({ sessions: newSessions });
    },

    selectAll: (sessionId: string) => {
      const { sessions } = get();
      const state = sessions.get(sessionId);
      if (!state) return;

      const allPaths = new Set(state.files.map((f) => f.path));
      const newSessions = new Map(sessions);
      newSessions.set(sessionId, { ...state, selectedFiles: allPaths });
      set({ sessions: newSessions });
    },

    createDirectory: async (sessionId: string, name: string) => {
      const state = get().sessions.get(sessionId);
      if (!state?.initialized) return;

      const newPath =
        state.cwd === '/' ? `/${name}` : `${state.cwd}/${name}`;
      await sftpApi.mkdir(sessionId, newPath);
      await get().refresh(sessionId);
    },

    deleteSelected: async (sessionId: string) => {
      const state = get().sessions.get(sessionId);
      if (!state?.initialized || state.selectedFiles.size === 0) return;

      const paths = Array.from(state.selectedFiles);
      for (const path of paths) {
        await sftpApi.deleteFile(sessionId, path);
      }

      get().clearSelection(sessionId);
      await get().refresh(sessionId);
    },

    renameFile: async (
      sessionId: string,
      oldPath: string,
      newPath: string
    ) => {
      await sftpApi.rename(sessionId, oldPath, newPath);
      await get().refresh(sessionId);
    },

    downloadFile: async (
      sessionId: string,
      remotePath: string,
      localPath: string
    ) => {
      const transferId = `${sessionId}-${Date.now()}`;
      const transfer: TransferItem = {
        id: transferId,
        sessionId,
        remotePath,
        localPath,
        direction: 'download',
        progress: {
          transferred: 0,
          total: 0,
          percentage: 0,
          state: 'Pending' as const,
        },
        startedAt: Date.now(),
      };

      set({ transfers: [...get().transfers, transfer] });

      try {
        await sftpApi.download(sessionId, remotePath, localPath);
        get().updateTransferProgress(transferId, {
          transferred: 0,
          total: 0,
          percentage: 100,
          state: 'Completed' as const,
        });
      } catch (error) {
        get().updateTransferProgress(transferId, {
          transferred: 0,
          total: 0,
          percentage: 0,
          state: { Failed: error instanceof Error ? error.message : String(error) } as const,
        });
        throw error;
      }
    },

    uploadFile: async (
      sessionId: string,
      localPath: string,
      remotePath: string
    ) => {
      const transferId = `${sessionId}-${Date.now()}`;
      const transfer: TransferItem = {
        id: transferId,
        sessionId,
        remotePath,
        localPath,
        direction: 'upload',
        progress: {
          transferred: 0,
          total: 0,
          percentage: 0,
          state: 'Pending' as const,
        },
        startedAt: Date.now(),
      };

      set({ transfers: [...get().transfers, transfer] });

      try {
        await sftpApi.upload(sessionId, localPath, remotePath);
        get().updateTransferProgress(transferId, {
          transferred: 0,
          total: 0,
          percentage: 100,
          state: 'Completed' as const,
        });
        await get().refresh(sessionId);
      } catch (error) {
        get().updateTransferProgress(transferId, {
          transferred: 0,
          total: 0,
          percentage: 0,
          state: { Failed: error instanceof Error ? error.message : String(error) } as const,
        });
        throw error;
      }
    },

    updateTransferProgress: (transferId: string, progress: TransferProgress) => {
      const { transfers } = get();
      const updated = transfers.map((t) =>
        t.id === transferId ? { ...t, progress } : t
      );
      set({ transfers: updated });
    },

    removeTransfer: (transferId: string) => {
      const { transfers } = get();
      set({ transfers: transfers.filter((t) => t.id !== transferId) });
    },

    openPreview: async (sessionId: string, path: string) => {
      try {
        const content = await sftpApi.preview(sessionId, path);
        set({
          previewContent: content,
          previewPath: path,
          isPreviewOpen: true,
        });
      } catch (error) {
        console.error('Preview failed:', error);
        throw error;
      }
    },

    closePreview: () => {
      set({
        previewContent: null,
        previewPath: null,
        isPreviewOpen: false,
      });
    },

    setFilter: (filter: ListFilter) => {
      set({ filter });
      // Refresh active session with new filter
      const { activeSessionId } = get();
      if (activeSessionId) {
        get().refresh(activeSessionId);
      }
    },

    setSortOrder: (sortOrder: SortOrder) => {
      set({ sortOrder });
    },

    expandNode: async (sessionId: string, path: string) => {
      const { sessions } = get();
      const state = sessions.get(sessionId);
      if (!state?.initialized) return;

      try {
        const children = await sftpApi.listDir(sessionId, path, get().filter);
        const newTree = new Map(state.tree);

        // Add or update node
        const existingNode = newTree.get(path);
        if (existingNode) {
          newTree.set(path, { ...existingNode, isExpanded: true });
        }

        // Add children to tree
        for (const child of children) {
          if (!newTree.has(child.path)) {
            newTree.set(child.path, {
              file: child,
              isExpanded: false,
              children: [],
            });
          }
        }

        // Update parent's children list
        const parentNode = newTree.get(path);
        if (parentNode) {
          const childNodes = children.map((c) => {
            const existing = newTree.get(c.path);
            return existing || { file: c, isExpanded: false, children: [] };
          });
          newTree.set(path, {
            ...parentNode,
            children: childNodes,
          });
        }

        const newSessions = new Map(sessions);
        newSessions.set(sessionId, { ...state, tree: newTree });
        set({ sessions: newSessions });
      } catch (error) {
        console.error('Failed to expand node:', error);
        throw error;
      }
    },

    collapseNode: (sessionId: string, path: string) => {
      const { sessions } = get();
      const state = sessions.get(sessionId);
      if (!state?.initialized) return;

      const newTree = new Map(state.tree);
      const node = newTree.get(path);
      if (node) {
        newTree.set(path, { ...node, isExpanded: false });
      }

      const newSessions = new Map(sessions);
      newSessions.set(sessionId, { ...state, tree: newTree });
      set({ sessions: newSessions });
    },
  }))
);

// Selector hooks for common patterns
export const useActiveFiles = () =>
  useSftpStore((state) => state.getActiveState()?.files ?? []);

export const useActiveCwd = () =>
  useSftpStore((state) => state.getActiveState()?.cwd ?? '~');

export const useActiveLoading = () =>
  useSftpStore((state) => state.getActiveState()?.loading ?? false);

export const useActiveError = () =>
  useSftpStore((state) => state.getActiveState()?.error ?? null);

export const useActiveSelection = () =>
  useSftpStore((state) => state.getActiveState()?.selectedFiles ?? new Set());
