import { useState, useEffect } from 'react';
import { useSessionStore } from '../store';
import type { ConnectRequest } from '../types';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fill form with saved connection data */
  prefill?: {
    host: string;
    port: number;
    username: string;
    authType: 'password' | 'key';
    password?: string;
    keyPath?: string;
  };
}

export function ConnectModal({ isOpen, onClose, prefill }: ConnectModalProps) {
  const connect = useSessionStore((state) => state.connect);
  const isConnecting = useSessionStore((state) => state.isConnecting);
  const connectionError = useSessionStore((state) => state.connectionError);
  
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key'>('key');
  const [keyPath, setKeyPath] = useState('~/.ssh/id_rsa');
  const [error, setError] = useState<string | null>(null);

  // Apply prefill data when modal opens
  useEffect(() => {
    if (isOpen && prefill) {
      setHost(prefill.host);
      setPort(String(prefill.port));
      setUsername(prefill.username);
      setAuthType(prefill.authType);
      setPassword(prefill.password || '');
      setKeyPath(prefill.keyPath || '~/.ssh/id_rsa');
    }
  }, [isOpen, prefill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const request: ConnectRequest = {
      host,
      port: parseInt(port, 10),
      username,
      auth_type: authType,
      password: authType === 'password' ? password : undefined,
      key_path: authType === 'key' ? keyPath : undefined,
      cols: 120,
      rows: 30,
    };

    try {
      await connect(request);
      resetForm();
      onClose();
    } catch (err) {
      setError(String(err));
    }
  };

  const resetForm = () => {
    setHost('');
    setPort('22');
    setUsername('');
    setPassword('');
    setAuthType('key');
    setKeyPath('~/.ssh/id_rsa');
  };

  const displayError = error || connectionError;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">
          🔗 New SSH Connection
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Host */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Host
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com or 192.168.1.1"
              className="input-field"
              required
              autoFocus
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Port
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="22"
              className="input-field"
              min="1"
              max="65535"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="input-field"
              required
            />
          </div>

          {/* Auth Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Authentication
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors
                  ${authType === 'key'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
              >
                🔐 SSH Key
              </button>
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors
                  ${authType === 'password'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
              >
                🔑 Password
              </button>
            </div>
          </div>

          {/* Password field (for password auth) */}
          {authType === 'password' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                required={authType === 'password'}
              />
            </div>
          )}

          {/* Key path field (for key auth) */}
          {authType === 'key' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Private Key Path
              </label>
              <input
                type="text"
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                placeholder="~/.ssh/id_rsa"
                className="input-field"
                required={authType === 'key'}
              />
              <p className="text-xs text-gray-500 mt-1">
                Supports RSA, Ed25519, and ECDSA keys
              </p>
            </div>
          )}

          {/* Error message */}
          {displayError && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {displayError}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isConnecting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Connecting...
                </span>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
