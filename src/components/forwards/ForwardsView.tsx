import { useState, useEffect } from 'react';
import { Play, Square, RefreshCcw, Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { api } from '../../lib/api';
import { ForwardRule, ForwardType } from '../../types';

export const ForwardsView = ({ sessionId }: { sessionId: string }) => {
  const [forwards, setForwards] = useState<ForwardRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  // New Forward Form State
  const [forwardType, setForwardType] = useState<ForwardType>('local');
  const [bindAddress, setBindAddress] = useState('localhost');
  const [bindPort, setBindPort] = useState('');
  const [targetHost, setTargetHost] = useState('localhost');
  const [targetPort, setTargetPort] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchForwards = async () => {
    try {
      setLoading(true);
      const list = await api.listPortForwards(sessionId);
      setForwards(list);
    } catch (error) {
      console.error("Failed to list forwards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForwards();
    // Poll every 5 seconds for status updates
    const interval = setInterval(fetchForwards, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleCreateQuick = async (type: 'jupyter' | 'tensorboard') => {
      try {
          if (type === 'jupyter') {
            await api.forwardJupyter(sessionId, 8888, 8888);
          } else if (type === 'tensorboard') {
            await api.forwardTensorboard(sessionId, 6006, 6006);
          }
          fetchForwards();
      } catch (e) {
          console.error(e);
      }
  };

  const handleCreateForward = async () => {
      setCreateError(null);
      if (!bindPort || (forwardType !== 'dynamic' && !targetPort)) {
          setCreateError("Port is required");
          return;
      }

      try {
          await api.createPortForward({
              session_id: sessionId,
              forward_type: forwardType,
              bind_address: bindAddress,
              bind_port: parseInt(bindPort),
              target_host: forwardType === 'dynamic' ? '0.0.0.0' : targetHost,
              target_port: forwardType === 'dynamic' ? 0 : parseInt(targetPort)
          });
          setShowNewForm(false);
          setBindPort('');
          setTargetPort('');
          fetchForwards();
      } catch (e: any) {
          setCreateError(e.toString());
      }
  };

  return (
    <div className="h-full w-full bg-oxide-bg p-4 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Quick Actions */}
        <div className="space-y-2">
           <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Quick Forwards</h3>
           <div className="flex gap-2">
             <Button variant="secondary" className="gap-2" onClick={() => handleCreateQuick('jupyter')}>
                <span className="w-2 h-2 rounded-full bg-orange-500" /> Jupyter (8888)
             </Button>
             <Button variant="secondary" className="gap-2" onClick={() => handleCreateQuick('tensorboard')}>
                <span className="w-2 h-2 rounded-full bg-blue-500" /> TensorBoard (6006)
             </Button>
           </div>
        </div>

        <Separator />

        {/* Active Forwards Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Active Forwards</h3>
            <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={fetchForwards} disabled={loading}>
                    <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button 
                    size="sm" 
                    className="gap-1" 
                    variant={showNewForm ? "secondary" : "default"}
                    onClick={() => setShowNewForm(!showNewForm)}
                >
                    <Plus className="h-3 w-3" /> New Forward
                </Button>
            </div>
          </div>

          <div className="border border-oxide-border rounded-sm overflow-hidden min-h-[100px] bg-oxide-panel/50">
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
                 {forwards.length === 0 ? (
                     <tr>
                         <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                             No active port forwards
                         </td>
                     </tr>
                 ) : (
                     forwards.map(fw => (
                  <tr key={fw.id} className="group hover:bg-zinc-900 transition-colors">
                    <td className="px-4 py-2">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                         ${fw.forward_type === 'local' ? 'bg-blue-900/30 text-blue-400' : 
                           fw.forward_type === 'remote' ? 'bg-purple-900/30 text-purple-400' : 
                           'bg-yellow-900/30 text-yellow-400'}`}>
                         {fw.forward_type}
                       </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-zinc-300">
                        {fw.forward_type === 'remote' ? `${fw.target_host}:${fw.target_port}` : `${fw.bind_address}:${fw.bind_port}`}
                    </td>
                    <td className="px-4 py-2 font-mono text-zinc-300">
                        {fw.forward_type === 'remote' ? `${fw.bind_address}:${fw.bind_port}` : `${fw.target_host}:${fw.target_port}`}
                    </td>
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
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-zinc-400 hover:text-red-400"
                            onClick={() => api.stopPortForward(sessionId, fw.id).then(fetchForwards)}
                          >
                            <Square className="h-3 w-3 fill-current" />
                          </Button>
                        ) : (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-zinc-400 hover:text-green-400"
                            disabled
                          >
                            <Play className="h-3 w-3 fill-current" />
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-zinc-400 hover:text-red-400"
                          onClick={() => api.stopPortForward(sessionId, fw.id).then(fetchForwards)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))) }
               </tbody>
             </table>
          </div>
        </div>

        {/* New Forward Form */}
        {showNewForm && (
            <div className="border border-oxide-border rounded-sm bg-oxide-panel/30 p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-300">New Forward Rule</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>Cancel</Button>
                </div>
                
                <RadioGroup value={forwardType} onValueChange={(v: string) => setForwardType(v as ForwardType)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="local" id="r-local" />
                        <Label htmlFor="r-local">Local (L)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="remote" id="r-remote" />
                        <Label htmlFor="r-remote">Remote (R)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dynamic" id="r-dynamic" />
                        <Label htmlFor="r-dynamic">Dynamic (SOCKS5)</Label>
                    </div>
                </RadioGroup>

                <div className="flex items-center gap-4 p-4 bg-zinc-950/50 rounded-sm border border-oxide-border/50">
                    {/* Left Side (Source) */}
                    <div className="flex-1 space-y-2">
                        <Label className="text-xs">{forwardType === 'remote' ? 'Remote (Server)' : 'Local (Client)'}</Label>
                        <div className="flex gap-2">
                             <Input 
                                placeholder="Host" 
                                value={forwardType === 'remote' ? bindAddress : bindAddress}
                                onChange={(e) => setBindAddress(e.target.value)}
                                className="font-mono"
                             />
                             <Input 
                                placeholder="Port" 
                                value={bindPort}
                                onChange={(e) => setBindPort(e.target.value)}
                                className="w-24 font-mono"
                             />
                        </div>
                    </div>

                    {/* Arrow */}
                    <div className="pt-6 text-zinc-500">
                        {forwardType === 'remote' ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                    </div>

                    {/* Right Side (Target) */}
                    {forwardType === 'dynamic' ? (
                        <div className="flex-1 pt-6 text-sm text-zinc-500 italic text-center">
                            SOCKS5 Proxy Mode
                        </div>
                    ) : (
                        <div className="flex-1 space-y-2">
                            <Label className="text-xs">{forwardType === 'remote' ? 'Local (Client)' : 'Remote (Server)'}</Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Host" 
                                    value={targetHost}
                                    onChange={(e) => setTargetHost(e.target.value)}
                                    className="font-mono"
                                />
                                <Input 
                                    placeholder="Port" 
                                    value={targetPort}
                                    onChange={(e) => setTargetPort(e.target.value)}
                                    className="w-24 font-mono"
                                />
                            </div>
                        </div>
                    )}
                </div>
                
                {createError && (
                    <div className="text-red-400 text-xs px-2">{createError}</div>
                )}

                <div className="flex justify-end">
                    <Button onClick={handleCreateForward}>Create Forward</Button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};