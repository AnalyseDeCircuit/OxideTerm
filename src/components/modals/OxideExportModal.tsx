import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { useAppStore } from '../../store/appStore';

interface OxideExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OxideExportModal({ isOpen, onClose }: OxideExportModalProps) {
  const { t } = useTranslation();
  const { savedConnections, loadSavedConnections } = useAppStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [description, setDescription] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load connections when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSavedConnections();
      setSelectedIds([]);
      setPassword('');
      setConfirmPassword('');
      setDescription('');
      setError(null);
    }
  }, [isOpen, loadSavedConnections]);

  const handleSelectAll = () => {
    if (selectedIds.length === savedConnections.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(savedConnections.map(c => c.id));
    }
  };

  const handleToggleConnection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(cid => cid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const validatePassword = (): boolean => {
    if (password.length < 12) {
      setError(t('modals.export.error_password_length'));
      return false;
    }

    if (password !== confirmPassword) {
      setError(t('modals.export.error_password_mismatch'));
      return false;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!(hasUpper && hasLower && hasDigit && hasSpecial)) {
      setError(t('modals.export.error_password_complexity'));
      return false;
    }

    return true;
  };

  const handleExport = async () => {
    setError(null);

    if (selectedIds.length === 0) {
      setError(t('modals.export.error_select_one'));
      return;
    }

    if (!validatePassword()) {
      return;
    }

    setExporting(true);

    try {
      // Call Tauri command to encrypt and export
      const fileData: number[] = await invoke('export_to_oxide', {
        connectionIds: selectedIds,
        password,
        description: description || null,
      });

      // Save file dialog
      const savePath = await save({
        defaultPath: `oxide-export-${Date.now()}.oxide`,
        filters: [{ name: 'Oxide Config', extensions: ['oxide'] }],
      });

      if (savePath) {
        // Write binary file
        await writeFile(savePath, new Uint8Array(fileData));
        
        alert(`Export successful: ${selectedIds.length} connections saved to ${savePath}`);
        onClose();
      }
    } catch (err) {
      console.error('Export failed:', err);
      setError(`Export failed: ${err}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-theme-bg-panel border-theme-border text-theme-text p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-theme-border px-6 py-4 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold text-theme-text">{t('modals.export.title')}</DialogTitle>
          <DialogClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">{t('modals.export.close')}</span>
          </DialogClose>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Connection Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-theme-text">{t('modals.export.select_connections', { selected: selectedIds.length, total: savedConnections.length })}</Label>
              <Button size="sm" variant="outline" onClick={handleSelectAll} className="h-7 text-xs border-theme-border text-theme-text hover:bg-theme-bg-hover">
                {selectedIds.length === savedConnections.length ? t('modals.export.deselect_all') : t('modals.export.select_all')}
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-theme-border rounded-md p-2 space-y-1 bg-theme-bg">
              {savedConnections.length === 0 ? (
                <p className="text-sm text-theme-text-muted py-4 text-center">
                  {t('modals.export.no_connections')}
                </p>
              ) : (
                savedConnections.map(conn => (
                  <div key={conn.id} className="flex items-center space-x-2 p-2 hover:bg-theme-bg-hover rounded cursor-pointer" onClick={() => handleToggleConnection(conn.id)}>
                    <Checkbox
                      checked={selectedIds.includes(conn.id)}
                      onCheckedChange={() => handleToggleConnection(conn.id)}
                      className="border-theme-text-muted data-[state=checked]:bg-theme-accent data-[state=checked]:border-theme-accent"
                    />
                    <Label className="flex-1 cursor-pointer text-theme-text">
                      <div className="font-medium">{conn.name}</div>
                      <div className="text-xs text-theme-text-muted">
                        {conn.username}@{conn.host}:{conn.port}
                        {conn.group && ` [${conn.group}]`}
                      </div>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-theme-text">{t('modals.export.description')}</Label>
            <Input
              placeholder={t('modals.export.description_placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 bg-theme-bg border-theme-border text-theme-text placeholder:text-theme-text-muted focus-visible:ring-theme-accent"
            />
          </div>

          {/* Password */}
          <div>
            <Label className="text-theme-text">{t('modals.export.password')}</Label>
            <Input
              type="password"
              placeholder={t('modals.export.password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 bg-theme-bg border-theme-border text-theme-text placeholder:text-theme-text-muted focus-visible:ring-theme-accent"
            />
          </div>

          <div>
            <Label className="text-theme-text">{t('modals.export.confirm_password')}</Label>
            <Input
              type="password"
              placeholder={t('modals.export.confirm_password_placeholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 bg-theme-bg border-theme-border text-theme-text placeholder:text-theme-text-muted focus-visible:ring-theme-accent"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Info Message */}
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 px-3 py-2 rounded text-sm">
            <p className="font-semibold">{t('modals.export.security_notice')}</p>
            <ul className="mt-1 space-y-1 text-xs opacity-90">
              <li>• {t('modals.export.security_encryption')}</li>
              <li>• {t('modals.export.security_kdf')}</li>
              <li>• {t('modals.export.security_contains')}</li>
              <li>• <strong>{t('modals.export.security_no_session')}</strong></li>
              <li>• {t('modals.export.security_keep_safe')}</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={exporting} className="border-theme-border text-theme-text hover:bg-theme-bg-hover">
              {t('modals.export.cancel')}
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={exporting || selectedIds.length === 0}
              className="bg-theme-accent text-white hover:bg-theme-accent-hover disabled:opacity-50"
            >
              {exporting ? t('modals.export.exporting') : t('modals.export.export')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}