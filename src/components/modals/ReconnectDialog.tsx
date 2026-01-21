import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import { Loader2 } from 'lucide-react';

export const ReconnectDialog = () => {
  const { t } = useTranslation();
  const { 
    sessions, 
    reconnectPendingSessionId, 
    reconnectWithPassword, 
    cancelReconnectDialog 
  } = useAppStore();
  
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the session info
  const session = reconnectPendingSessionId 
    ? sessions.get(reconnectPendingSessionId) 
    : null;

  // Reset form when dialog opens
  useEffect(() => {
    if (reconnectPendingSessionId) {
      setPassword('');
      setError(null);
      setLoading(false);
    }
  }, [reconnectPendingSessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconnectPendingSessionId || !password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await reconnectWithPassword(reconnectPendingSessionId, password);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      cancelReconnectDialog();
    }
  };

  return (
    <Dialog open={!!reconnectPendingSessionId} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('modals.reconnect.title')}</DialogTitle>
          <DialogDescription>
            {session && (
              <span>
                {t('modals.reconnect.description')}{' '}
                <span className="font-mono text-zinc-300">
                  {session.username}@{session.host}
                </span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reconnect-password">{t('modals.reconnect.password')}</Label>
            <Input
              id="reconnect-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('modals.reconnect.password_placeholder')}
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-sm p-2">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button 
              type="button" 
              variant="ghost" 
              onClick={handleClose}
              disabled={loading}
            >
              {t('modals.reconnect.cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !password.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('modals.reconnect.connecting')}
                </>
              ) : (
                t('modals.reconnect.reconnect')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
