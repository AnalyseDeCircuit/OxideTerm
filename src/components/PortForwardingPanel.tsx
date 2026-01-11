/**
 * Port Forwarding Panel Component
 * 
 * Provides UI for managing SSH port forwards (local, remote, dynamic).
 * Designed for HPC workflows - quick access to Jupyter, TensorBoard, etc.
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  ArrowLeftRight, 
  Plus, 
  Trash2, 
  Play, 
  Square,
  Globe,
  Server,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

interface ForwardRule {
  id: string;
  forward_type: 'local' | 'remote' | 'dynamic';
  bind_address: string;
  bind_port: number;
  target_host: string;
  target_port: number;
  status: 'starting' | 'active' | 'stopped' | 'error';
  description: string | null;
}

interface CreateForwardRequest {
  session_id: string;
  forward_type: string;
  bind_address: string;
  bind_port: number;
  target_host: string;
  target_port: number;
  description?: string;
}

interface ForwardResponse {
  success: boolean;
  forward?: ForwardRule;
  error?: string;
}

interface PortForwardingPanelProps {
  sessionId: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

// Quick forward presets for HPC
const QUICK_FORWARDS = [
  { name: 'Jupyter', localPort: 8888, remotePort: 8888, icon: '📓' },
  { name: 'TensorBoard', localPort: 6006, remotePort: 6006, icon: '📊' },
  { name: 'VS Code', localPort: 8080, remotePort: 8080, icon: '💻' },
  { name: 'MLflow', localPort: 5000, remotePort: 5000, icon: '🔬' },
];

export function PortForwardingPanel({ 
  sessionId, 
  isExpanded = false, 
  onToggle 
}: PortForwardingPanelProps) {
  const [forwards, setForwards] = useState<ForwardRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state for new forward
  const [newForward, setNewForward] = useState({
    forwardType: 'local' as 'local' | 'remote',
    bindAddress: '127.0.0.1',
    bindPort: '',
    targetHost: 'localhost',
    targetPort: '',
    description: '',
  });

  // Load forwards on mount and when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadForwards();
    }
  }, [sessionId]);

  const loadForwards = async () => {
    try {
      const result = await invoke<ForwardRule[]>('list_port_forwards', {
        sessionId,
      });
      setForwards(result);
      setError(null);
    } catch (e) {
      console.error('Failed to load forwards:', e);
      setError('Failed to load port forwards');
    }
  };

  const createForward = async (request: CreateForwardRequest) => {
    setIsLoading(true);
    try {
      const response = await invoke<ForwardResponse>('create_port_forward', {
        request,
      });
      
      if (response.success && response.forward) {
        setForwards(prev => [...prev, response.forward!]);
        setError(null);
        setShowAddForm(false);
        resetForm();
      } else {
        setError(response.error || 'Failed to create forward');
      }
    } catch (e) {
      console.error('Failed to create forward:', e);
      setError('Failed to create port forward');
    } finally {
      setIsLoading(false);
    }
  };

  const stopForward = async (forwardId: string) => {
    try {
      await invoke<ForwardResponse>('stop_port_forward', {
        sessionId,
        forwardId,
      });
      setForwards(prev => prev.filter(f => f.id !== forwardId));
      setError(null);
    } catch (e) {
      console.error('Failed to stop forward:', e);
      setError('Failed to stop port forward');
    }
  };

  const quickForward = async (name: string, localPort: number, remotePort: number) => {
    const commandName = name === 'Jupyter' ? 'forward_jupyter' : 
                        name === 'TensorBoard' ? 'forward_tensorboard' : null;
    
    if (commandName) {
      setIsLoading(true);
      try {
        const response = await invoke<ForwardResponse>(commandName, {
          sessionId,
          localPort,
          remotePort,
        });
        
        if (response.success && response.forward) {
          setForwards(prev => [...prev, response.forward!]);
          setError(null);
        } else {
          setError(response.error || `Failed to create ${name} forward`);
        }
      } catch (e) {
        console.error(`Failed to create ${name} forward:`, e);
        setError(`Failed to create ${name} forward`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Use generic forward for other presets
      await createForward({
        session_id: sessionId,
        forward_type: 'local',
        bind_address: '127.0.0.1',
        bind_port: localPort,
        target_host: 'localhost',
        target_port: remotePort,
        description: name,
      });
    }
  };

  const resetForm = () => {
    setNewForward({
      forwardType: 'local',
      bindAddress: '127.0.0.1',
      bindPort: '',
      targetHost: 'localhost',
      targetPort: '',
      description: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createForward({
      session_id: sessionId,
      forward_type: newForward.forwardType,
      bind_address: newForward.bindAddress,
      bind_port: parseInt(newForward.bindPort) || 0,
      target_host: newForward.targetHost,
      target_port: parseInt(newForward.targetPort) || 0,
      description: newForward.description || undefined,
    });
  };

  const openInBrowser = (port: number) => {
    window.open(`http://localhost:${port}`, '_blank');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play size={12} className="text-green-400" />;
      case 'starting': return <Zap size={12} className="text-yellow-400 animate-pulse" />;
      case 'stopped': return <Square size={12} className="text-zinc-500" />;
      case 'error': return <Square size={12} className="text-red-400" />;
      default: return null;
    }
  };

  return (
    <div className="border-t border-white/[0.04]">
      {/* Header */}
      <button 
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <ArrowLeftRight size={14} />
          <span>Port Forwards</span>
          {forwards.length > 0 && (
            <span className="bg-mauve/20 text-mauve px-1.5 py-0.5 rounded text-xs">
              {forwards.length}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Quick forwards */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_FORWARDS.map(qf => (
              <button
                key={qf.name}
                onClick={() => quickForward(qf.name, qf.localPort, qf.remotePort)}
                disabled={isLoading || forwards.some(f => f.bind_port === qf.localPort)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-white/[0.03] hover:bg-white/[0.06] 
                         border border-white/[0.04] rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title={`Forward port ${qf.localPort}`}
              >
                <span>{qf.icon}</span>
                <span className="text-zinc-300">{qf.name}</span>
              </button>
            ))}
          </div>

          {/* Error display */}
          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">
              {error}
            </div>
          )}

          {/* Active forwards list */}
          {forwards.length > 0 && (
            <div className="space-y-1.5">
              {forwards.map(forward => (
                <div 
                  key={forward.id}
                  className="flex items-center justify-between p-2 bg-white/[0.02] rounded border border-white/[0.04] group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(forward.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-zinc-300 font-mono">
                          {forward.bind_address}:{forward.bind_port}
                        </span>
                        <ArrowLeftRight size={10} className="text-zinc-600" />
                        <span className="text-zinc-400 font-mono">
                          {forward.target_host}:{forward.target_port}
                        </span>
                      </div>
                      {forward.description && (
                        <div className="text-[10px] text-zinc-500 truncate">
                          {forward.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {forward.status === 'active' && (
                      <button
                        onClick={() => openInBrowser(forward.bind_port)}
                        className="p-1 hover:bg-white/[0.06] rounded text-zinc-500 hover:text-zinc-300"
                        title="Open in browser"
                      >
                        <ExternalLink size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => stopForward(forward.id)}
                      className="p-1 hover:bg-red-500/20 rounded text-zinc-500 hover:text-red-400"
                      title="Stop forward"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add custom forward button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-zinc-500 
                       hover:text-zinc-300 hover:bg-white/[0.02] border border-dashed border-white/[0.06] 
                       rounded transition-colors"
            >
              <Plus size={12} />
              <span>Custom Forward</span>
            </button>
          )}

          {/* Add forward form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="space-y-2 p-2 bg-white/[0.02] rounded border border-white/[0.04]">
              {/* Forward type */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewForward(prev => ({ ...prev, forwardType: 'local' }))}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                    newForward.forwardType === 'local' 
                      ? 'bg-mauve/20 text-mauve border border-mauve/30' 
                      : 'bg-white/[0.02] text-zinc-400 border border-white/[0.04] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Server size={10} />
                    <span>Local</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewForward(prev => ({ ...prev, forwardType: 'remote' }))}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                    newForward.forwardType === 'remote' 
                      ? 'bg-mauve/20 text-mauve border border-mauve/30' 
                      : 'bg-white/[0.02] text-zinc-400 border border-white/[0.04] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Globe size={10} />
                    <span>Remote</span>
                  </div>
                </button>
              </div>

              {/* Ports */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-0.5">
                    {newForward.forwardType === 'local' ? 'Local Port' : 'Remote Port'}
                  </label>
                  <input
                    type="number"
                    value={newForward.bindPort}
                    onChange={e => setNewForward(prev => ({ ...prev, bindPort: e.target.value }))}
                    placeholder="8888"
                    className="w-full px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded 
                             text-zinc-200 placeholder-zinc-600 focus:border-mauve/30 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-0.5">
                    {newForward.forwardType === 'local' ? 'Remote Port' : 'Local Port'}
                  </label>
                  <input
                    type="number"
                    value={newForward.targetPort}
                    onChange={e => setNewForward(prev => ({ ...prev, targetPort: e.target.value }))}
                    placeholder="8888"
                    className="w-full px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded 
                             text-zinc-200 placeholder-zinc-600 focus:border-mauve/30 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <input
                type="text"
                value={newForward.description}
                onChange={e => setNewForward(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description (optional)"
                className="w-full px-2 py-1 text-xs bg-black/20 border border-white/[0.06] rounded 
                         text-zinc-200 placeholder-zinc-600 focus:border-mauve/30 focus:outline-none"
              />

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="flex-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 
                           bg-white/[0.02] hover:bg-white/[0.04] rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !newForward.bindPort || !newForward.targetPort}
                  className="flex-1 px-2 py-1 text-xs bg-mauve/20 text-mauve hover:bg-mauve/30 
                           rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default PortForwardingPanel;
