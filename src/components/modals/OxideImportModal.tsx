import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useAppStore } from '../../store/appStore';
import type { OxideMetadata, ImportResult } from '../../types';

interface OxideImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OxideImportModal({ isOpen, onClose }: OxideImportModalProps) {
  const { loadSavedConnections } = useAppStore();
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [metadata, setMetadata] = useState<OxideMetadata | null>(null);
  const [password, setPassword] = useState('');
  const [restoreBuffers, setRestoreBuffers] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  // ... (handlers unchanged)

  const handleSelectFile = async () => {
    setError(null);
    setResult(null);

    try {
      const selected = await open({
        filters: [{ name: 'Oxide Config', extensions: ['oxide'] }],
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        const filePath = selected;
        const data = await readFile(filePath);
        setFileData(data);

        // Validate file and extract metadata (no password needed)
        try {
          const meta: OxideMetadata = await invoke('validate_oxide_file', {
            fileData: Array.from(data),
          });
          setMetadata(meta);
        } catch (err) {
          console.error('File validation failed:', err);
          setError(`Invalid .oxide file: ${err}`);
          setFileData(null);
        }
      }
    } catch (err) {
      console.error('File selection failed:', err);
      setError(`File selection failed: ${err}`);
    }
  };

  const handleImport = async () => {
    if (!fileData || !password) {
      setError('Please enter decryption password');
      return;
    }

    setError(null);
    setImporting(true);

    try {
      const importResult: ImportResult = await invoke('import_from_oxide', {
        fileData: Array.from(fileData),
        password,
      });

      setResult(importResult);

      // Refresh connections list
      await loadSavedConnections();

      if (importResult.errors.length === 0) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error('Import failed:', err);
      const errorMsg = String(err).toLowerCase();
      if ((errorMsg.includes('password') && (errorMsg.includes('incorrect') || errorMsg.includes('wrong') || errorMsg.includes('failed'))) || errorMsg.includes('decryption failed')) {
        setError('Incorrect password, unable to decrypt file');
      } else if (errorMsg.includes('checksum') || errorMsg.includes('tamper') || errorMsg.includes('verification failed')) {
        setError('File verification failed, data may have been tampered with');
      } else {
        setError(`Import failed: ${err}`);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFileData(null);
    setMetadata(null);
    setPassword('');
    setRestoreBuffers(true);
    setError(null);
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl gap-0 bg-theme-bg-panel border-theme-border text-theme-text p-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-theme-border px-6 py-4">
          <DialogTitle className="text-xl font-semibold text-theme-text">Import Configuration from .oxide File</DialogTitle>
          <DialogClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {!fileData ? (
            /* File Selection */
            <div className="text-center py-8">
              <Button onClick={handleSelectFile} className="bg-theme-accent text-white hover:bg-theme-accent-hover">
                Select .oxide File
              </Button>
              
              <div className="mt-6 bg-blue-500/10 border border-blue-500/20 text-blue-500 px-4 py-3 rounded text-sm text-left">
                <p className="font-semibold">Import Instructions</p>
                <ul className="mt-1 space-y-1 text-xs opacity-90 list-disc list-inside">
                  <li>Select .oxide file exported by OxideTerm</li>
                  <li>Enter the encryption password set during export</li>
                  <li>All connections will be imported at once (all or nothing)</li>
                  <li>Passwords and private key passphrases will be securely stored in system keychain</li>
                </ul>
              </div>
            </div>
          ) : result ? (
            /* Import Result */
            <div className="py-4">
              <div className={`p-4 rounded border ${
                result.errors.length === 0 
                  ? 'bg-green-500/10 border-green-500/20 text-green-500'
                  : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
              }`}>
                <p className="font-semibold text-lg">
                  ✓ Import successful: {result.imported} connections
                </p>
                {result.skipped > 0 && (
                  <p className="text-sm mt-1">Skipped: {result.skipped}</p>
                )}
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold">Errors:</p>
                    <ul className="text-xs mt-1 space-y-1 opacity-90">
                      {result.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {result.errors.length === 0 && (
                <p className="text-sm text-theme-text-muted text-center mt-4">
                  Window will automatically close in 2 seconds...
                </p>
              )}
            </div>
          ) : (
            /* File Info & Password Input */
            <>
              {metadata && (
                <div className="border border-theme-border rounded-md p-4 space-y-2 bg-theme-bg">
                  <h3 className="font-semibold text-theme-text">File Information</h3>
                  <div className="text-sm space-y-1 text-theme-text">
                    <p><span className="text-theme-text-muted">Exported at:</span> {new Date(metadata.exported_at).toLocaleString()}</p>
                    <p><span className="text-theme-text-muted">Exported by:</span> {metadata.exported_by}</p>
                    {metadata.description && (
                      <p><span className="text-theme-text-muted">Description:</span> {metadata.description}</p>
                    )}
                    <p><span className="text-theme-text-muted">Contains:</span> {metadata.num_connections} connections</p>
                  </div>

                  <div className="mt-3">
                    <p className="text-sm font-semibold text-theme-text">Connection List:</p>
                    <ul className="text-xs text-theme-text-muted mt-1 space-y-1 max-h-32 overflow-y-auto">
                      {metadata.connection_names.map((name, i) => (
                        <li key={i}>• {name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Password Input */}
              <div>
                <Label className="text-theme-text">Decryption Password</Label>
                <Input
                  type="password"
                  placeholder="Enter password set during export"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && password) {
                      handleImport();
                    }
                  }}
                  className="mt-1 bg-theme-bg border-theme-border text-theme-text placeholder:text-theme-text-muted focus-visible:ring-theme-accent"
                  autoFocus
                />
              </div>

              {/* Buffer Restore Option */}
              <div className="flex items-center space-x-2 p-3 bg-zinc-900 rounded border border-theme-border">
                <Checkbox
                  id="restore-buffers"
                  checked={restoreBuffers}
                  onCheckedChange={(checked: boolean) => setRestoreBuffers(checked === true)}
                  className="border-theme-text-muted data-[state=checked]:bg-theme-accent data-[state=checked]:border-theme-accent"
                />
                <Label htmlFor="restore-buffers" className="cursor-pointer text-theme-text">
                  <div className="font-medium">Restore terminal buffer content</div>
                  <div className="text-xs text-theme-text-muted">
                    If the file contains saved terminal buffers, restore them to active sessions
                  </div>
                </Label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-3 py-2 rounded text-sm">
                <p className="font-semibold">⚠️ Warning</p>
                <p className="text-xs mt-1 opacity-90">
                  Import will add all connections at once. If a connection with the same name already exists, the new connection will be renamed.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" onClick={handleSelectFile} disabled={importing} className="border-theme-border text-theme-text hover:bg-theme-bg-hover">
                  Reselect File
                </Button>
                <Button variant="outline" onClick={handleClose} disabled={importing} className="border-theme-border text-theme-text hover:bg-theme-bg-hover">
                  Cancel
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importing || !password}
                  className="bg-theme-accent text-white hover:bg-theme-accent-hover disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import All'}
                </Button>
              </div>
            </>
          )}

          {/* Result Actions */}
          {result && (
            <div className="flex justify-end space-x-2 pt-2">
              <Button onClick={handleClose} className="bg-theme-accent text-white hover:bg-theme-accent-hover">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
