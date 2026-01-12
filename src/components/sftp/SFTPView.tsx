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

interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  date: string;
}

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
  const [selected, setSelected] = useState<string | null>(null);

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
        <div className="w-24 text-right">Date</div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {files.map((file) => (
          <div 
            key={file.name}
            onClick={() => setSelected(file.name)}
            onDoubleClick={() => file.isDir && onNavigate(file.path)}
            className={cn(
              "flex items-center px-2 py-1 text-xs cursor-default select-none border-b border-transparent hover:bg-zinc-800",
              selected === file.name && "bg-oxide-accent/20 text-oxide-accent"
            )}
          >
            <div className="flex-1 flex items-center gap-2 truncate">
              {file.isDir ? <Folder className="h-3.5 w-3.5 text-blue-400" /> : <File className="h-3.5 w-3.5 text-zinc-400" />}
              <span>{file.name}</span>
            </div>
            <div className="w-20 text-right text-zinc-500">
              {file.isDir ? '-' : (file.size / 1024).toFixed(1) + ' KB'}
            </div>
            <div className="w-24 text-right text-zinc-600">
              {file.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SFTPView = ({ sessionId }: { sessionId: string }) => {
  const { getSession } = useAppStore();
  const session = getSession(sessionId);

  // MOCK DATA
  const mockFiles: FileInfo[] = [
    { name: 'Documents', path: '/home/user/Documents', isDir: true, size: 0, date: 'Jan 10' },
    { name: 'Downloads', path: '/home/user/Downloads', isDir: true, size: 0, date: 'Jan 11' },
    { name: 'project_v1.zip', path: '/home/user/project_v1.zip', isDir: false, size: 2450000, date: 'Jan 09' },
    { name: '.bashrc', path: '/home/user/.bashrc', isDir: false, size: 1200, date: 'Jan 01' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-oxide-bg p-2 gap-2">
      {/* Transfer Status Bar (Top or Bottom) */}
      <div className="flex items-center justify-between h-8 px-2 bg-oxide-panel border border-oxide-border mb-0">
         <span className="text-xs text-zinc-400">Status: Idle</span>
         <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Queue: 0</span>
         </div>
      </div>

      <div className="flex-1 flex gap-2 min-h-0">
        {/* Local Pane */}
        <div className="flex-1 min-w-0">
           <FileList 
             title="Local" 
             path="/Users/dominical/Documents" 
             files={mockFiles} 
             onNavigate={() => {}}
             onRefresh={() => {}}
           />
        </div>

        {/* Remote Pane */}
        <div className="flex-1 min-w-0">
           <FileList 
             title={`Remote (${session?.host})`}
             path="/home/lipsc" 
             files={mockFiles} // Using same mock for now
             onNavigate={() => {}}
             onRefresh={() => {}}
           />
        </div>
      </div>
    </div>
  );
};
