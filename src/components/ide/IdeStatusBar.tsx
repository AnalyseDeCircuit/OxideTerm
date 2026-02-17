// src/components/ide/IdeStatusBar.tsx
import { useIdeStore, useIdeProject, useIdeActiveTab, useIdeDirtyCount } from '../../store/ideStore';
import { GitBranch, Cpu, HardDrive } from 'lucide-react';
import { useAgentStatus } from './hooks/useAgentStatus';
import { cn } from '../../lib/utils';

export function IdeStatusBar() {
  const project = useIdeProject();
  const activeTab = useIdeActiveTab();
  const dirtyCount = useIdeDirtyCount();
  const nodeId = useIdeStore(state => state.nodeId);
  const { mode, label } = useAgentStatus(nodeId ?? undefined);
  
  return (
    <div className="h-6 bg-theme-bg-panel border-t border-theme-border flex items-center px-3 text-xs text-theme-text-muted">
      {/* Agent/SFTP 模式指示器 */}
      <div className={cn(
        "flex items-center gap-1 mr-4 px-1.5 py-0.5 rounded",
        mode === 'agent' && "text-emerald-400",
        mode === 'sftp' && "text-theme-text-muted",
        mode === 'deploying' && "text-amber-400",
        mode === 'checking' && "text-theme-text-muted opacity-50",
      )}>
        {mode === 'agent' ? (
          <Cpu className="w-3 h-3" />
        ) : (
          <HardDrive className="w-3 h-3" />
        )}
        <span>{label}</span>
      </div>

      {/* Git 分支 */}
      {project?.isGitRepo && project.gitBranch && (
        <div className="flex items-center gap-1 mr-4">
          <GitBranch className="w-3 h-3" />
          <span>{project.gitBranch}</span>
        </div>
      )}
      
      {/* 光标位置 */}
      {activeTab?.cursor && (
        <span className="mr-4">
          Ln {activeTab.cursor.line}, Col {activeTab.cursor.col}
        </span>
      )}
      
      {/* 语言 */}
      {activeTab && (
        <span className="mr-4">{activeTab.language}</span>
      )}
      
      {/* 未保存文件数 */}
      {dirtyCount > 0 && (
        <span className="ml-auto text-theme-accent">
          {dirtyCount} unsaved
        </span>
      )}
    </div>
  );
}
