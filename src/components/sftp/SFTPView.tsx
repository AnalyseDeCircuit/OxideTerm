import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  File, 
  ArrowUp, 
  RefreshCw, 
  Home, 
  Search,
  HardDrive
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { Separator } from '../ui/separator';
import { TransferQueue } from './TransferQueue';
import { api } from '../../lib/api';
import { FileInfo } from '../../types';

const FileList = ({ 
  title, 
  path, 
  files, 
  onNavigate, 
  onRefresh 
}: { 
  title: string, 
  path: string, 
  files: FileInfo[],
  onNavigate: (path: string) => void,
  onRefresh: () => void
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);

  const handleSelect = (name: string, multi: boolean, range: boolean) => {
    const newSelected = new Set(multi ? selected : []);
    
    if (range && lastSelected && files.length > 0) {
       // Simple range logic
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
    <div className="flex flex-col h-full bg-oxide-bg border border-oxide-border">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 bg-oxide-panel border-b border-oxide-border h-10">
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
      <div className="flex-1 overflow-y-auto" onClick={() => setSelected(new Set())}>
        {files.map((file) => {
          const isSelected = selected.has(file.name);
          return (
            <div 
              key={file.name}
              onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(file.name, e.metaKey || e.ctrlKey, e.shiftKey);
              }}
              onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (file.file_type === 'Directory') onNavigate(file.path + '/' + file.name); // Mock path logic
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
                {/* Mock Date */}
                Jan 01
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
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [remotePath, setRemotePath] = useState('/home/user');

  useEffect(() => {
     // Load initial files
     api.sftpListDir(sessionId, remotePath).then(setFiles);
  }, [sessionId, remotePath]);

  return (
    <div className="flex flex-col h-full w-full bg-oxide-bg p-2 gap-2">
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Local Pane */}
        <div className="flex-1 min-w-0">
           <FileList 
             title="Local" 
             path="/Users/dominical/Documents" 
             files={files} // Mocking same files for now
             onNavigate={() => {}}
             onRefresh={() => {}}
           />
        </div>

        {/* Remote Pane */}
        <div className="flex-1 min-w-0">
           <FileList 
             title={`Remote (${session?.host})`}
             path={remotePath}
             files={files}
             onNavigate={(p) => setRemotePath(p)}
             onRefresh={() => api.sftpListDir(sessionId, remotePath).then(setFiles)}
           />
        </div>
      </div>
      
      {/* Transfer Queue Panel */}
      <TransferQueue />
    </div>
  );
};
