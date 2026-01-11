// SFTP API wrapper for Tauri commands

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  FileInfo,
  PreviewContent,
  TransferProgress,
  ListFilter,
} from '../types/sftp';

/**
 * Initialize SFTP for a session.
 * Idempotent and reuses the existing SSH connection.
 */
export async function initSftp(sessionId: string): Promise<string> {
  return invoke<string>('sftp_init', { sessionId });
}

/**
 * Check if SFTP is initialized for a session
 */
export async function isSftpInitialized(sessionId: string): Promise<boolean> {
  return invoke<boolean>('sftp_is_initialized', { sessionId });
}

/**
 * Close SFTP session
 */
export async function closeSftp(sessionId: string): Promise<void> {
  return invoke<void>('sftp_close', { sessionId });
}

/**
 * Get current working directory
 */
export async function pwd(sessionId: string): Promise<string> {
  return invoke<string>('sftp_pwd', { sessionId });
}

/**
 * Change current working directory
 */
export async function cd(sessionId: string, path: string): Promise<string> {
  return invoke<string>('sftp_cd', { sessionId, path });
}

/**
 * List directory contents
 */
export async function listDir(
  sessionId: string,
  path: string,
  filter?: ListFilter
): Promise<FileInfo[]> {
  return invoke<FileInfo[]>('sftp_list_dir', { sessionId, path, filter });
}

/**
 * Get file/directory information
 */
export async function stat(sessionId: string, path: string): Promise<FileInfo> {
  return invoke<FileInfo>('sftp_stat', { sessionId, path });
}

/**
 * Preview file content
 */
export async function preview(
  sessionId: string,
  path: string
): Promise<PreviewContent> {
  return invoke<PreviewContent>('sftp_preview', { sessionId, path });
}

/**
 * Download file from remote to local
 */
export async function download(
  sessionId: string,
  remotePath: string,
  localPath: string
): Promise<void> {
  return invoke<void>('sftp_download', {
    sessionId,
    remotePath,
    localPath,
  });
}

/**
 * Upload file from local to remote
 */
export async function upload(
  sessionId: string,
  localPath: string,
  remotePath: string
): Promise<void> {
  return invoke<void>('sftp_upload', {
    sessionId,
    localPath,
    remotePath,
  });
}

/**
 * Delete file or directory
 */
export async function deleteFile(
  sessionId: string,
  path: string
): Promise<void> {
  return invoke<void>('sftp_delete', { sessionId, path });
}

/**
 * Create directory
 */
export async function mkdir(sessionId: string, path: string): Promise<void> {
  return invoke<void>('sftp_mkdir', { sessionId, path });
}

/**
 * Rename/move file or directory
 */
export async function rename(
  sessionId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  return invoke<void>('sftp_rename', { sessionId, oldPath, newPath });
}

/**
 * Listen for transfer progress updates
 */
export function onTransferProgress(
  sessionId: string,
  callback: (progress: TransferProgress) => void
): Promise<UnlistenFn> {
  return listen<TransferProgress>(
    `sftp:progress:${sessionId}`,
    (event) => callback(event.payload)
  );
}

// Export all as namespace
export const sftpApi = {
  initSftp,
  isSftpInitialized,
  closeSftp,
  pwd,
  cd,
  listDir,
  stat,
  preview,
  download,
  upload,
  deleteFile,
  mkdir,
  rename,
  onTransferProgress,
};
