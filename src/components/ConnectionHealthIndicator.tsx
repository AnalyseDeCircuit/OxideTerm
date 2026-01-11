import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

interface HealthStatus {
  session_id: string;
  status: string;
  status_color: string;
  latency_ms: number | null;
  message: string;
  uptime_formatted: string;
}

interface ConnectionHealthIndicatorProps {
  sessionId: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

const statusIcons: Record<string, string> = {
  healthy: '●',
  degraded: '◐',
  unresponsive: '○',
  disconnected: '×',
  unknown: '?',
};

const statusLabels: Record<string, string> = {
  healthy: '连接正常',
  degraded: '连接降级',
  unresponsive: '无响应',
  disconnected: '已断开',
  unknown: '检测中',
};

export function ConnectionHealthIndicator({
  sessionId,
  size = 'md',
  showDetails = true,
  className = '',
}: ConnectionHealthIndicatorProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const status = await invoke<HealthStatus>('get_health_for_display', {
        sessionId,
      });
      setHealth(status);
      setError(null);
    } catch (err) {
      setError(err as string);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchHealth();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  if (error || !health) {
    return (
      <div className={`flex items-center gap-1.5 ${sizeClasses[size]} text-gray-500 ${className}`}>
        <span className={`${dotSizes[size]} rounded-full bg-gray-400`} />
        <span className="text-gray-500">--</span>
      </div>
    );
  }

  const isAnimating = health.status === 'healthy' || health.status === 'unknown';

  return (
    <div 
      className={`relative flex items-center gap-1.5 ${sizeClasses[size]} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status dot */}
      <motion.span
        className={`${dotSizes[size]} rounded-full`}
        style={{ backgroundColor: health.status_color }}
        animate={isAnimating ? {
          scale: [1, 1.2, 1],
          opacity: [1, 0.7, 1],
        } : {}}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Latency or status text */}
      {showDetails && (
        <span 
          className="font-mono"
          style={{ color: health.status_color }}
        >
          {health.latency_ms !== null ? `${health.latency_ms}ms` : statusLabels[health.status]}
        </span>
      )}

      {/* Hover tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute left-0 top-full mt-2 z-50 min-w-48"
          >
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">状态</span>
                  <span style={{ color: health.status_color }}>
                    {statusIcons[health.status]} {statusLabels[health.status]}
                  </span>
                </div>
                {health.latency_ms !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">延迟</span>
                    <span className="text-white font-mono">{health.latency_ms}ms</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">运行时间</span>
                  <span className="text-white font-mono">{health.uptime_formatted}</span>
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <span className="text-gray-500 text-[10px]">{health.message}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AllConnectionsHealthProps {
  className?: string;
}

interface HealthMap {
  [sessionId: string]: {
    session_id: string;
    status: string;
    latency_ms: number | null;
    message: string;
  };
}

export function AllConnectionsHealth({ className = '' }: AllConnectionsHealthProps) {
  const [healthMap, setHealthMap] = useState<HealthMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllHealth = async () => {
      try {
        const status = await invoke<HealthMap>('get_all_health_status');
        setHealthMap(status);
      } catch (err) {
        console.error('Failed to fetch health status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllHealth();
    const interval = setInterval(fetchAllHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const sessions = Object.values(healthMap);
  const healthyCount = sessions.filter(s => s.status === 'healthy').length;
  const degradedCount = sessions.filter(s => s.status === 'degraded').length;
  const unhealthyCount = sessions.filter(s => 
    s.status === 'unresponsive' || s.status === 'disconnected'
  ).length;

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
        <span className="animate-pulse">检查连接状态...</span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
        <span>无活动连接</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 text-xs ${className}`}>
      {healthyCount > 0 && (
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-green-500">{healthyCount}</span>
        </div>
      )}
      {degradedCount > 0 && (
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-amber-500">{degradedCount}</span>
        </div>
      )}
      {unhealthyCount > 0 && (
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-500">{unhealthyCount}</span>
        </div>
      )}
      <span className="text-gray-500">
        / {sessions.length} 连接
      </span>
    </div>
  );
}

// Hook for using health data
export function useConnectionHealth(sessionId: string) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await invoke<HealthStatus>('get_health_for_display', {
        sessionId,
      });
      setHealth(status);
      setError(null);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { health, isLoading, error, refresh };
}

export default ConnectionHealthIndicator;
