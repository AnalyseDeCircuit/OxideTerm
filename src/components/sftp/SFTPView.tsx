import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  File, 
  ArrowUp, 
  RefreshCw, 
  Home, 
  Search,
  HardDrive,
  Download,
  X
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { Separator } from '../ui/separator';
import { TransferQueue } from './TransferQueue';
import { api } from '../../lib/api';
import { FileInfo, PreviewContent } from '../../types';
import { listen } from '@tauri-apps/api/event';
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
  onPreview
}: { 
  title: string, 
  path: string, 
  files: FileInfo[],
  onNavigate: (path: string) => void,
  onRefresh: () => void,
  active: boolean,
  onActivate: () => void,
  onPreview?: (file: FileInfo) => void
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);

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

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-oxide-bg border transition-colors",
        active ? "border-oxide-accent/50" : "border-oxide-border"
      )}
      onClick={onActivate}
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
      <div className="flex-1 overflow-y-auto outline-none" tabIndex={0} onClick={() => setSelected(new Set())}>
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
    </div>
  );
}

export const SFTPView = ({ sessionId }: { sessionId: string }) => {
  const { getSession } = useAppStore();
  const session = getSession(sessionId);
  const [remoteFiles, setRemoteFiles] = useState<FileInfo[]>([]);
  const [remotePath, setRemotePath] = useState('/home/' + (session?.username || 'user'));
  
  const [localFiles, setLocalFiles] = useState<FileInfo[]>([]);
  const [localPath, setLocalPath] = useState('/Users/dominical');

  const [activePane, setActivePane] = useState<'local' | 'remote'>('remote');
  const [sftpInitialized, setSftpInitialized] = useState(false);

  // Preview State
  const [previewFile, setPreviewFile] = useState<{name: string, content: string, path: string} | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  // Mock local refresh (Replace with real API when available)
  useEffect(() => {
     setLocalFiles([
         { name: 'Documents', path: '/Users/dominical/Documents', file_type: 'Directory', size: 0, modified: Date.now(), permissions: '' },
         { name: 'Downloads', path: '/Users/dominical/Downloads', file_type: 'Directory', size: 0, modified: Date.now(), permissions: '' },
         { name: 'upload_me.txt', path: '/Users/dominical/upload_me.txt', file_type: 'File', size: 1024, modified: Date.now(), permissions: '' },
     ]);
  }, [localPath]);

  // Event Listener for Progress
  useEffect(() => {
      const unlisten = listen<TransferEvent>(`sftp:progress:${sessionId}`, (event) => {
          // TODO: Update TransferQueue Store/State
          console.log('Transfer Update:', event);
      });
      return () => { unlisten.then(f => f()); };
  }, [sessionId]);

  const handleDrop = async (e: React.DragEvent, target: 'local' | 'remote') => {
      e.preventDefault();
      try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          const { files, source, basePath } = data;
          
          if (source === target) return; // Ignore self-drop

          if (source === 'local' && target === 'remote') {
              // Upload
              for (const file of files) {
                  const localFilePath = `${basePath}/${file}`;
                  const remoteFilePath = `${remotePath}/${file}`;
                  console.log(`Uploading ${localFilePath} -> ${remoteFilePath}`);
                  await api.sftpUpload(sessionId, localFilePath, remoteFilePath);
              }
              // Refresh remote
              api.sftpListDir(sessionId, remotePath).then(setRemoteFiles);
          } else if (source === 'remote' && target === 'local') {
              // Download (Mock implementation until api.sftpDownload is ready)
              console.log(`Downloading ${files.length} files to ${localPath}`);
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
             onNavigate={(p) => setLocalPath(p === '..' ? localPath.split('/').slice(0,-1).join('/') || '/' : p === '~' ? '/Users/dominical' : p)}
             onRefresh={() => {}}
             active={activePane === 'local'}
             onActivate={() => setActivePane('local')}
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
                    <Button variant="secondary" size="sm" onClick={() => {
                        // TODO: Implement download from preview
                        console.log("Download", previewFile?.path);
                    }}>
                        <Download className="h-3 w-3 mr-2" /> Download
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewFile(null)}>Close</Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
