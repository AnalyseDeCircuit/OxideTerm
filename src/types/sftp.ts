// SFTP Types for TypeScript
// Must match Rust types in src-tauri/src/sftp/types.rs

export type FileType = 'File' | 'Directory' | 'Symlink' | 'Unknown';

export interface FileInfo {
  name: string;
  path: string;
  file_type: FileType;
  size: number;
  modified: number | null; // Unix timestamp, nullable
  permissions: string | null;
  owner: string | null;
  group: string | null;
  is_symlink: boolean;
  symlink_target: string | null;
}

// Rust enum serializes as object with variant name as key
export type PreviewContent =
  | { Text: { data: string; mime_type: string | null } }
  | { Base64: { data: string; mime_type: string | null } }
  | { TooLarge: { size: number; max_size: number } }
  | { Unsupported: { mime_type: string | null } };

export type TransferDirection = 'upload' | 'download';

// Match Rust TransferState enum
export type TransferState =
  | 'Pending'
  | 'InProgress'
  | 'Paused'
  | 'Completed'
  | 'Cancelled'
  | { Failed: string };

export interface TransferProgress {
  transferred: number;
  total: number;
  percentage: number;
  state: TransferState;
}

// Sort order configuration
export interface SortOrder {
  field: 'name' | 'size' | 'modified' | 'type';
  ascending: boolean;
}

export interface ListFilter {
  show_hidden?: boolean;
  pattern?: string;
}

// Tree node for file explorer
export interface FileTreeNode {
  file: FileInfo;
  children: FileTreeNode[];
  isExpanded: boolean;
  isLoading?: boolean;
}

// Helper functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(timestamp: number): string {
  if (timestamp === 0) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileIcon(file: FileInfo): string {
  if (file.file_type === 'Directory') return '📁';
  if (file.is_symlink) return '🔗';
  
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    // Code
    py: '🐍',
    js: '📜',
    ts: '📘',
    jsx: '⚛️',
    tsx: '⚛️',
    rs: '🦀',
    go: '🐹',
    java: '☕',
    cpp: '⚙️',
    c: '⚙️',
    h: '⚙️',
    
    // Data
    json: '📋',
    yaml: '📋',
    yml: '📋',
    toml: '📋',
    xml: '📋',
    csv: '📊',
    
    // Documents
    md: '📝',
    txt: '📄',
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    
    // Images
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    webp: '🖼️',
    
    // Archives
    zip: '📦',
    tar: '📦',
    gz: '📦',
    rar: '📦',
    '7z': '📦',
    
    // Shell
    sh: '⚡',
    bash: '⚡',
    zsh: '⚡',
    
    // Config
    conf: '⚙️',
    cfg: '⚙️',
    ini: '⚙️',
    env: '⚙️',
  };
  
  return iconMap[ext] || '📄';
}

export function isPreviewable(file: FileInfo): boolean {
  if (file.file_type !== 'File') return false;
  
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const previewableExts = [
    // Text
    'txt', 'md', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv',
    'py', 'js', 'ts', 'jsx', 'tsx', 'rs', 'go', 'java', 'cpp', 'c', 'h',
    'sh', 'bash', 'zsh', 'conf', 'cfg', 'ini', 'env', 'log',
    'html', 'css', 'scss', 'less',
    // Images
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico',
  ];
  
  return previewableExts.includes(ext);
}
