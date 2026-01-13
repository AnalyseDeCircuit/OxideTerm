import React from 'react';
import { X, Pause, Play, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { useTransferStore, formatBytes, formatSpeed, calculateSpeed, TransferItem } from '../../store/transferStore';
import { api } from '../../lib/api';

export const TransferQueue = () => {
  const { getAllTransfers, clearCompleted, cancelTransfer, removeTransfer, pauseTransfer, resumeTransfer, pauseAll } = useTransferStore();
  const items = getAllTransfers();

  const activeCount = items.filter(i => i.state === 'active' || i.state === 'pending').length;
  const hasCompleted = items.some(i => i.state === 'completed');

  const getProgress = (item: TransferItem): number => {
    if (item.size === 0) return 0;
    return Math.round((item.transferred / item.size) * 100);
  };

  const getStatusText = (item: TransferItem): string => {
    switch (item.state) {
      case 'pending': return 'Waiting...';
      case 'active': return formatSpeed(calculateSpeed(item));
      case 'paused': return 'Paused';
      case 'completed': return 'Done';
      case 'error': return item.error || 'Error';
      default: return '';
    }
  };

  const handlePauseAll = async () => {
    // Pause all active transfers in backend
    for (const item of items) {
      if (item.state === 'active' || item.state === 'pending') {
        try {
          await api.sftpPauseTransfer(item.id);
        } catch (e) {
          console.error('Failed to pause transfer:', item.id, e);
        }
      }
    }
    // Update frontend state
    pauseAll();
  };

  const handlePause = async (item: TransferItem) => {
    try {
      await api.sftpPauseTransfer(item.id);
      pauseTransfer(item.id);
    } catch (e) {
      console.error('Failed to pause transfer:', e);
    }
  };

  const handleResume = async (item: TransferItem) => {
    try {
      await api.sftpResumeTransfer(item.id);
      resumeTransfer(item.id);
    } catch (e) {
      console.error('Failed to resume transfer:', e);
    }
  };

  const handleCancel = async (item: TransferItem) => {
    try {
      await api.sftpCancelTransfer(item.id);
      cancelTransfer(item.id);
    } catch (e) {
      console.error('Failed to cancel transfer:', e);
    }
  };

  return (
    <div className="h-48 bg-theme-bg border-t border-theme-border flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 bg-theme-bg-panel border-b border-theme-border">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Transfer Queue {activeCount > 0 ? `(${activeCount} active)` : ''}
        </span>
        <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 text-xs px-2" 
              disabled={activeCount === 0}
              onClick={handlePauseAll}
            >
              Pause All
            </Button>
            {hasCompleted && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 text-xs px-2"
                onClick={clearCompleted}
              >
                Clear Done
              </Button>
            )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
         {items.length === 0 ? (
           <div className="flex items-center justify-center h-full text-sm text-zinc-500">
             No transfers in progress
           </div>
         ) : (
           items.map(item => (
             <div 
               key={item.id} 
               className={`flex items-center gap-3 text-sm p-2 bg-zinc-900/50 rounded-sm border ${
                 item.state === 'error' ? 'border-red-500/50' : 'border-transparent hover:border-theme-border'
               }`}
             >
                 <div className="w-4 text-center text-zinc-500 font-bold">
                     {item.direction === 'upload' ? '↑' : '↓'}
                 </div>
                 <div className="w-48 truncate text-zinc-300" title={item.name}>
                     {item.name}
                 </div>
                 <div className="flex-1 flex flex-col gap-1">
                     <Progress value={getProgress(item)} className="h-1.5" />
                     <div className="flex justify-between text-[10px] text-zinc-500">
                       <span>{formatBytes(item.transferred)} / {formatBytes(item.size)}</span>
                       <span>{getProgress(item)}%</span>
                     </div>
                 </div>
                 <div className={`w-24 text-right text-xs font-mono ${
                   item.state === 'error' ? 'text-red-400' : 'text-zinc-500'
                 }`}>
                     {getStatusText(item)}
                 </div>
                 <div className="flex items-center gap-1">
                     {item.state === 'active' && (
                         <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handlePause(item)}>
                           <Pause className="h-3 w-3" />
                         </Button>
                     )}
                     {item.state === 'paused' && (
                         <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleResume(item)}>
                           <Play className="h-3 w-3" />
                         </Button>
                     )}
                     {item.state === 'completed' && (
                         <Check className="h-4 w-4 text-green-500" />
                     )}
                     {item.state === 'error' && (
                         <AlertCircle className="h-4 w-4 text-red-400" />
                     )}
                     {(item.state === 'active' || item.state === 'pending' || item.state === 'paused') && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6 hover:text-red-400"
                          onClick={() => handleCancel(item)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                     )}
                     {(item.state === 'completed' || item.state === 'error') && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6"
                          onClick={() => removeTransfer(item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                     )}
                 </div>
             </div>
         ))
         )}
      </div>
    </div>
  );
};
