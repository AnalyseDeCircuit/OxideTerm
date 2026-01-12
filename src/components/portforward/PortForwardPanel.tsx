/**
 * PortForwardPanel Component (Refactored)
 * 
 * Port forwarding management integrated into the bottom panel.
 * Supports local, remote, and dynamic forwards.
 */

import * as React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/Tooltip';

// Types
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

// Quick forward presets
const QUICK_FORWARDS = [
  { name: 'Jupyter', localPort: 8888, remotePort: 8888, icon: '📓', command: 'forward_jupyter' },
  { name: 'TensorBoard', localPort: 6006, remotePort: 6006, icon: '📊', command: 'forward_tensorboard' },
  { name: 'VS Code Server', localPort: 8080, remotePort: 8080, icon: '💻', command: null },
  { name: 'MLflow', localPort: 5000, remotePort: 5000, icon: '🔬', command: null },
];

interface PortForwardPanelProps {
  sessionId: string | null;
  className?: string;
}

export function PortForwardPanel({ sessionId, className }: PortForwardPanelProps) {
  const [forwards, setForwards] = React.useState<ForwardRule[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  // Load forwards
  const loadForwards = React.useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await invoke<ForwardRule[]>('list_port_forwards', { sessionId });
      setForwards(result);
      setError(null);
    } catch (e) {
      console.error('Failed to load forwards:', e);
      setError('Failed to load port forwards');
    }
  }, [sessionId]);

  React.useEffect(() => {
    loadForwards();
  }, [loadForwards]);

  // Create forward
  const createForward = async (request: CreateForwardRequest) => {
    setIsLoading(true);
    try {
      const response = await invoke<ForwardResponse>('create_port_forward', { request });
      if (response.success && response.forward) {
        setForwards((prev) => [...prev, response.forward!]);
        setError(null);
        setShowAddForm(false);
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

  // Stop forward
  const stopForward = async (forwardId: string) => {
    if (!sessionId) return;
    try {
      await invoke<ForwardResponse>('stop_port_forward', { sessionId, forwardId });
      setForwards((prev) => prev.filter((f) => f.id !== forwardId));
      setError(null);
    } catch (e) {
      console.error('Failed to stop forward:', e);
      setError('Failed to stop port forward');
    }
  };

  // Quick forward
  const handleQuickForward = async (preset: typeof QUICK_FORWARDS[0]) => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      if (preset.command) {
        const response = await invoke<ForwardResponse>(preset.command, { sessionId });
        if (response.success && response.forward) {
          setForwards((prev) => [...prev, response.forward!]);
        } else {
          setError(response.error || 'Failed to create forward');
        }
      } else {
        await createForward({
          session_id: sessionId,
          forward_type: 'local',
          bind_address: '127.0.0.1',
          bind_port: preset.localPort,
          target_host: 'localhost',
          target_port: preset.remotePort,
          description: preset.name,
        });
      }
    } catch (e) {
      console.error('Quick forward failed:', e);
      setError('Failed to create quick forward');
    } finally {
      setIsLoading(false);
    }
  };

  // No session
  if (!sessionId) {
    return (
      <div className={cn('flex items-center justify-center h-full text-overlay-1', className)}>
        <p className="text-sm">Connect to a session to manage port forwards</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex flex-col h-full', className)}>
        {/* Header Actions */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-overlay-1">
              {forwards.length} active forward{forwards.length !== 1 && 's'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={loadForwards}
              disabled={isLoading}
            >
              <Loader2 size={12} className={isLoading ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={12} />
              Add Forward
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-md bg-red/10 border border-red/20 text-xs text-red flex items-center gap-2">
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Quick Forwards */}
            <div>
              <h4 className="text-xs font-medium text-overlay-1 uppercase tracking-wider mb-2">
                Quick Forward
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_FORWARDS.map((preset) => (
                  <Tooltip key={preset.name}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleQuickForward(preset)}
                        disabled={isLoading}
                        className="flex-col h-auto py-2 gap-1"
                      >
                        <span className="text-lg">{preset.icon}</span>
                        <span className="text-[10px]">{preset.name}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Forward localhost:{preset.localPort} → remote:{preset.remotePort}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Active Forwards */}
            {forwards.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-overlay-1 uppercase tracking-wider mb-2">
                  Active Forwards
                </h4>
                <div className="space-y-2">
                  {forwards.map((forward) => (
                    <ForwardRuleItem
                      key={forward.id}
                      forward={forward}
                      onStop={() => stopForward(forward.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Add Form */}
            <AnimatePresence>
              {showAddForm && (
                <AddForwardForm
                  sessionId={sessionId}
                  onSubmit={createForward}
                  onCancel={() => setShowAddForm(false)}
                  isLoading={isLoading}
                />
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

// ============================================
// Forward Rule Item
// ============================================

interface ForwardRuleItemProps {
  forward: ForwardRule;
  onStop: () => void;
}

function ForwardRuleItem({ forward, onStop }: ForwardRuleItemProps) {
  const typeIcons = {
    local: <ArrowRight size={12} />,
    remote: <ArrowLeft size={12} />,
    dynamic: <Globe size={12} />,
  };

  const statusColors = {
    starting: 'bg-yellow text-yellow',
    active: 'bg-green text-green',
    stopped: 'bg-overlay-0 text-overlay-0',
    error: 'bg-red text-red',
  };

  const openInBrowser = () => {
    const url = `http://${forward.bind_address}:${forward.bind_port}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-surface-0/50 group">
      {/* Type Icon */}
      <div className="shrink-0 text-overlay-1">{typeIcons[forward.forward_type]}</div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-text truncate">
            {forward.bind_address}:{forward.bind_port}
          </span>
          <ArrowLeftRight size={10} className="text-overlay-0 shrink-0" />
          <span className="text-sm font-mono text-overlay-1 truncate">
            {forward.target_host}:{forward.target_port}
          </span>
        </div>
        {forward.description && (
          <span className="text-xs text-overlay-1">{forward.description}</span>
        )}
      </div>

      {/* Status */}
      <Badge
        variant="secondary"
        size="sm"
        className={cn('shrink-0', statusColors[forward.status])}
      >
        {forward.status}
      </Badge>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {forward.forward_type === 'local' && forward.status === 'active' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={openInBrowser}>
                <ExternalLink size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in browser</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onStop}>
              <Trash2 size={12} className="text-red" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop forward</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ============================================
// Add Forward Form
// ============================================

interface AddForwardFormProps {
  sessionId: string;
  onSubmit: (request: CreateForwardRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function AddForwardForm({ sessionId, onSubmit, onCancel, isLoading }: AddForwardFormProps) {
  const [forwardType, setForwardType] = React.useState<'local' | 'remote'>('local');
  const [bindAddress, setBindAddress] = React.useState('127.0.0.1');
  const [bindPort, setBindPort] = React.useState('');
  const [targetHost, setTargetHost] = React.useState('localhost');
  const [targetPort, setTargetPort] = React.useState('');
  const [description, setDescription] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      session_id: sessionId,
      forward_type: forwardType,
      bind_address: bindAddress,
      bind_port: parseInt(bindPort, 10),
      target_host: targetHost,
      target_port: parseInt(targetPort, 10),
      description: description || undefined,
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="space-y-3 p-3 rounded-lg border border-surface-1 bg-surface-0/30"
    >
      <h4 className="text-sm font-medium text-text">New Port Forward</h4>

      {/* Forward Type */}
      <Tabs value={forwardType} onValueChange={(v) => setForwardType(v as 'local' | 'remote')}>
        <TabsList className="w-full">
          <TabsTrigger value="local" className="flex-1 gap-1">
            <ArrowRight size={12} />
            Local
          </TabsTrigger>
          <TabsTrigger value="remote" className="flex-1 gap-1">
            <ArrowLeft size={12} />
            Remote
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Ports */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Bind Address</Label>
          <Input
            value={bindAddress}
            onChange={(e) => setBindAddress(e.target.value)}
            placeholder="127.0.0.1"
            className="font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Bind Port</Label>
          <Input
            type="number"
            value={bindPort}
            onChange={(e) => setBindPort(e.target.value)}
            placeholder="8888"
            className="font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Target Host</Label>
          <Input
            value={targetHost}
            onChange={(e) => setTargetHost(e.target.value)}
            placeholder="localhost"
            className="font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Target Port</Label>
          <Input
            type="number"
            value={targetPort}
            onChange={(e) => setTargetPort(e.target.value)}
            placeholder="8888"
            className="font-mono text-xs"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <Label className="text-xs">Description (optional)</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Jupyter notebook"
          className="text-xs"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading || !bindPort || !targetPort}>
          {isLoading && <Loader2 size={12} className="animate-spin" />}
          Create
        </Button>
      </div>
    </motion.form>
  );
}
