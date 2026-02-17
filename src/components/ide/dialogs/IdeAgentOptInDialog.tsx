// src/components/ide/dialogs/IdeAgentOptInDialog.tsx
import { useTranslation } from 'react-i18next';
import { Bot, FolderSync } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';

interface IdeAgentOptInDialogProps {
  open: boolean;
  onEnable: () => void;
  onSftpOnly: () => void;
}

export function IdeAgentOptInDialog({
  open,
  onEnable,
  onSftpOnly,
}: IdeAgentOptInDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={() => { /* prevent dismiss by clicking outside */ }}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-theme-accent" />
            {t('ide.agent_optin_title')}
          </DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p>{t('ide.agent_optin_desc')}</p>
            <div className="space-y-2 text-xs text-theme-text-muted">
              <div className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>{t('ide.agent_optin_benefit_watch')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>{t('ide.agent_optin_benefit_git')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>{t('ide.agent_optin_benefit_atomic')}</span>
              </div>
            </div>
            <p className="text-xs text-theme-text-muted italic">
              {t('ide.agent_optin_note')}
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onSftpOnly}
            className="flex-1 sm:flex-none"
          >
            <FolderSync className="w-4 h-4 mr-1.5" />
            {t('ide.agent_optin_sftp_only')}
          </Button>
          <Button
            onClick={onEnable}
            className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-700"
          >
            <Bot className="w-4 h-4 mr-1.5" />
            {t('ide.agent_optin_enable')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
