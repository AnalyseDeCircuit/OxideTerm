import { useMemo } from 'react';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useSftpStore } from '../../stores/sftpStore';
import type { TransferProgress } from '../../types/sftp';
import { formatFileSize } from '../../types/sftp';

export function TransferQueue() {
  const { transfers, removeTransfer } = useSftpStore();

  const activeTransfers = useMemo(
    () =>
      transfers.filter(
        (t) =>
          t.progress.state === 'Pending' ||
          t.progress.state === 'InProgress'
      ),
    [transfers]
  );

  const completedTransfers = useMemo(
    () =>
      transfers.filter(
        (t) =>
          t.progress.state === 'Completed' ||
          (typeof t.progress.state === 'object' && 'Failed' in t.progress.state)
      ),
    [transfers]
  );

  if (transfers.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-800 border-t border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">
          Transfers
          {activeTransfers.length > 0 && (
            <span className="ml-2 text-blue-400">
              ({activeTransfers.length} active)
            </span>
          )}
        </span>
        {completedTransfers.length > 0 && (
          <button
            onClick={() => {
              completedTransfers.forEach((t) => removeTransfer(t.id));
            }}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Clear completed
          </button>
        )}
      </div>

      {/* Transfer list */}
      <div className="max-h-48 overflow-auto">
        {transfers.map((transfer) => (
          <TransferItem
            key={transfer.id}
            id={transfer.id}
            direction={transfer.direction}
            remotePath={transfer.remotePath}
            localPath={transfer.localPath}
            progress={transfer.progress}
            onRemove={() => removeTransfer(transfer.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface TransferItemProps {
  id: string;
  direction: 'upload' | 'download';
  remotePath: string;
  localPath: string;
  progress: TransferProgress;
  onRemove: () => void;
}

function TransferItem({
  direction,
  remotePath,
  localPath,
  progress,
  onRemove,
}: TransferItemProps) {
  const fileName = useMemo(() => {
    const path = direction === 'download' ? remotePath : localPath;
    return path.split('/').pop() || path;
  }, [direction, remotePath, localPath]);

  const statusIcon = useMemo(() => {
    const state = progress.state;

    if (state === 'Pending') {
      return <ClockIcon className="w-4 h-4 text-gray-400" />;
    }
    if (state === 'InProgress') {
      return <ArrowPathIcon className="w-4 h-4 text-blue-400 animate-spin" />;
    }
    if (state === 'Completed') {
      return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
    }
    if (typeof state === 'object' && 'Failed' in state) {
      return <ExclamationCircleIcon className="w-4 h-4 text-red-400" />;
    }

    return null;
  }, [progress.state]);

  const errorMessage = useMemo(() => {
    if (typeof progress.state === 'object' && 'Failed' in progress.state) {
      return progress.state.Failed;
    }
    return null;
  }, [progress.state]);

  const isComplete =
    progress.state === 'Completed' ||
    (typeof progress.state === 'object' && 'Failed' in progress.state);

  return (
    <div className="px-3 py-2 hover:bg-gray-700/50 border-b border-gray-700/50 last:border-b-0">
      <div className="flex items-center gap-2">
        {/* Direction icon */}
        {direction === 'download' ? (
          <ArrowDownTrayIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
        ) : (
          <ArrowUpTrayIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
        )}

        {/* File name */}
        <span className="flex-1 text-sm truncate" title={remotePath}>
          {fileName}
        </span>

        {/* Progress or status */}
        {progress.state === 'InProgress' && progress.total > 0 ? (
          <span className="text-xs text-gray-400 flex-shrink-0">
            {formatFileSize(progress.transferred)} / {formatFileSize(progress.total)}
          </span>
        ) : (
          statusIcon
        )}

        {/* Remove button */}
        {isComplete && (
          <button
            onClick={onRemove}
            className="p-0.5 hover:bg-gray-600 rounded"
            title="Remove"
          >
            <XMarkIcon className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {(progress.state === 'InProgress' || progress.state === 'Pending') && (
        <div className="mt-1.5 h-1 bg-gray-700 rounded overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              progress.state === 'Pending' ? 'bg-gray-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <p className="mt-1 text-xs text-red-400 truncate" title={errorMessage}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}

// Mini version for sidebar
export function TransferBadge() {
  const { transfers } = useSftpStore();

  const activeCount = useMemo(
    () =>
      transfers.filter(
        (t) =>
          t.progress.state === 'Pending' ||
          t.progress.state === 'InProgress'
      ).length,
    [transfers]
  );

  if (activeCount === 0) {
    return null;
  }

  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-medium bg-blue-500 text-white rounded-full">
      {activeCount}
    </span>
  );
}
