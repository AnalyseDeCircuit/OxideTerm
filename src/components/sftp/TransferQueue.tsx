import React from 'react';
import { X, Pause, Play, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

interface TransferItem {
  id: string;
  name: string;
  type: 'upload' | 'download';
  progress: number; // 0-100
  size: string;
  speed: string;
  state: 'pending' | 'active' | 'paused' | 'completed' | 'error';
}

export const TransferQueue = () => {
  // Transfer items will be populated from actual transfer events
  const items: TransferItem[] = [];

  const activeCount = items.filter(i => i.state === 'active').length;

  return (
    <div className="h-48 bg-oxide-bg border-t border-oxide-border flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 bg-oxide-panel border-b border-oxide-border">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Transfer Queue {activeCount > 0 ? `(${activeCount} active)` : ''}</span>
        <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" disabled={items.length === 0}>Pause All</Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" disabled={items.length === 0}><X className="h-3 w-3" /></Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
         {items.length === 0 ? (
           <div className="flex items-center justify-center h-full text-sm text-zinc-500">
             No transfers in progress
           </div>
         ) : (
           items.map(item => (
             <div key={item.id} className="flex items-center gap-3 text-sm p-2 bg-zinc-900/50 rounded-sm border border-transparent hover:border-oxide-border">
                 <div className="w-4 text-center text-zinc-500 font-bold">
                     {item.type === 'upload' ? '↑' : '↓'}
                 </div>
                 <div className="w-48 truncate text-zinc-300" title={item.name}>
                     {item.name}
                 </div>
                 <div className="flex-1 flex flex-col gap-1">
                     <Progress value={item.progress} className="h-1.5" />
                 </div>
                 <div className="w-24 text-right text-xs text-zinc-500 font-mono">
                     {item.state === 'active' ? item.speed : item.state}
                 </div>
                 <div className="flex items-center gap-1">
                     {item.state === 'active' && (
                         <Button size="icon" variant="ghost" className="h-6 w-6"><Pause className="h-3 w-3" /></Button>
                     )}
                     {item.state === 'paused' && (
                         <Button size="icon" variant="ghost" className="h-6 w-6"><Play className="h-3 w-3" /></Button>
                     )}
                     {item.state === 'completed' && (
                         <Check className="h-4 w-4 text-green-500" />
                     )}
                     {(item.state === 'active' || item.state === 'pending' || item.state === 'paused') && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-red-400"><X className="h-3 w-3" /></Button>
                     )}
                 </div>
             </div>
         ))
         )}
      </div>
    </div>
  );
};
