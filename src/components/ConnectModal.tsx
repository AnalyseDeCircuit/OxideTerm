import { useState } from 'react';
import { useSessionStore } from '../store';
import { ConnectionConfig } from '../types';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectModal({ isOpen, onClose }: ConnectModalProps) {
  const addSession = useSessionStore((state) => state.addSession);
  
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsConnecting(true);

    const config: ConnectionConfig = {
      host,
      port: parseInt(port, 10),
      username,
      password,
    };

    try {
      await addSession(config);
      // Reset form and close modal
      setHost('');
      setPort('22');
      setUsername('');
      setPassword('');
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsConnecting(false);
    }
  };

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

          {/* Password */}
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
              required
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
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
