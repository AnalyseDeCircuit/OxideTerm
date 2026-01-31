import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Bot, Copy, Check, Terminal } from 'lucide-react';
import { emit } from '@tauri-apps/api/event';
import type { AiChatMessage } from '../../types';

interface ChatMessageProps {
  message: AiChatMessage;
}

// Check if language looks like a shell command
function isShellLanguage(language: string): boolean {
  const shellLangs = ['bash', 'sh', 'zsh', 'shell', 'powershell', 'ps1', 'cmd', 'terminal', 'console', ''];
  return shellLangs.includes(language.toLowerCase());
}

// Simple markdown-like rendering for code blocks
function renderContent(content: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Split by code blocks
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(<TextContent key={key++} text={text} />);
    }

    // Code block
    const language = match[1] || '';
    const code = match[2].trim();
    parts.push(
      <CodeBlock key={key++} language={language} code={code} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    parts.push(<TextContent key={key++} text={text} />);
  }

  return parts.length > 0 ? parts : <TextContent text={content} />;
}

// Text content with inline code support
function TextContent({ text }: { text: string }) {
  // Handle inline code
  const inlineCodeRegex = /`([^`]+)`/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++}>
          {text.slice(lastIndex, match.index).split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    }
    parts.push(
      <code
        key={key++}
        className="px-1.5 py-0.5 rounded bg-theme-bg-panel border border-theme-border/50 text-theme-accent text-xs font-mono"
      >
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={key++}>
        {text.slice(lastIndex).split('\n').map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
      </span>
    );
  }

  return <span className="whitespace-pre-wrap">{parts.length > 0 ? parts : text}</span>;
}

// Code block component
function CodeBlock({ language, code }: { language: string; code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const canInsert = isShellLanguage(language);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = async () => {
    // Emit event to insert command into active terminal
    await emit('ai-insert-command', { command: code });
  };

  return (
    <div className="my-4 rounded-sm overflow-hidden bg-[var(--theme-bg-darker,#09090b)] border border-theme-border/20">
      <div className="flex items-center justify-between px-3 py-1 bg-theme-bg-panel/20 border-b border-theme-border/10">
        <span className="text-[10px] text-theme-text-muted font-mono uppercase tracking-wider opacity-60">
          {language || 'shell'}
        </span>
        <div className="flex items-center gap-3">
          {canInsert && (
            <button
              onClick={handleInsert}
              className="group/btn flex items-center gap-1.5 py-0.5 text-theme-text-muted hover:text-theme-accent transition-colors"
              title={t('ai.message.insert_to_terminal')}
            >
              <Terminal className="w-3 h-3" />
              <span className="text-[10px] font-bold tracking-tight">RUN</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="group/btn flex items-center gap-1.5 py-0.5 text-theme-text-muted hover:text-theme-text transition-colors"
            title={t('ai.message.copy_code')}
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-tight">COPY</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed font-mono">
        <code className="text-theme-text block">{code}</code>
      </pre>
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';

  const renderedContent = useMemo(
    () => renderContent(message.content),
    [message.content]
  );

  return (
    <div className="flex flex-col gap-2 px-4 py-6 border-b border-theme-border/5 last:border-0">
      {/* Header - Avatar and Name on one line */}
      <div className="flex items-center gap-2.5">
        <div
          className={`w-6 h-6 rounded-sm flex items-center justify-center border transition-all ${isUser
            ? 'bg-theme-bg border-theme-border/60 text-theme-text-muted shadow-sm'
            : 'bg-theme-accent/5 border-theme-accent/30 text-theme-accent'
            }`}
        >
          {isUser ? (
            <User className="w-3 h-3 opacity-60" />
          ) : (
            <Bot className="w-3.5 h-3.5" />
          )}
        </div>
        <span className={`text-[12px] font-bold tracking-tight ${isUser ? 'text-theme-text-muted' : 'text-theme-text'}`}>
          {isUser ? t('ai.message.you') : 'Copilot'}
        </span>
        {message.context && !isUser && (
          <span className="text-[10px] text-theme-text-muted font-medium opacity-40">
            (used context)
          </span>
        )}
        <span className="text-[10px] text-theme-text-muted font-medium opacity-20 ml-auto font-mono">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Content - Indented to create a gutter layout */}
      <div className="pl-[34.5px] pr-2">
        <div className="text-[13.5px] text-theme-text/90 leading-relaxed font-normal selection:bg-theme-accent/30">
          {renderedContent}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1.5 bg-theme-accent/60 animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  );
});
