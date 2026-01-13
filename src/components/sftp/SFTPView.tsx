import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Folder, 
  File, 
  ArrowUp, 
  RefreshCw, 
  Home, 
  Download,
  Upload,
  Trash2,
  Edit3,
  Copy,
  Eye,
  FolderPlus,
  Search,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useTransferStore } from '../../store/transferStore';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { TransferQueue } from './TransferQueue';
import { api } from '../../lib/api';
import { FileInfo } from '../../types';
import { listen } from '@tauri-apps/api/event';
import { readDir, stat, remove, rename, mkdir } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/dialog';

// Types for Transfer Events (should match Backend TransferProgress)
interface TransferProgressEvent {
    id: string;
    remote_path: string;
    local_path: string;
    direction: string;
    state: string;
    total_bytes: number;
    transferred_bytes: number;
    speed: number;
    eta_seconds: number | null;
    error: string | null;
}

interface TransferCompleteEvent {
    transfer_id: string;
    session_id: string;
    success: boolean;
    error?: string;
}

// Format file size to human readable format
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// Sort options
type SortField = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';

const FileList = ({ 
  title, 
  path, 
  files, 
  onNavigate, 
  onRefresh,
  active,
  onActivate,
  onPreview,
  onTransfer,
  onDelete,
  onRename,
  onNewFolder,
  selected,
  setSelected,
  lastSelected,
  setLastSelected,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  filter,
  onFilterChange,
  sortField,
  sortDirection,
  onSortChange
}: { 
  title: string, 
  path: string, 
  files: FileInfo[],
  onNavigate: (path: string) => void,
  onRefresh: () => void,
  active: boolean,
  onActivate: () => void,
  onPreview?: (file: FileInfo) => void,
  onTransfer?: (files: string[], direction: 'upload' | 'download') => void,
  onDelete?: (files: string[]) => void,
  onRename?: (oldName: string) => void,
  onNewFolder?: () => void,
  selected: Set<string>,
  setSelected: (s: Set<string>) => void,
  lastSelected: string | null,
  setLastSelected: (s: string | null) => void,
  isDragOver?: boolean,
  onDragOver?: (e: React.DragEvent) => void,
  onDragLeave?: (e: React.DragEvent) => void,
  onDrop?: (e: React.DragEvent) => void,
  filter?: string,
  onFilterChange?: (v: string) => void,
  sortField?: SortField,
  sortDirection?: SortDirection,
  onSortChange?: (field: SortField) => void
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, file?: FileInfo} | null>(null);

  const handleSelect = (name: string, multi: boolean, range: boolean) => {
    onActivate();
    const newSelected = new Set(multi ? selected : []);
    
    if (range && lastSelected && files.length > 0) {
       let start = files.findIndex(f => f.name === lastSelected);
       let end = files.findIndex(f => f.name === name);
       if (start > -1 && end > -1) {
           const [min, max] = [Math.min(start, end), Math.max(start, end)];
           for (let i = min; i <= max; i++) {
               newSelected.add(files[i].name);
           }
       }
    } else {
        if (newSelected.has(name) && multi) {
            newSelected.delete(name);
        } else {
            newSelected.add(name);
        }
    }
    
    setSelected(newSelected);
    setLastSelected(name);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!active) return;
    
    const selectedFiles = Array.from(selected);
    const isLocal = title === 'Local';
    
    // Ctrl/Cmd + A: Select all
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      setSelected(new Set(files.map(f => f.name)));
      return;
    }
    
    // Enter: Open directory or preview file
    if (e.key === 'Enter' && selectedFiles.length === 1) {
      e.preventDefault();
      const file = files.find(f => f.name === selectedFiles[0]);
      if (file) {
        if (file.file_type === 'Directory') {
          const newPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
          onNavigate(newPath);
        } else if (onPreview) {
          onPreview(file);
        }
      }
      return;
    }
    
    // Arrow keys for transfer
    if (e.key === 'ArrowRight' && isLocal && selectedFiles.length > 0 && onTransfer) {
      e.preventDefault();
      onTransfer(selectedFiles, 'upload');
      return;
    }
    if (e.key === 'ArrowLeft' && !isLocal && selectedFiles.length > 0 && onTransfer) {
      e.preventDefault();
      onTransfer(selectedFiles, 'download');
      return;
    }
    
    // Delete key
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFiles.length > 0 && onDelete) {
      e.preventDefault();
      onDelete(selectedFiles);
      return;
    }
    
    // F2: Rename
    if (e.key === 'F2' && selectedFiles.length === 1 && onRename) {
      e.preventDefault();
      onRename(selectedFiles[0]);
      return;
    }
  }, [active, selected, files, title, path, onNavigate, onPreview, onTransfer, onDelete, onRename, setSelected]);

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent, file?: FileInfo) => {
    e.preventDefault();
    e.stopPropagation();
    if (file && !selected.has(file.name)) {
      setSelected(new Set([file.name]));
      setLastSelected(file.name);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const isLocal = title === 'Local';

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-theme-bg border transition-all duration-200",
        active ? "border-oxide-accent/50" : "border-theme-border",
        isDragOver && "border-oxide-accent border-2 bg-theme-accent/10 ring-2 ring-oxide-accent/30"
      )}
      onClick={onActivate}
      onContextMenu={(e) => handleContextMenu(e)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center gap-2 p-2 border-b transition-colors h-10",
        active ? "bg-zinc-800/50 border-oxide-accent/30" : "bg-theme-bg-panel border-theme-border"
      )}>
        <span className="font-semibold text-xs text-zinc-400 uppercase tracking-wider min-w-16">{title}</span>
        <div className="flex-1 flex items-center gap-1 bg-zinc-950 border border-theme-border px-2 py-0.5 rounded-sm overflow-hidden">
           <span className="text-zinc-500 text-xs truncate select-all">{path}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onNavigate('..')}>
           <ArrowUp className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onNavigate('~')}>
           <Home className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRefresh}>
           <RefreshCw className="h-3 w-3" />
        </Button>
        {/* Transfer selected files */}
        {onTransfer && selected.size > 0 && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 px-2 text-xs gap-1"
            onClick={() => onTransfer(Array.from(selected), isLocal ? 'upload' : 'download')}
          >
            {isLocal ? <Upload className="h-3 w-3" /> : <Download className="h-3 w-3" />}
            {isLocal ? `Upload (${selected.size})` : `Download (${selected.size})`}
          </Button>
        )}
      </div>

      {/* Column Headers with Sort */}
      <div className="flex items-center px-2 py-1 bg-zinc-900 border-b border-theme-border text-xs text-zinc-500">
        <button 
          className={cn(
            "flex-1 flex items-center gap-1 hover:text-zinc-300 transition-colors text-left",
            sortField === 'name' && "text-theme-accent"
          )}
          onClick={() => onSortChange?.('name')}
        >
          Name
          {sortField === 'name' && (
            sortDirection === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />
          )}
        </button>
        <button 
          className={cn(
            "w-20 flex items-center justify-end gap-1 hover:text-zinc-300 transition-colors",
            sortField === 'size' && "text-theme-accent"
          )}
          onClick={() => onSortChange?.('size')}
        >
          Size
          {sortField === 'size' && <ArrowUpDown className="h-3 w-3" />}
        </button>
        <button 
          className={cn(
            "w-24 flex items-center justify-end gap-1 hover:text-zinc-300 transition-colors",
            sortField === 'modified' && "text-theme-accent"
          )}
          onClick={() => onSortChange?.('modified')}
        >
          Mod
          {sortField === 'modified' && <ArrowUpDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Filter Input */}
      {onFilterChange && (
        <div className="flex items-center gap-2 px-2 py-1 bg-zinc-900/50 border-b border-theme-border">
          <Search className="h-3 w-3 text-zinc-500" />
          <input
            type="text"
            value={filter || ''}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Filter files..."
            className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
          />
          {filter && (
            <button 
              onClick={() => onFilterChange('')}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* File List */}
      <div 
        ref={listRef}
        className="flex-1 overflow-y-auto outline-none" 
        tabIndex={0} 
        onClick={() => setSelected(new Set())}
        onKeyDown={handleKeyDown}
      >
        {files.map((file) => {
          const isSelected = selected.has(file.name);
          return (
            <div 
              key={file.name}
              draggable
              onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({
                      files: Array.from(selected.size > 0 ? selected : [file.name]),
                      source: title.includes('Remote') ? 'remote' : 'local',
                      basePath: path
                  }));
              }}
              onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(file.name, e.metaKey || e.ctrlKey, e.shiftKey);
              }}
              onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (file.file_type === 'Directory') {
                      const newPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                      onNavigate(newPath);
                  } else if (onPreview) {
                      onPreview(file);
                  }
              }}
              onContextMenu={(e) => handleContextMenu(e, file)}
              className={cn(
                "flex items-center px-2 py-1 text-xs cursor-default select-none border-b border-transparent hover:bg-zinc-800",
                isSelected && "bg-theme-accent/20 text-theme-accent"
              )}
            >
              <div className="flex-1 flex items-center gap-2 truncate">
                {file.file_type === 'Directory' ? <Folder className="h-3.5 w-3.5 text-blue-400" /> : <File className="h-3.5 w-3.5 text-zinc-400" />}
                <span>{file.name}</span>
              </div>
              <div className="w-20 text-right text-zinc-500">
                {file.file_type === 'Directory' ? '-' : formatFileSize(file.size)}
              </div>
              <div className="w-24 text-right text-zinc-600">
                {file.modified ? new Date(file.modified * 1000).toLocaleDateString() : '-'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-theme-bg-panel border border-theme-border rounded-sm shadow-lg py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {/* Transfer */}
          {onTransfer && selected.size > 0 && (
            <button 
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 flex items-center gap-2"
              onClick={() => {
                onTransfer(Array.from(selected), isLocal ? 'upload' : 'download');
                setContextMenu(null);
              }}
            >
              {isLocal ? <Upload className="h-3 w-3" /> : <Download className="h-3 w-3" />}
              {isLocal ? 'Upload →' : '← Download'}
            </button>
          )}
          
          {/* Preview (only for files) */}
          {contextMenu.file && contextMenu.file.file_type !== 'Directory' && onPreview && (
            <button 
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 flex items-center gap-2"
              onClick={() => {
                onPreview(contextMenu.file!);
                setContextMenu(null);
              }}
            >
              <Eye className="h-3 w-3" /> Preview
            </button>
          )}
          
          {/* Rename */}
          {contextMenu.file && selected.size === 1 && onRename && (
            <button 
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 flex items-center gap-2"
              onClick={() => {
                onRename(contextMenu.file!.name);
                setContextMenu(null);
              }}
            >
              <Edit3 className="h-3 w-3" /> Rename
            </button>
          )}
          
          {/* Copy Path */}
          {contextMenu.file && (
            <button 
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 flex items-center gap-2"
              onClick={() => {
                const fullPath = `${path}/${contextMenu.file!.name}`;
                navigator.clipboard.writeText(fullPath);
                setContextMenu(null);
              }}
            >
              <Copy className="h-3 w-3" /> Copy Path
            </button>
          )}
          
          {/* Delete */}
          {selected.size > 0 && onDelete && (
            <button 
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-red-400"
              onClick={() => {
                onDelete(Array.from(selected));
                setContextMenu(null);
              }}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
          
          <div className="border-t border-theme-border my-1" />
          
          {/* New Folder */}
          {onNewFolder && (
            <button 
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 flex items-center gap-2"
              onClick={() => {
                onNewFolder();
                setContextMenu(null);
              }}
            >
              <FolderPlus className="h-3 w-3" /> New Folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const SFTPView = ({ sessionId }: { sessionId: string }) => {
  const { getSession } = useAppStore();
  const session = getSession(sessionId);
  const [remoteFiles, setRemoteFiles] = useState<FileInfo[]>([]);
  const [remotePath, setRemotePath] = useState('/home/' + (session?.username || 'user'));
  
  const [localFiles, setLocalFiles] = useState<FileInfo[]>([]);
  const [localPath, setLocalPath] = useState('');
  const [localHome, setLocalHome] = useState('');

  const [activePane, setActivePane] = useState<'local' | 'remote'>('remote');
  const [sftpInitialized, setSftpInitialized] = useState(false);

  // Selection state (lifted up for cross-pane operations)
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const [localLastSelected, setLocalLastSelected] = useState<string | null>(null);
  const [remoteSelected, setRemoteSelected] = useState<Set<string>>(new Set());
  const [remoteLastSelected, setRemoteLastSelected] = useState<string | null>(null);

  // Preview State
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    path: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'hex' | 'too-large' | 'unsupported';
    data: string;
    mimeType?: string;
    language?: string | null;
    // Hex specific
    hexOffset?: number;
    hexTotalSize?: number;
    hexHasMore?: boolean;
    // Too large specific
    recommendDownload?: boolean;
    maxSize?: number;
    fileSize?: number;
    // Unsupported specific
    reason?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hexLoadingMore, setHexLoadingMore] = useState(false);

  // Dialog States
  const [renameDialog, setRenameDialog] = useState<{oldName: string, isRemote: boolean} | null>(null);
  const [newFolderDialog, setNewFolderDialog] = useState<{isRemote: boolean} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{files: string[], isRemote: boolean} | null>(null);
  const [inputValue, setInputValue] = useState('');

  // Drag and Drop state
  const [localDragOver, setLocalDragOver] = useState(false);
  const [remoteDragOver, setRemoteDragOver] = useState(false);

  // Filter and Sort state
  const [localFilter, setLocalFilter] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('');
  const [localSortField, setLocalSortField] = useState<SortField>('name');
  const [localSortDirection, setLocalSortDirection] = useState<SortDirection>('asc');
  const [remoteSortField, setRemoteSortField] = useState<SortField>('name');
  const [remoteSortDirection, setRemoteSortDirection] = useState<SortDirection>('asc');

  // Sort handler
  const handleSortChange = (isLocal: boolean, field: SortField) => {
    if (isLocal) {
      if (localSortField === field) {
        setLocalSortDirection(d => d === 'asc' ? 'desc' : 'asc');
      } else {
        setLocalSortField(field);
        setLocalSortDirection('asc');
      }
    } else {
      if (remoteSortField === field) {
        setRemoteSortDirection(d => d === 'asc' ? 'desc' : 'asc');
      } else {
        setRemoteSortField(field);
        setRemoteSortDirection('asc');
      }
    }
  };

  // Filter and sort files
  const filterAndSortFiles = useCallback((
    files: FileInfo[],
    filter: string,
    sortField: SortField,
    sortDirection: SortDirection
  ): FileInfo[] => {
    // Filter
    let filtered = files;
    if (filter.trim()) {
      const lowerFilter = filter.toLowerCase();
      filtered = files.filter(f => f.name.toLowerCase().includes(lowerFilter));
    }

    // Sort (directories first, then by field)
    const sorted = [...filtered].sort((a, b) => {
      // Directories always first
      if (a.file_type === 'Directory' && b.file_type !== 'Directory') return -1;
      if (a.file_type !== 'Directory' && b.file_type === 'Directory') return 1;

      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'size':
          cmp = a.size - b.size;
          break;
        case 'modified':
          cmp = (a.modified || 0) - (b.modified || 0);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, []);

  // Memoized filtered/sorted file lists
  const displayLocalFiles = useMemo(
    () => filterAndSortFiles(localFiles, localFilter, localSortField, localSortDirection),
    [localFiles, localFilter, localSortField, localSortDirection, filterAndSortFiles]
  );

  const displayRemoteFiles = useMemo(
    () => filterAndSortFiles(remoteFiles, remoteFilter, remoteSortField, remoteSortDirection),
    [remoteFiles, remoteFilter, remoteSortField, remoteSortDirection, filterAndSortFiles]
  );

  // Initialize local home directory
  useEffect(() => {
    homeDir().then(home => {
      setLocalHome(home);
      setLocalPath(home);
    }).catch(() => {
      setLocalPath('/');
    });
  }, []);

  // Initialize SFTP on mount
  useEffect(() => {
     if (!session) return;
     
     api.sftpIsInitialized(sessionId)
        .then(initialized => {
            if (initialized) {
                setSftpInitialized(true);
                return api.sftpPwd(sessionId);
            } else {
                return api.sftpInit(sessionId).then(cwd => {
                    setSftpInitialized(true);
                    return cwd;
                });
            }
        })
        .then(cwd => {
            if (cwd) setRemotePath(cwd);
        })
        .catch(err => console.error("SFTP Init Error:", err));
  }, [sessionId, session]);

  // Refresh remote (only after initialization)
  useEffect(() => {
     if (!session || !sftpInitialized) return;
     api.sftpListDir(sessionId, remotePath)
        .then(setRemoteFiles)
        .catch(err => console.error("SFTP List Error:", err));
  }, [sessionId, remotePath, session, sftpInitialized]);

  // Refresh local files using Tauri fs plugin
  const refreshLocalFiles = useCallback(async () => {
    if (!localPath) return;
    try {
      const entries = await readDir(localPath);
      const files: FileInfo[] = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = `${localPath}/${entry.name}`;
          const isDir = entry.isDirectory === true;
          try {
            const info = await stat(fullPath);
            return {
              name: entry.name,
              path: fullPath,
              file_type: isDir ? 'Directory' : 'File',
              size: info.size || 0,
              modified: info.mtime ? Math.floor(info.mtime.getTime() / 1000) : 0,
              permissions: ''
            } as FileInfo;
          } catch {
            return {
              name: entry.name,
              path: fullPath,
              file_type: isDir ? 'Directory' : 'File',
              size: 0,
              modified: 0,
              permissions: ''
            } as FileInfo;
          }
        })
      );
      // Sort: directories first, then alphabetically
      files.sort((a, b) => {
        if (a.file_type === 'Directory' && b.file_type !== 'Directory') return -1;
        if (a.file_type !== 'Directory' && b.file_type === 'Directory') return 1;
        return a.name.localeCompare(b.name);
      });
      setLocalFiles(files);
    } catch (err) {
      console.error("Local list error:", err);
      setLocalFiles([]);
    }
  }, [localPath]);

  useEffect(() => {
    refreshLocalFiles();
  }, [refreshLocalFiles]);

  // Get transfer store actions
  const { addTransfer, updateProgress, setTransferState, getAllTransfers } = useTransferStore();

  // Event Listeners for Transfer Progress
  useEffect(() => {
      const unlistenProgress = listen<TransferProgressEvent>(`sftp:progress:${sessionId}`, (event) => {
          const { remote_path, local_path, transferred_bytes, total_bytes } = event.payload;
          // Find matching transfer by path (normalize paths for comparison)
          const transfers = getAllTransfers();
          const normalizePath = (p: string) => p.replace(/\/+/g, '/').replace(/\/$/, '');
          const normalizedRemote = normalizePath(remote_path);
          const normalizedLocal = normalizePath(local_path);
          
          const match = transfers.find(t => {
            const tRemote = normalizePath(t.remotePath);
            const tLocal = normalizePath(t.localPath);
            return tRemote === normalizedRemote || tLocal === normalizedLocal ||
                   normalizedRemote.endsWith(tRemote) || tRemote.endsWith(normalizedRemote) ||
                   normalizedLocal.endsWith(tLocal) || tLocal.endsWith(normalizedLocal);
          });
          
          if (match) {
            updateProgress(match.id, transferred_bytes, total_bytes);
          } else {
            console.log('[SFTP Progress] No match found for:', { remote_path, local_path, transfers: transfers.map(t => ({ remotePath: t.remotePath, localPath: t.localPath })) });
          }
      });
      
      const unlistenComplete = listen<TransferCompleteEvent>(`sftp:complete:${sessionId}`, (event) => {
          const { transfer_id, success, error } = event.payload;
          if (success) {
              setTransferState(transfer_id, 'completed');
              // Refresh file lists
              refreshLocalFiles();
              api.sftpListDir(sessionId, remotePath).then(setRemoteFiles);
          } else {
              setTransferState(transfer_id, 'error', error || 'Transfer failed');
          }
      });
      
      return () => { 
          unlistenProgress.then(f => f()); 
          unlistenComplete.then(f => f());
      };
  }, [sessionId, updateProgress, setTransferState, refreshLocalFiles, remotePath]);

  // Toast notifications
  const { success: toastSuccess, error: toastError } = useToast();

  // Transfer handler (upload/download) - supports both files and directories
  const handleTransfer = async (files: string[], direction: 'upload' | 'download', basePath: string) => {
    const directionLabel = direction === 'upload' ? 'Upload' : 'Download';
    let successCount = 0;
    let failCount = 0;
    
    // Get file info to determine if directory
    const sourceFiles = direction === 'upload' ? localFiles : remoteFiles;
    
    for (const file of files) {
      const fileInfo = sourceFiles.find(f => f.name === file);
      const isDirectory = fileInfo?.file_type === 'Directory';
      
      const localFilePath = direction === 'upload' 
        ? `${basePath}/${file}` 
        : `${localPath}/${file}`;
      const remoteFilePath = direction === 'upload'
        ? `${remotePath}/${file}`
        : `${basePath}/${file}`;
      
      // Add to transfer queue
      const transferId = addTransfer({
        id: `${sessionId}-${Date.now()}-${file}`,
        sessionId,
        name: isDirectory ? `${file}/` : file,
        localPath: localFilePath,
        remotePath: remoteFilePath,
        direction,
        size: fileInfo?.size || 0,
      });
      
      try {
        if (direction === 'upload') {
          if (isDirectory) {
            await api.sftpUploadDir(sessionId, localFilePath, remoteFilePath);
          } else {
            await api.sftpUpload(sessionId, localFilePath, remoteFilePath);
          }
        } else {
          if (isDirectory) {
            await api.sftpDownloadDir(sessionId, remoteFilePath, localFilePath);
          } else {
            await api.sftpDownload(sessionId, remoteFilePath, localFilePath);
          }
        }
        // If no events fired, mark as completed
        setTransferState(transferId, 'completed');
        successCount++;
      } catch (err) {
        console.error("Transfer failed:", err);
        setTransferState(transferId, 'error', String(err));
        failCount++;
      }
    }
    
    // Show toast notification
    if (successCount > 0 && failCount === 0) {
      toastSuccess(`${directionLabel} Complete`, `${successCount} file(s) transferred successfully`);
    } else if (failCount > 0 && successCount === 0) {
      toastError(`${directionLabel} Failed`, `${failCount} file(s) failed to transfer`);
    } else if (successCount > 0 && failCount > 0) {
      toastError(`${directionLabel} Partial`, `${successCount} succeeded, ${failCount} failed`);
    }
    
    // Refresh file lists
    if (direction === 'upload') {
      api.sftpListDir(sessionId, remotePath).then(setRemoteFiles);
    } else {
      refreshLocalFiles();
    }
  };

  // Delete handler - uses recursive delete for directories
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { files, isRemote } = deleteConfirm;
    try {
      if (isRemote) {
        let totalDeleted = 0;
        for (const file of files) {
          const filePath = `${remotePath}/${file}`;
          // Check if it's a directory
          const fileInfo = remoteFiles.find(f => f.name === file);
          if (fileInfo?.file_type === 'Directory') {
            const count = await api.sftpDeleteRecursive(sessionId, filePath);
            totalDeleted += count;
          } else {
            await api.sftpDelete(sessionId, filePath);
            totalDeleted += 1;
          }
        }
        api.sftpListDir(sessionId, remotePath).then(setRemoteFiles);
        setRemoteSelected(new Set());
        toastSuccess('Deleted', `${totalDeleted} item(s) deleted`);
      } else {
        // Local delete
        for (const file of files) {
          const filePath = localPath.endsWith('/') ? `${localPath}${file}` : `${localPath}/${file}`;
          await remove(filePath, { recursive: true });
        }
        refreshLocalFiles();
        setLocalSelected(new Set());
        toastSuccess('Deleted', `${files.length} item(s) deleted`);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toastError('Delete Failed', String(err));
    }
    setDeleteConfirm(null);
  };

  // Rename handler
  const handleRename = async () => {
    if (!renameDialog || !inputValue.trim()) return;
    const { oldName, isRemote } = renameDialog;
    try {
      if (isRemote) {
        await api.sftpRename(sessionId, `${remotePath}/${oldName}`, `${remotePath}/${inputValue}`);
        api.sftpListDir(sessionId, remotePath).then(setRemoteFiles);
        setRemoteSelected(new Set());
        toastSuccess('Renamed', `${oldName} → ${inputValue}`);
      } else {
        // Local rename
        const oldPath = localPath.endsWith('/') ? `${localPath}${oldName}` : `${localPath}/${oldName}`;
        const newPath = localPath.endsWith('/') ? `${localPath}${inputValue}` : `${localPath}/${inputValue}`;
        await rename(oldPath, newPath);
        refreshLocalFiles();
        setLocalSelected(new Set());
        toastSuccess('Renamed', `${oldName} → ${inputValue}`);
      }
    } catch (err) {
      console.error("Rename failed:", err);
      toastError('Rename Failed', String(err));
    }
    setRenameDialog(null);
    setInputValue('');
  };

  // New folder handler
  const handleNewFolder = async () => {
    if (!newFolderDialog || !inputValue.trim()) return;
    const { isRemote } = newFolderDialog;
    try {
      if (isRemote) {
        await api.sftpMkdir(sessionId, `${remotePath}/${inputValue}`);
        api.sftpListDir(sessionId, remotePath).then(setRemoteFiles);
        toastSuccess('Folder Created', inputValue);
      } else {
        // Local mkdir
        const newPath = localPath.endsWith('/') ? `${localPath}${inputValue}` : `${localPath}/${inputValue}`;
        await mkdir(newPath, { recursive: true });
        refreshLocalFiles();
        toastSuccess('Folder Created', inputValue);
      }
    } catch (err) {
      console.error("New folder failed:", err);
      toastError('Create Folder Failed', String(err));
    }
    setNewFolderDialog(null);
    setInputValue('');
  };

  const handleDrop = async (e: React.DragEvent, target: 'local' | 'remote') => {
      e.preventDefault();
      try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          const { files, source, basePath } = data;
          
          if (source === target) return; // Ignore self-drop

          if (source === 'local' && target === 'remote') {
              await handleTransfer(files, 'upload', basePath);
          } else if (source === 'remote' && target === 'local') {
              await handleTransfer(files, 'download', basePath);
          }
      } catch (err) {
          console.error("Drop failed:", err);
      }
  };

  const handlePreview = async (file: FileInfo) => {
      setPreviewLoading(true);
      try {
          const fullPath = `${remotePath}/${file.name}`;
          const content = await api.sftpPreview(sessionId, fullPath);
          
          // Handle all response types from backend
          if ('TooLarge' in content) {
              setPreviewFile({
                  name: file.name,
                  path: fullPath,
                  type: 'too-large',
                  data: '',
                  fileSize: content.TooLarge.size,
                  maxSize: content.TooLarge.max_size,
                  recommendDownload: content.TooLarge.recommend_download,
              });
              return;
          }
          
          if ('Unsupported' in content) {
              setPreviewFile({
                  name: file.name,
                  path: fullPath,
                  type: 'unsupported',
                  data: '',
                  mimeType: content.Unsupported.mime_type,
                  reason: content.Unsupported.reason,
              });
              return;
          }
          
          if ('Text' in content) {
              setPreviewFile({
                  name: file.name,
                  path: fullPath,
                  type: 'text',
                  data: content.Text.data,
                  mimeType: content.Text.mime_type || undefined,
                  language: content.Text.language,
              });
              return;
          }
          
          if ('Image' in content) {
              setPreviewFile({
                  name: file.name,
                  path: fullPath,
                  type: 'image',
                  data: content.Image.data,
                  mimeType: content.Image.mime_type,
              });
              return;
          }
          
          if ('Video' in content) {
              setPreviewFile({
                  name: file.name,
                  path: fullPath,
                  type: 'video',
                  data: content.Video.data,
                  mimeType: content.Video.mime_type,
              });
              return;
          }
          
          if ('Audio' in content) {
              setPreviewFile({
                  name: file.name,
                  path: fullPath,
                  type: 'audio',
                  data: content.Audio.data,
                  mimeType: content.Audio.mime_type,
              });
              return;
          }
          
          if ('Pdf' in content) {
              setPreviewFile({
                  name: file.name,
                  path: fullPath,
                  type: 'pdf',
                  data: content.Pdf.data,
                  mimeType: content.Pdf.original_mime || 'application/pdf',
              });
              return;
          }
          
          if ('Hex' in content) {
              setPreviewFile({
                  name: file.name,
                  path: fullPath,
                  type: 'hex',
                  data: content.Hex.data,
                  hexOffset: content.Hex.offset,
                  hexTotalSize: content.Hex.total_size,
                  hexHasMore: content.Hex.has_more,
              });
              return;
          }
      } catch (e) {
          console.error("Preview failed:", e);
          toastError('Preview Failed', String(e));
      } finally {
          setPreviewLoading(false);
      }
  };

  const handleLoadMoreHex = async () => {
      if (!previewFile || previewFile.type !== 'hex' || !previewFile.hexHasMore) return;
      
      setHexLoadingMore(true);
      try {
          const newOffset = (previewFile.hexOffset || 0) + 16 * 1024; // 16KB chunks
          const content = await api.sftpPreviewHex(sessionId, previewFile.path, newOffset);
          
          if ('Hex' in content) {
              setPreviewFile({
                  ...previewFile,
                  data: previewFile.data + content.Hex.data,
                  hexOffset: newOffset,
                  hexHasMore: content.Hex.has_more,
              });
          }
      } catch (e) {
          console.error("Load more hex failed:", e);
          toastError('Load More Failed', String(e));
      } finally {
          setHexLoadingMore(false);
      }
  };

  return (
    <div className="flex flex-col h-full w-full bg-theme-bg p-2 gap-2">
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Local Pane */}
        <div className="flex-1 min-w-0">
           <FileList 
             title="Local" 
             path={localPath} 
             files={displayLocalFiles}
             onNavigate={(p) => setLocalPath(p === '..' ? localPath.split('/').slice(0,-1).join('/') || '/' : p === '~' ? localHome : p)}
             onRefresh={refreshLocalFiles}
             active={activePane === 'local'}
             onActivate={() => setActivePane('local')}
             onTransfer={(files, dir) => handleTransfer(files, dir, localPath)}
             onDelete={(files) => setDeleteConfirm({ files, isRemote: false })}
             onRename={(name) => { setRenameDialog({ oldName: name, isRemote: false }); setInputValue(name); }}
             onNewFolder={() => setNewFolderDialog({ isRemote: false })}
             selected={localSelected}
             setSelected={setLocalSelected}
             lastSelected={localLastSelected}
             setLastSelected={setLocalLastSelected}
             isDragOver={localDragOver}
             onDragOver={(e) => { e.preventDefault(); setLocalDragOver(true); }}
             onDragLeave={() => setLocalDragOver(false)}
             onDrop={(e) => { setLocalDragOver(false); handleDrop(e, 'local'); }}
             filter={localFilter}
             onFilterChange={setLocalFilter}
             sortField={localSortField}
             sortDirection={localSortDirection}
             onSortChange={(field) => handleSortChange(true, field)}
           />
        </div>

        {/* Remote Pane */}
        <div className="flex-1 min-w-0">
           <FileList 
             title={`Remote (${session?.host})`}
             path={remotePath}
             files={displayRemoteFiles}
             onNavigate={(p) => setRemotePath(p === '..' ? remotePath.split('/').slice(0,-1).join('/') || '/' : p === '~' ? '/home/' + session?.username : p)}
             onRefresh={() => api.sftpListDir(sessionId, remotePath).then(setRemoteFiles)}
             active={activePane === 'remote'}
             onActivate={() => setActivePane('remote')}
             onPreview={handlePreview}
             onTransfer={(files, dir) => handleTransfer(files, dir, remotePath)}
             onDelete={(files) => setDeleteConfirm({ files, isRemote: true })}
             onRename={(name) => { setRenameDialog({ oldName: name, isRemote: true }); setInputValue(name); }}
             onNewFolder={() => setNewFolderDialog({ isRemote: true })}
             selected={remoteSelected}
             setSelected={setRemoteSelected}
             lastSelected={remoteLastSelected}
             setLastSelected={setRemoteLastSelected}
             isDragOver={remoteDragOver}
             onDragOver={(e) => { e.preventDefault(); setRemoteDragOver(true); }}
             onDragLeave={() => setRemoteDragOver(false)}
             onDrop={(e) => { setRemoteDragOver(false); handleDrop(e, 'remote'); }}
             filter={remoteFilter}
             onFilterChange={setRemoteFilter}
             sortField={remoteSortField}
             sortDirection={remoteSortDirection}
             onSortChange={(field) => handleSortChange(false, field)}
           />
        </div>
      </div>
      
      {/* Transfer Queue Panel */}
      <TransferQueue />

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0" aria-describedby="preview-desc">
            <DialogHeader className="px-4 py-2 border-b border-theme-border bg-theme-bg-panel flex flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                    <DialogTitle className="text-sm font-mono flex items-center gap-2">
                        {previewFile?.name}
                        {previewFile?.type === 'hex' && previewFile.hexTotalSize && (
                            <span className="text-xs text-zinc-500">
                                ({formatFileSize(previewFile.hexTotalSize)})
                            </span>
                        )}
                        {previewFile?.language && (
                            <span className="text-xs px-1.5 py-0.5 bg-theme-accent/20 text-theme-accent rounded">
                                {previewFile.language}
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription id="preview-desc" className="sr-only">File preview content</DialogDescription>
                </div>
            </DialogHeader>
            
            {/* Preview Content Area */}
            <div className="flex-1 overflow-auto bg-zinc-950">
                {/* Loading State */}
                {previewLoading && (
                    <div className="flex items-center justify-center h-full">
                        <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
                    </div>
                )}
                
                {/* Text Preview with syntax highlighting */}
                {!previewLoading && previewFile?.type === 'text' && (
                    <pre className="p-4 font-mono text-xs text-zinc-300 whitespace-pre overflow-x-auto">
                        <code>{previewFile.data}</code>
                    </pre>
                )}
                
                {/* Image Preview */}
                {!previewLoading && previewFile?.type === 'image' && (
                    <div className="flex items-center justify-center h-full p-4">
                        <img 
                            src={`data:${previewFile.mimeType};base64,${previewFile.data}`}
                            alt={previewFile.name}
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                )}
                
                {/* Video Preview */}
                {!previewLoading && previewFile?.type === 'video' && (
                    <div className="flex items-center justify-center h-full p-4">
                        <video 
                            controls
                            className="max-w-full max-h-full"
                            src={`data:${previewFile.mimeType};base64,${previewFile.data}`}
                        >
                            Your browser does not support video playback.
                        </video>
                    </div>
                )}
                
                {/* Audio Preview */}
                {!previewLoading && previewFile?.type === 'audio' && (
                    <div className="flex flex-col items-center justify-center h-full p-4 gap-4">
                        <div className="text-6xl">🎵</div>
                        <div className="text-zinc-400">{previewFile.name}</div>
                        <audio 
                            controls
                            className="w-full max-w-md"
                            src={`data:${previewFile.mimeType};base64,${previewFile.data}`}
                        >
                            Your browser does not support audio playback.
                        </audio>
                    </div>
                )}
                
                {/* PDF Preview */}
                {!previewLoading && previewFile?.type === 'pdf' && (
                    <iframe
                        src={`data:application/pdf;base64,${previewFile.data}`}
                        className="w-full h-full"
                        title={previewFile.name}
                    />
                )}
                
                {/* Hex Preview */}
                {!previewLoading && previewFile?.type === 'hex' && (
                    <div className="p-4">
                        <div className="text-xs text-zinc-500 mb-2 flex items-center gap-2">
                            <span>Hex View</span>
                            <span>•</span>
                            <span>显示前 {formatFileSize((previewFile.hexOffset || 0) + 16384)}</span>
                            {previewFile.hexTotalSize && (
                                <>
                                    <span>•</span>
                                    <span>共 {formatFileSize(previewFile.hexTotalSize)}</span>
                                </>
                            )}
                        </div>
                        <pre className="font-mono text-xs text-zinc-300 whitespace-pre overflow-x-auto leading-5">
                            {previewFile.data}
                        </pre>
                        {previewFile.hexHasMore && (
                            <div className="mt-4 flex justify-center">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={handleLoadMoreHex}
                                    disabled={hexLoadingMore}
                                >
                                    {hexLoadingMore ? (
                                        <>
                                            <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                                            加载中...
                                        </>
                                    ) : (
                                        '加载更多 (+16KB)'
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Too Large */}
                {!previewLoading && previewFile?.type === 'too-large' && (
                    <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
                        <div className="text-6xl">📦</div>
                        <div className="text-zinc-300 text-lg">文件过大</div>
                        <div className="text-zinc-500 text-sm text-center">
                            <p>文件大小: {formatFileSize(previewFile.fileSize || 0)}</p>
                            <p>预览限制: {formatFileSize(previewFile.maxSize || 0)}</p>
                        </div>
                        {previewFile.recommendDownload && (
                            <p className="text-zinc-400 text-sm">建议下载后在本地查看</p>
                        )}
                    </div>
                )}
                
                {/* Unsupported */}
                {!previewLoading && previewFile?.type === 'unsupported' && (
                    <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
                        <div className="text-6xl">❓</div>
                        <div className="text-zinc-300 text-lg">无法预览</div>
                        <div className="text-zinc-500 text-sm text-center">
                            <p>类型: {previewFile.mimeType}</p>
                            {previewFile.reason && <p className="mt-2">{previewFile.reason}</p>}
                        </div>
                    </div>
                )}
            </div>
            
            <DialogFooter className="p-2 border-t border-theme-border bg-theme-bg-panel justify-between sm:justify-between">
                <div className="text-xs text-zinc-500 self-center px-2 truncate max-w-md">
                    {previewFile?.path}
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={async () => {
                        if (!previewFile) return;
                        try {
                            const localDest = `${localPath}/${previewFile.name}`;
                            await api.sftpDownload(sessionId, previewFile.path, localDest);
                            refreshLocalFiles();
                            setPreviewFile(null);
                        } catch (e) {
                            console.error("Download failed:", e);
                        }
                    }}>
                        <Download className="h-3 w-3 mr-2" /> Download
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewFile(null)}>Close</Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(open) => !open && setRenameDialog(null)}>
        <DialogContent className="max-w-sm" aria-describedby="rename-desc">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription id="rename-desc">Enter a new name</DialogDescription>
          </DialogHeader>
          <Input 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameDialog(null)}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={!!newFolderDialog} onOpenChange={(open) => !open && setNewFolderDialog(null)}>
        <DialogContent className="max-w-sm" aria-describedby="newfolder-desc">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription id="newfolder-desc">Enter folder name</DialogDescription>
          </DialogHeader>
          <Input 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
            placeholder="folder-name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderDialog(null)}>Cancel</Button>
            <Button onClick={handleNewFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm" aria-describedby="delete-desc">
          <DialogHeader>
            <DialogTitle>Delete</DialogTitle>
            <DialogDescription id="delete-desc">
              Are you sure you want to delete {deleteConfirm?.files.length} item(s)?
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-32 overflow-auto text-xs text-zinc-400 bg-zinc-950 p-2 rounded">
            {deleteConfirm?.files.map(f => <div key={f}>{f}</div>)}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
