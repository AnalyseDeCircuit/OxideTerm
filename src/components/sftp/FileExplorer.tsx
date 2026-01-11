import { useState, useCallback, useEffect } from 'react';
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  ArrowUpIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  HomeIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useSftpStore } from '../../stores/sftpStore';
import { formatFileSize, formatDate, isPreviewable } from '../../types/sftp';
import type { FileInfo, FileType } from '../../types/sftp';
import { open } from '@tauri-apps/plugin-dialog';
import { downloadDir } from '@tauri-apps/api/path';

interface FileExplorerProps {
  sessionId: string;
}

export function FileExplorer({ sessionId }: FileExplorerProps) {
  const {
    sessions,
    initSession,
    navigateTo,
    refresh,
    goUp,
    selectFile,
    toggleSelection,
    clearSelection,
    selectAll,
    createDirectory,
    deleteSelected,
    renameFile,
    downloadFile,
    uploadFile,
    openPreview,
  } = useSftpStore();

  const state = sessions.get(sessionId);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileInfo;
  } | null>(null);

  // Initialize SFTP session
  useEffect(() => {
    if (!state?.initialized && !state?.loading) {
      initSession(sessionId).catch(console.error);
    }
  }, [sessionId, state?.initialized, state?.loading, initSession]);

  const handleFileDoubleClick = useCallback(
    async (file: FileInfo) => {
      if (file.file_type === 'Directory') {
        await navigateTo(sessionId, file.path);
      } else if (isPreviewable(file)) {
        await openPreview(sessionId, file.path);
      }
    },
    [sessionId, navigateTo, openPreview]
  );

  const handleFileClick = useCallback(
    (file: FileInfo, event: React.MouseEvent) => {
      if (event.ctrlKey || event.metaKey) {
        toggleSelection(sessionId, file.path);
      } else if (event.shiftKey) {
        // TODO: Range selection
        selectFile(sessionId, file.path);
      } else {
        clearSelection(sessionId);
        selectFile(sessionId, file.path);
      }
    },
    [sessionId, toggleSelection, selectFile, clearSelection]
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, file: FileInfo) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, file });
    },
    []
  );

  const handleDownload = useCallback(async () => {
    if (!state) return;

    const selectedPaths = Array.from(state.selectedFiles);
    if (selectedPaths.length === 0) return;

    try {
      const defaultPath = await downloadDir();
      const savePath = await open({
        directory: true,
        defaultPath,
        title: 'Select download destination',
      });

      if (savePath) {
        for (const remotePath of selectedPaths) {
          const fileName = remotePath.split('/').pop() || 'file';
          const localPath = `${savePath}/${fileName}`;
          await downloadFile(sessionId, remotePath, localPath);
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
    setContextMenu(null);
  }, [sessionId, state, downloadFile]);

  const handleUpload = useCallback(async () => {
    if (!state) return;

    try {
      const selected = await open({
        multiple: true,
        title: 'Select files to upload',
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        for (const localPath of paths) {
          const fileName = localPath.split('/').pop() || 'file';
          const remotePath =
            state.cwd === '/' ? `/${fileName}` : `${state.cwd}/${fileName}`;
          await uploadFile(sessionId, localPath, remotePath);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }, [sessionId, state, uploadFile]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;

    try {
      await createDirectory(sessionId, newFolderName.trim());
      setNewFolderName('');
      setShowNewFolderDialog(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  }, [sessionId, newFolderName, createDirectory]);

  const handleDelete = useCallback(async () => {
    if (!state || state.selectedFiles.size === 0) return;

    const confirmed = window.confirm(
      `Delete ${state.selectedFiles.size} item(s)?`
    );
    if (confirmed) {
      try {
        await deleteSelected(sessionId);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
    setContextMenu(null);
  }, [sessionId, state, deleteSelected]);

  const handleRenameStart = useCallback((file: FileInfo) => {
    setRenamingPath(file.path);
    setRenameValue(file.name);
    setContextMenu(null);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingPath || !renameValue.trim() || !state) return;

    const oldName = renamingPath.split('/').pop();
    if (oldName === renameValue.trim()) {
      setRenamingPath(null);
      return;
    }

    const parentDir = renamingPath.substring(
      0,
      renamingPath.lastIndexOf('/')
    );
    const newPath = parentDir
      ? `${parentDir}/${renameValue.trim()}`
      : renameValue.trim();

    try {
      await renameFile(sessionId, renamingPath, newPath);
    } catch (error) {
      console.error('Rename failed:', error);
    }
    setRenamingPath(null);
    setRenameValue('');
  }, [sessionId, renamingPath, renameValue, state, renameFile]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        selectAll(sessionId);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        handleDelete();
      } else if (event.key === 'Escape') {
        clearSelection(sessionId);
        setContextMenu(null);
        setRenamingPath(null);
      }
    },
    [sessionId, selectAll, handleDelete, clearSelection]
  );

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Initializing SFTP...
      </div>
    );
  }

  if (state.loading && !state.initialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-400">Connecting...</span>
      </div>
    );
  }

  if (state.error && !state.initialized) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-400">
        <ExclamationCircleIcon className="w-8 h-8 mb-2" />
        <span>SFTP Error: {state.error}</span>
        <button
          onClick={() => initSession(sessionId)}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-gray-900 text-gray-200"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800">
        <button
          onClick={() => navigateTo(sessionId, '~')}
          className="p-1.5 hover:bg-gray-700 rounded"
          title="Home"
        >
          <HomeIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => goUp(sessionId)}
          className="p-1.5 hover:bg-gray-700 rounded"
          title="Go up"
        >
          <ArrowUpIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => refresh(sessionId)}
          className={`p-1.5 hover:bg-gray-700 rounded ${
            state.loading ? 'animate-spin' : ''
          }`}
          title="Refresh"
          disabled={state.loading}
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 px-2 py-1 bg-gray-700 rounded text-sm font-mono truncate">
          {state.cwd}
        </div>

        <button
          onClick={() => setShowNewFolderDialog(true)}
          className="p-1.5 hover:bg-gray-700 rounded"
          title="New folder"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
        <button
          onClick={handleUpload}
          className="p-1.5 hover:bg-gray-700 rounded"
          title="Upload"
        >
          <ArrowUpTrayIcon className="w-5 h-5" />
        </button>
        <button
          onClick={handleDownload}
          className="p-1.5 hover:bg-gray-700 rounded disabled:opacity-50"
          title="Download"
          disabled={state.selectedFiles.size === 0}
        >
          <ArrowDownTrayIcon className="w-5 h-5" />
        </button>
        <button
          onClick={handleDelete}
          className="p-1.5 hover:bg-gray-700 rounded text-red-400 disabled:opacity-50"
          title="Delete"
          disabled={state.selectedFiles.size === 0}
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      {/* New folder dialog */}
      {showNewFolderDialog && (
        <div className="p-2 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
          <FolderIcon className="w-5 h-5 text-yellow-500" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') {
                setShowNewFolderDialog(false);
                setNewFolderName('');
              }
            }}
            placeholder="New folder name"
            className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={handleCreateFolder}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Create
          </button>
          <button
            onClick={() => {
              setShowNewFolderDialog(false);
              setNewFolderName('');
            }}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error banner */}
      {state.error && state.initialized && (
        <div className="px-3 py-2 bg-red-900/50 text-red-300 text-sm flex items-center gap-2">
          <ExclamationCircleIcon className="w-4 h-4" />
          {state.error}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {state.files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Empty directory
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="text-left text-gray-400">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium w-24">Size</th>
                <th className="px-3 py-2 font-medium w-40">Modified</th>
                <th className="px-3 py-2 font-medium w-24">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {state.files.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  isSelected={state.selectedFiles.has(file.path)}
                  isRenaming={renamingPath === file.path}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={() => {
                    setRenamingPath(null);
                    setRenameValue('');
                  }}
                  onClick={handleFileClick}
                  onDoubleClick={handleFileDoubleClick}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onOpen={() => {
            handleFileDoubleClick(contextMenu.file);
            setContextMenu(null);
          }}
          onDownload={handleDownload}
          onRename={() => handleRenameStart(contextMenu.file)}
          onDelete={handleDelete}
          onPreview={() => {
            openPreview(sessionId, contextMenu.file.path);
            setContextMenu(null);
          }}
        />
      )}

      {/* Status bar */}
      <div className="px-3 py-1 border-t border-gray-700 bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>
          {state.files.length} item{state.files.length !== 1 ? 's' : ''}
        </span>
        {state.selectedFiles.size > 0 && (
          <span>{state.selectedFiles.size} selected</span>
        )}
      </div>
    </div>
  );
}

// File row component
interface FileRowProps {
  file: FileInfo;
  isSelected: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onClick: (file: FileInfo, event: React.MouseEvent) => void;
  onDoubleClick: (file: FileInfo) => void;
  onContextMenu: (event: React.MouseEvent, file: FileInfo) => void;
}

function FileRow({
  file,
  isSelected,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileRowProps) {
  const FileTypeIcon = getFileTypeIcon(file.file_type);

  return (
    <tr
      className={`cursor-pointer hover:bg-gray-700/50 ${
        isSelected ? 'bg-blue-900/50' : ''
      }`}
      onClick={(e) => onClick(file, e)}
      onDoubleClick={() => onDoubleClick(file)}
      onContextMenu={(e) => onContextMenu(e, file)}
    >
      <td className="px-3 py-1.5 flex items-center gap-2">
        <FileTypeIcon
          className={`w-4 h-4 flex-shrink-0 ${
            file.file_type === 'Directory' ? 'text-yellow-500' : 'text-gray-400'
          }`}
        />
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit();
              if (e.key === 'Escape') onRenameCancel();
              e.stopPropagation();
            }}
            onBlur={onRenameSubmit}
            className="flex-1 px-1 bg-gray-700 border border-blue-500 rounded text-sm focus:outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate">{file.name}</span>
        )}
        {file.is_symlink && (
          <span className="text-xs text-gray-500">→</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-gray-400">
        {file.file_type !== 'Directory' ? formatFileSize(file.size) : '-'}
      </td>
      <td className="px-3 py-1.5 text-gray-400">
        {file.modified ? formatDate(file.modified) : '-'}
      </td>
      <td className="px-3 py-1.5 text-gray-400 font-mono text-xs">
        {file.permissions || '-'}
      </td>
    </tr>
  );
}

function getFileTypeIcon(fileType: FileType) {
  switch (fileType) {
    case 'Directory':
      return FolderIcon;
    default:
      return DocumentIcon;
  }
}

// Context menu component
interface ContextMenuProps {
  x: number;
  y: number;
  file: FileInfo;
  onOpen: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onPreview: () => void;
}

function ContextMenu({
  x,
  y,
  file,
  onOpen,
  onDownload,
  onRename,
  onDelete,
  onPreview,
}: ContextMenuProps) {
  const isDir = file.file_type === 'Directory';
  const canPreview = isPreviewable(file);

  return (
    <div
      className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg py-1 min-w-[160px] z-50"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onOpen}
        className="w-full px-4 py-1.5 text-left hover:bg-gray-700 flex items-center gap-2"
      >
        {isDir ? (
          <FolderOpenIcon className="w-4 h-4" />
        ) : (
          <DocumentIcon className="w-4 h-4" />
        )}
        {isDir ? 'Open' : 'Open'}
      </button>

      {canPreview && !isDir && (
        <button
          onClick={onPreview}
          className="w-full px-4 py-1.5 text-left hover:bg-gray-700 flex items-center gap-2"
        >
          <EyeIcon className="w-4 h-4" />
          Preview
        </button>
      )}

      <div className="border-t border-gray-700 my-1" />

      {!isDir && (
        <button
          onClick={onDownload}
          className="w-full px-4 py-1.5 text-left hover:bg-gray-700 flex items-center gap-2"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Download
        </button>
      )}

      <button
        onClick={onRename}
        className="w-full px-4 py-1.5 text-left hover:bg-gray-700 flex items-center gap-2"
      >
        <DocumentIcon className="w-4 h-4" />
        Rename
      </button>

      <div className="border-t border-gray-700 my-1" />

      <button
        onClick={onDelete}
        className="w-full px-4 py-1.5 text-left hover:bg-gray-700 text-red-400 flex items-center gap-2"
      >
        <TrashIcon className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
}
