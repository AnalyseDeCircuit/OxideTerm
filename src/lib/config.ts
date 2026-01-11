// Connection configuration types for OxideTerm
// Matches the Rust backend types

import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// Types
// =============================================================================

/** Authentication type for saved connections */
export type AuthType = 'password' | 'key' | 'agent';

/** A saved connection (frontend representation, no secrets) */
export interface ConnectionInfo {
  id: string;
  name: string;
  group: string | null;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  keyPath: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  color: string | null;
  tags: string[];
}

/** Request to create/update a connection */
export interface SaveConnectionRequest {
  id?: string; // undefined = create new, string = update
  name: string;
  group: string | null;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string; // Only for password auth
  keyPath?: string; // Only for key auth
  color: string | null;
  tags: string[];
}

/** SSH config host entry */
export interface SshHostInfo {
  alias: string;
  hostname: string;
  user: string | null;
  port: number;
  identityFile: string | null;
}

// =============================================================================
// API Functions
// =============================================================================

/** Get all saved connections */
export async function getConnections(): Promise<ConnectionInfo[]> {
  const connections = await invoke<any[]>('get_connections');
  return connections.map(transformConnection);
}

/** Get recent connections */
export async function getRecentConnections(limit?: number): Promise<ConnectionInfo[]> {
  const connections = await invoke<any[]>('get_recent_connections', { limit });
  return connections.map(transformConnection);
}

/** Get connections by group */
export async function getConnectionsByGroup(group: string | null): Promise<ConnectionInfo[]> {
  const connections = await invoke<any[]>('get_connections_by_group', { group });
  return connections.map(transformConnection);
}

/** Search connections by name or host */
export async function searchConnections(query: string): Promise<ConnectionInfo[]> {
  const connections = await invoke<any[]>('search_connections', { query });
  return connections.map(transformConnection);
}

/** Get all groups */
export async function getGroups(): Promise<string[]> {
  return invoke<string[]>('get_groups');
}

/** Save (create or update) a connection */
export async function saveConnection(request: SaveConnectionRequest): Promise<ConnectionInfo> {
  const result = await invoke<any>('save_connection', { 
    request: transformRequest(request)
  });
  return transformConnection(result);
}

/** Delete a connection */
export async function deleteConnection(id: string): Promise<void> {
  return invoke('delete_connection', { id });
}

/** Mark connection as used */
export async function markConnectionUsed(id: string): Promise<void> {
  return invoke('mark_connection_used', { id });
}

/** Get password for a connection (from keychain) */
export async function getConnectionPassword(id: string): Promise<string> {
  return invoke<string>('get_connection_password', { id });
}

/** List hosts from SSH config file */
export async function listSshConfigHosts(): Promise<SshHostInfo[]> {
  const hosts = await invoke<any[]>('list_ssh_config_hosts');
  return hosts.map(h => ({
    alias: h.alias,
    hostname: h.hostname,
    user: h.user,
    port: h.port,
    identityFile: h.identity_file,
  }));
}

/** Import a host from SSH config as a saved connection */
export async function importSshHost(alias: string): Promise<ConnectionInfo> {
  const result = await invoke<any>('import_ssh_host', { alias });
  return transformConnection(result);
}

/** Get SSH config file path */
export async function getSshConfigPath(): Promise<string> {
  return invoke<string>('get_ssh_config_path');
}

/** Create a new group */
export async function createGroup(name: string): Promise<void> {
  return invoke('create_group', { name });
}

/** Delete a group (connections moved to ungrouped) */
export async function deleteGroup(name: string): Promise<void> {
  return invoke('delete_group', { name });
}

// =============================================================================
// Transform Helpers (snake_case <-> camelCase)
// =============================================================================

function transformConnection(raw: any): ConnectionInfo {
  return {
    id: raw.id,
    name: raw.name,
    group: raw.group,
    host: raw.host,
    port: raw.port,
    username: raw.username,
    authType: raw.auth_type as AuthType,
    keyPath: raw.key_path,
    createdAt: raw.created_at,
    lastUsedAt: raw.last_used_at,
    color: raw.color,
    tags: raw.tags || [],
  };
}

function transformRequest(request: SaveConnectionRequest): any {
  return {
    id: request.id,
    name: request.name,
    group: request.group,
    host: request.host,
    port: request.port,
    username: request.username,
    auth_type: request.authType,
    password: request.password,
    key_path: request.keyPath,
    color: request.color,
    tags: request.tags,
  };
}
