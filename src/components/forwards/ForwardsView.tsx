import React from 'react';
import { Play, Square, RefreshCcw, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';

interface ForwardRule {
  id: string;
  type: 'Local' | 'Remote' | 'Dynamic';
  local: string;
  remote: string;
  status: 'active' | 'starting' | 'stopped' | 'error';
}

export const ForwardsView = ({ sessionId }: { sessionId: string }) => {
  const { getSession } = useAppStore();
  const session = getSession(sessionId);

  // MOCK DATA
  const forwards: ForwardRule[] = [
    { id: '1', type: 'Local', local: 'localhost:8888', remote: 'localhost:8888', status: 'active' },
    { id: '2', type: 'Local', local: 'localhost:5432', remote: 'db.internal:5432', status: 'active' },
    { id: '3', type: 'Remote', local: 'localhost:3000', remote: '0.0.0.0:8080', status: 'stopped' },
  ];

  return (
    <div className="h-full w-full bg-oxide-bg p-4 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Quick Actions */}
        <div className="space-y-2">
           <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Quick Forwards</h3>
           <div className="flex gap-2">
             <Button variant="secondary" className="gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" /> Jupyter (8888)
             </Button>
             <Button variant="secondary" className="gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> VS Code (8080)
             </Button>
           </div>
        </div>

        <Separator />

        {/* Active Forwards Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Active Forwards</h3>
            <Button size="sm" className="gap-1">
              <Plus className="h-3 w-3" /> New Forward
            </Button>
          </div>

          <div className="border border-oxide-border rounded-sm overflow-hidden">
             <table className="w-full text-sm text-left">
               <thead className="bg-oxide-panel text-zinc-500 border-b border-oxide-border">
                 <tr>
                   <th className="px-4 py-2 font-medium">Type</th>
                   <th className="px-4 py-2 font-medium">Local Address</th>
                   <th className="px-4 py-2 font-medium">Remote Address</th>
                   <th className="px-4 py-2 font-medium">Status</th>
                   <th className="px-4 py-2 font-medium text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-oxide-border bg-zinc-950/50">
                 {forwards.map(fw => (
                   <tr key={fw.id} className="group hover:bg-zinc-900 transition-colors">
                     <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                          ${fw.type === 'Local' ? 'bg-blue-900/30 text-blue-400' : 
                            fw.type === 'Remote' ? 'bg-purple-900/30 text-purple-400' : 
                            'bg-yellow-900/30 text-yellow-400'}`}>
                          {fw.type}
                        </span>
                     </td>
                     <td className="px-4 py-2 font-mono text-zinc-300">{fw.local}</td>
                     <td className="px-4 py-2 font-mono text-zinc-300">{fw.remote}</td>
                     <td className="px-4 py-2">
                       <div className="flex items-center gap-1.5">
                         <div className={`w-2 h-2 rounded-full 
                           ${fw.status === 'active' ? 'bg-green-500' : 
                             fw.status === 'stopped' ? 'bg-zinc-500' : 'bg-red-500'}`} />
                         <span className="capitalize text-zinc-400">{fw.status}</span>
                       </div>
                     </td>
                     <td className="px-4 py-2 text-right">
                       <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         {fw.status === 'active' ? (
                           <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-red-400">
                             <Square className="h-3 w-3 fill-current" />
                           </Button>
                         ) : (
                           <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-green-400">
                             <Play className="h-3 w-3 fill-current" />
                           </Button>
                         )}
                         <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-red-400">
                           <Trash2 className="h-3 w-3" />
                         </Button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>
      </div>
    </div>
  );
};
