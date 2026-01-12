import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  FolderPlus
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { TransferQueue } from './TransferQueue';
import { api } from '../../lib/api';
import { FileInfo } from '../../types';
import { listen } from '@tauri-apps/api/event';
import { readDir, stat } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/dialog';

// Types for Transfer Events (should match Backend)
interface TransferEvent {
    id: string;
    sessionId: string;
    transferred: number;
    total: number;
}

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
  setLastSelected
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
  setLastSelected: (s: string | null) => void
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
  }, [active, selected, files, title, onTransfer, onDelete, onRename, setSelected]);

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
        "flex flex-col h-full bg-oxide-bg border transition-colors",
        active ? "border-oxide-accent/50" : "border-oxide-border"
      )}
      onClick={onActivate}
      onContextMenu={(e) => handleContextMenu(e)}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center gap-2 p-2 border-b transition-colors h-10",
        active ? "bg-zinc-800/50 border-oxide-accent/30" : "bg-oxide-panel border-oxide-border"
      )}>
        <span className="font-semibold text-xs text-zinc-400 uppercase tracking-wider min-w-16">{title}</span>
        <div className="flex-1 flex items-center gap-1 bg-zinc-950 border border-oxide-border px-2 py-0.5 rounded-sm overflow-hidden">
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
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-2 py-1 bg-zinc-900 border-b border-oxide-border text-xs text-zinc-500">
        <div className="flex-1">Name</div>
        <div className="w-20 text-right">Size</div>
        <div className="w-24 text-right">Mod</div>
      </div>

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
                isSelected && "bg-oxide-accent/20 text-oxide-accent"
              )}
            >
              <div className="flex-1 flex items-center gap-2 truncate">
                {file.file_type === 'Directory' ? <Folder className="h-3.5 w-3.5 text-blue-400" /> : <File className="h-3.5 w-3.5 text-zinc-400" />}
                <span>{file.name}</span>
              </div>
              <div className="w-20 text-right text-zinc-500">
                {file.file_type === 'Directory' ? '-' : (file.size / 1024).toFixed(1) + ' KB'}
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
          className="fixed z-50 bg-oxide-panel border border-oxide-border rounded-sm shadow-lg py-1 min-w-[180px]"
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
          
          <div className="border-t border-oxide-border my-1" />
          
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
  const [previewFile, setPreviewFile] = useState<{name: string, content: string, path: string} | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Dialog States
  const [renameDialog, setRenameDialog] = useState<{oldName: string, isRemote: boolean} | null>(null);
  const [newFolderDialog, setNewFolderDialog] = useState<{isRemote: boolean} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{files: string[], isRemote: boolean} | null>(null);
  const [inputValue, setInputValue] = useState('');

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
          try {
            const info = await stat(fullPath);
            return {
              name: entry.name,
              path: fullPath,
              file_type: entry.isDirectory ? 'Directory' : 'File',
              size: info.size || 0,
              modified: info.mtime ? Math.floor(info.mtime.getTime() / 1000) : 0,
              permissions: ''
            } as FileInfo;
          } catch {
            return {
              name: entry.name,
              path: fullPath,
              file_type: entry.isDirectory ? 'Directory' : 'File',
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

  // Event Listener for Progress
  useEffect(() => {
      const unlisten = listen<TransferEvent>(`sftp:progress:${sessionId}`, (event) => {
          // TODO: Update TransferQueue Store/State
          console.log('Transfer Update:', event);
      });
      return () => { unlisten.then(f => f()); };
  }, [sessionId]);

  // Transfer handler (upload/download)
  const handleTransfer = async (files: string[], direction: 'upload' | 'download', basePath: string) => {
    try {
      if (direction === 'upload') {
        for (const file of files) {
          const localFilePath = `${basePath}/${file}`;
          const remoteFilePath = `${remotePath}/${file}`;
          console.log(`Uploading ${localFilePath} -> ${remoteFilePath}`);
          await api.sftpUpload(sessionId, localFilePath, remoteFilePath);
        }
        // Refresh remote
        api.sftpListDir(sessionId, remotePath).then(setRemoteFiles);
      } else {
        for (const file of files) {
          const remoteFilePath = `${basePath}/${file}`;
          const localFilePath = `${localPath}/${file}`;
          console.log(`Downloading ${remoteFilePath} -> ${localFilePath}`);
          await api.sftpDownload(sessionId, remoteFilePath, localFilePath);
        }
        // Refresh local
        refreshLocalFiles();
      }
    } catch (err) {
      console.error("Transfer failed:", err);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { files, isRemote } = deleteConfirm;
    try {
      if (isRemote) {
        for (const file of files) {
          await api.sftpDelete(sessionId, `${remotePath}/${file}`);
        }
        api.sftpListDir(sessionId, remotePath).then(setRemoteFiles);
        setRemoteSelected(new Set());
      } else {
        // Local delete not implemented - would need tauri fs write permissions
        console.log("Local delete not implemented yet");
      }
    } catch (err) {
      console.error("Delete failed:", err);
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
      } else {
        // Local rename not implemented
        console.log("Local rename not implemented yet");
      }
    } catch (err) {
      console.error("Rename failed:", err);
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
      } else {
        // Local mkdir not implemented
        console.log("Local mkdir not implemented yet");
      }
    } catch (err) {
      console.error("New folder failed:", err);
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
      if (file.size > 1024 * 1024) {
          // TODO: Show toast for too large
          console.warn("File too large to preview");
          return;
      }

      setPreviewLoading(true);
      try {
          const fullPath = `${remotePath}/${file.name}`;
          const content = await api.sftpPreview(sessionId, fullPath);
          
          let text = "";
          if ('Text' in content) {
              text = content.Text.data;
          } else if ('Base64' in content) {
              text = atob(content.Base64.data); // Decode for display if possible, or show hex
          } else {
              text = "[Binary or Unsupported Content]";
          }

          setPreviewFile({
              name: file.name,
              path: fullPath,
              content: text
          });
      } catch (e) {
          console.error("Preview failed:", e);
      } finally {
          setPreviewLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full w-full bg-oxide-bg p-2 gap-2">
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Local Pane */}
        <div 
            className="flex-1 min-w-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'local')}
        >
           <FileList 
             title="Local" 
             path={localPath} 
             files={localFiles}
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
           />
        </div>

        {/* Remote Pane */}
        <div 
            className="flex-1 min-w-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'remote')}
        >
           <FileList 
             title={`Remote (${session?.host})`}
             path={remotePath}
             files={remoteFiles}
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
           />
        </div>
      </div>
      
      {/* Transfer Queue Panel */}
      <TransferQueue />

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0" aria-describedby="preview-desc">
            <DialogHeader className="px-4 py-2 border-b border-oxide-border bg-oxide-panel flex flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                    <DialogTitle className="text-sm font-mono">{previewFile?.name}</DialogTitle>
                    <DialogDescription id="preview-desc" className="sr-only">File preview content</DialogDescription>
                </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-zinc-950 p-4 font-mono text-xs text-zinc-300 whitespace-pre">
                {previewFile?.content}
            </div>
            <DialogFooter className="p-2 border-t border-oxide-border bg-oxide-panel justify-between sm:justify-between">
                <div className="text-xs text-zinc-500 self-center px-2">
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
