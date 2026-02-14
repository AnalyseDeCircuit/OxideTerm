/**
 * TabBarTerminalActions — terminal-specific actions in the tab bar
 *
 * Renders in the right-fixed area of the TabBar, completely outside
 * the terminal content area. Only shown when the active tab is a
 * terminal or local_terminal.
 *
 * Actions (left to right):
 *   - Split horizontal / vertical (local_terminal only)
 *   - Separator
 *   - Start recording / Open .cast file
 *   - REC indicator when recording is active
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Circle, FilePlay, Square, Trash2,
  SplitSquareHorizontal, SplitSquareVertical,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { cn } from '../../lib/utils';
import { useRecordingStore } from '../../store/recordingStore';
import { useAppStore, findPaneById } from '../../store/appStore';
import { useLocalTerminalStore } from '../../store/localTerminalStore';
import { MAX_PANES_PER_TAB } from '../../types';
import type { Tab, SplitDirection } from '../../types';

type TabBarTerminalActionsProps = {
  activeTab: Tab;
};

export const TabBarTerminalActions: React.FC<TabBarTerminalActionsProps> = ({
  activeTab,
}) => {
  const { t } = useTranslation();
  const openPlayer = useRecordingStore(s => s.openPlayer);

  // Determine session ID — handle both single pane and split pane modes
  const getActiveSessionId = (): string | undefined => {
    // Split pane mode: find active pane's sessionId from tree
    if (activeTab.rootPane && activeTab.activePaneId) {
      const activePane = findPaneById(activeTab.rootPane, activeTab.activePaneId);
      return activePane?.sessionId;
    }
    // Single pane mode: use legacy sessionId
    return activeTab.sessionId;
  };
  
  const sessionId = getActiveSessionId();

  // Check if this session is recording
  const isRecording = useRecordingStore(s =>
    sessionId ? s.isRecording(sessionId) : false,
  );
  const meta = useRecordingStore(s =>
    sessionId ? s.getRecordingMeta(sessionId) : null,
  );
  const stopRecording = useRecordingStore(s => s.stopRecording);
  const discardRecording = useRecordingStore(s => s.discardRecording);

  /** Dispatch start-recording event to the active terminal */
  const handleStartRecording = useCallback(() => {
    if (!sessionId) return;
    window.dispatchEvent(
      new CustomEvent('oxide:start-recording', {
        detail: { sessionId },
      }),
    );
  }, [sessionId]);

  /** Stop recording — content will be handled by terminal's handleRecordingStop */
  const handleStop = useCallback(() => {
    if (!sessionId) return;
    const content = stopRecording(sessionId);
    if (content) {
      // Dispatch stop event so the terminal view can trigger the save dialog
      window.dispatchEvent(
        new CustomEvent('oxide:recording-stopped', {
          detail: { sessionId, content },
        }),
      );
    }
  }, [sessionId, stopRecording]);

  /** Discard recording */
  const handleDiscard = useCallback(() => {
    if (!sessionId) return;
    discardRecording(sessionId);
  }, [sessionId, discardRecording]);

  /** Open a .cast file from disk and launch the player */
  const handleOpenCast = useCallback(async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'Asciicast', extensions: ['cast'] }],
        multiple: false,
      });

      if (filePath) {
        const content = await readTextFile(filePath as string);
        const fileName = (filePath as string).split(/[/\\]/).pop() || 'recording.cast';
        openPlayer(fileName, content);
      }
    } catch (err) {
      console.error('[TabBarTerminalActions] Failed to open cast file:', err);
    }
  }, [openPlayer]);

  /** Format seconds as MM:SS */
  const fmtElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ── Split pane state (local_terminal only) ───────────────────────────
  const isLocalTerminal = activeTab.type === 'local_terminal';
  const { splitPane, getPaneCount } = useAppStore();
  const { createTerminal } = useLocalTerminalStore();
  const paneCount = getPaneCount(activeTab.id);
  const canSplit = paneCount < MAX_PANES_PER_TAB;

  const handleSplit = useCallback(async (direction: SplitDirection) => {
    if (!canSplit || !isLocalTerminal) return;
    try {
      const newSession = await createTerminal();
      splitPane(activeTab.id, direction, newSession.id, 'local_terminal');
    } catch (err) {
      console.error('[TabBarTerminalActions] Failed to split pane:', err);
    }
  }, [canSplit, isLocalTerminal, createTerminal, splitPane, activeTab.id]);

  // No session ID (e.g. split pane with cleared sessionId) — hide actions
  if (!sessionId) return null;

  // ── Build action groups ────────────────────────────────────────────────
  return (
    <div className="flex-shrink-0 flex items-center h-full border-l border-theme-border">
      {/* ── Split pane actions (local_terminal only) ────────────────── */}
      {isLocalTerminal && (
        <div className="flex items-center gap-0.5 px-2">
          <button
            onClick={() => handleSplit('horizontal')}
            disabled={!canSplit}
            className={cn(
              'p-1.5 rounded-sm transition-colors',
              canSplit
                ? 'text-theme-text-muted hover:text-theme-accent hover:bg-theme-bg-hover'
                : 'text-theme-text-muted/40 cursor-not-allowed',
            )}
            title={
              canSplit
                ? t('terminal.pane.split_horizontal')
                : t('terminal.pane.max_panes_reached', { max: MAX_PANES_PER_TAB })
            }
          >
            <SplitSquareHorizontal className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => handleSplit('vertical')}
            disabled={!canSplit}
            className={cn(
              'p-1.5 rounded-sm transition-colors',
              canSplit
                ? 'text-theme-text-muted hover:text-theme-accent hover:bg-theme-bg-hover'
                : 'text-theme-text-muted/40 cursor-not-allowed',
            )}
            title={
              canSplit
                ? t('terminal.pane.split_vertical')
                : t('terminal.pane.max_panes_reached', { max: MAX_PANES_PER_TAB })
            }
          >
            <SplitSquareVertical className="h-3.5 w-3.5" />
          </button>

          {paneCount > 1 && (
            <span className="text-xs text-theme-text-muted pl-0.5 tabular-nums">
              {paneCount}/{MAX_PANES_PER_TAB}
            </span>
          )}
        </div>
      )}

      {/* ── Separator between split & recording groups ──────────────── */}
      {isLocalTerminal && (
        <div className="w-px h-4 bg-theme-border/50" />
      )}

      {/* ── Recording actions ───────────────────────────────────────── */}
      {isRecording && meta ? (
        <div className="flex items-center gap-1.5 px-2">
          {/* REC badge */}
          <div className="flex items-center gap-1.5">
            <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-xs font-mono text-red-400 font-medium">
              {fmtElapsed(meta.elapsed)}
            </span>
          </div>

          {/* Stop */}
          <button
            onClick={handleStop}
            className="p-1 rounded-sm text-zinc-400 hover:text-red-400 hover:bg-theme-bg-hover transition-colors"
            title={t('terminal.recording.stop')}
          >
            <Square className="h-3 w-3 fill-current" />
          </button>

          {/* Discard */}
          <button
            onClick={handleDiscard}
            className="p-1 rounded-sm text-zinc-400 hover:text-zinc-200 hover:bg-theme-bg-hover transition-colors"
            title={t('terminal.recording.discard')}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 px-2">
          {/* Start Recording */}
          <button
            onClick={handleStartRecording}
            className={cn(
              'p-1.5 rounded-sm transition-colors',
              'text-theme-text-muted hover:text-red-400 hover:bg-theme-bg-hover',
            )}
            title={`${t('terminal.recording.start')}  ⌘⇧R`}
          >
            <Circle className="h-3.5 w-3.5" />
          </button>

          {/* Open Cast File */}
          <button
            onClick={handleOpenCast}
            className={cn(
              'p-1.5 rounded-sm transition-colors',
              'text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-hover',
            )}
            title={t('terminal.recording.open_cast')}
          >
            <FilePlay className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
