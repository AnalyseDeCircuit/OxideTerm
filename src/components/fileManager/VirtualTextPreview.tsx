/**
 * VirtualTextPreview
 * Streaming + virtualized preview for large text/code files
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Prism from 'prismjs';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';
import { getFontFamilyCSS } from './fontUtils';
import './prismLanguages';

interface FileChunk {
  data: number[];
  eof: boolean;
}

export interface VirtualTextPreviewProps {
  path: string;
  size: number;
  language?: string;
  showLineNumbers?: boolean;
  highlight?: boolean;
  className?: string;
}

const CHUNK_SIZE = 128 * 1024; // 128KB
const OVERSCAN_LINES = 20;
const PREFETCH_LINES = 60;

export const VirtualTextPreview: React.FC<VirtualTextPreviewProps> = ({
  path,
  size,
  language,
  showLineNumbers = true,
  highlight = false,
  className,
}) => {
  const { t } = useTranslation();
  const fontFamily = useSettingsStore(s => s.settings.terminal.fontFamily);
  const fontSize = useSettingsStore(s => s.settings.terminal.fontSize);
  const lineHeight = useSettingsStore(s => s.settings.terminal.lineHeight) || 1.5;

  const containerRef = useRef<HTMLDivElement>(null);
  const decoderRef = useRef<TextDecoder>(new TextDecoder());
  const carryRef = useRef<string>('');
  // Chunk-based line storage — O(1) append, no flat copy
  const chunksRef = useRef<string[][]>([]);
  // Cumulative line count at the end of each chunk for O(log n) indexed access
  const chunkOffsetsRef = useRef<number[]>([]);
  const [lineCount, setLineCount] = useState<number>(0);
  // Use refs for mutable load state so loadMore has a stable identity
  const offsetRef = useRef<number>(0);
  const eofRef = useRef<boolean>(false);
  const loadingRef = useRef<boolean>(false);
  // Generation token: incremented on reset, used to discard stale async responses
  const generationRef = useRef<number>(0);
  const [eof, setEof] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(0);

  // Indexed access into chunked storage — O(log n) via binary search on offsets
  const getLine = useCallback((index: number): string => {
    const offsets = chunkOffsetsRef.current;
    const chunks = chunksRef.current;
    // Binary search for the chunk containing `index`
    let lo = 0, hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid] <= index) lo = mid + 1;
      else hi = mid;
    }
    const chunkIdx = lo;
    const prevOffset = chunkIdx > 0 ? offsets[chunkIdx - 1] : 0;
    return chunks[chunkIdx]?.[index - prevOffset] ?? '';
  }, []);

  // Slice a range from chunked storage without flattening everything
  const sliceLines = useCallback((start: number, end: number): string[] => {
    const result: string[] = [];
    for (let i = start; i < end; i++) {
      result.push(getLine(i));
    }
    return result;
  }, [getLine]);

  const linePx = useMemo(() => Math.max(14, Math.round(fontSize * lineHeight)), [fontSize, lineHeight]);

  const reset = useCallback(() => {
    generationRef.current += 1;
    chunksRef.current = [];
    chunkOffsetsRef.current = [];
    offsetRef.current = 0;
    eofRef.current = false;
    loadingRef.current = false;
    setLineCount(0);
    setEof(false);
    setLoading(false);
    setScrollTop(0);
    carryRef.current = '';
    decoderRef.current = new TextDecoder();
  }, []);

  const appendChunk = useCallback((text: string, isEof: boolean) => {
    const combined = carryRef.current + text;
    const parts = combined.split('\n');

    if (!isEof) {
      carryRef.current = parts.pop() ?? '';
      if (parts.length > 0) {
        chunksRef.current.push(parts);
        const prevTotal = chunkOffsetsRef.current.length > 0
          ? chunkOffsetsRef.current[chunkOffsetsRef.current.length - 1]
          : 0;
        chunkOffsetsRef.current.push(prevTotal + parts.length);
        setLineCount(prev => prev + parts.length);
      }
    } else {
      carryRef.current = '';
      if (parts.length > 0) {
        chunksRef.current.push(parts);
        const prevTotal = chunkOffsetsRef.current.length > 0
          ? chunkOffsetsRef.current[chunkOffsetsRef.current.length - 1]
          : 0;
        chunkOffsetsRef.current.push(prevTotal + parts.length);
        setLineCount(prev => prev + parts.length);
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || eofRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const gen = generationRef.current;

    try {
      const currentOffset = offsetRef.current;
      const length = Math.min(CHUNK_SIZE, Math.max(0, size - currentOffset));
      if (length <= 0) {
        eofRef.current = true;
        setEof(true);
        return;
      }

      const chunk = await invoke<FileChunk>('local_read_file_range', {
        path,
        offset: currentOffset,
        length,
      });

      // Discard stale response if path changed during the await
      if (gen !== generationRef.current) return;

      const bytes = new Uint8Array(chunk.data);
      const decoded = decoderRef.current.decode(bytes, { stream: !chunk.eof });
      appendChunk(decoded, chunk.eof);
      offsetRef.current = currentOffset + bytes.length;
      if (chunk.eof || bytes.length === 0) {
        eofRef.current = true;
        setEof(true);
      }
    } catch (err) {
      if (gen !== generationRef.current) return;
      console.error('Stream preview load error:', err);
      eofRef.current = true;
      setEof(true);
    } finally {
      if (gen === generationRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [appendChunk, path, size]);

  // Initial load on path change — only depends on path (stable loadMore via refs)
  useEffect(() => {
    reset();
    // Use rAF to ensure reset state is flushed before loading
    const id = requestAnimationFrame(() => {
      loadMore();
    });
    return () => cancelAnimationFrame(id);
  }, [path, reset, loadMore]);

  // Resize observer for viewport height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setViewportHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll handler + prefetch
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const nextTop = target.scrollTop;
    setScrollTop(nextTop);

    const remaining = target.scrollHeight - (nextTop + target.clientHeight);
    if (remaining < linePx * PREFETCH_LINES) {
      loadMore();
    }
  }, [linePx, loadMore]);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / linePx) - OVERSCAN_LINES);
    const end = Math.min(lineCount, Math.ceil((scrollTop + viewportHeight) / linePx) + OVERSCAN_LINES);
    return { start, end };
  }, [scrollTop, viewportHeight, lineCount, linePx]);

  // Only slice the visible window from chunks — no full flatten
  const visibleLines = useMemo(
    () => sliceLines(visibleRange.start, visibleRange.end),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleRange.start, visibleRange.end, lineCount, sliceLines],
  );

  const highlightedLines = useMemo(() => {
    if (!highlight || !language) {
      return visibleLines.map(line => escapeHtml(line || ' '));
    }

    const grammar = Prism.languages[language];
    if (!grammar) {
      return visibleLines.map(line => escapeHtml(line || ' '));
    }

    return visibleLines.map(line => {
      try {
        return Prism.highlight(line || ' ', grammar, language);
      } catch {
        return escapeHtml(line || ' ');
      }
    });
  }, [highlight, language, visibleLines]);

  const paddingTop = visibleRange.start * linePx;
  const paddingBottom = Math.max(0, (lineCount - visibleRange.end) * linePx);
  const gutterWidth = Math.max(lineCount.toString().length, 2);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-scroll overflow-x-auto bg-zinc-950 min-h-0 scrollbar-visible ${className || ''}`}
      onScroll={onScroll}
      style={{
        fontFamily: getFontFamilyCSS(fontFamily),
        fontSize: `${fontSize}px`,
        lineHeight: lineHeight,
      }}
    >
      <div style={{ paddingTop, paddingBottom }}>
        {highlightedLines.map((lineHtml, idx) => {
          const lineNumber = visibleRange.start + idx + 1;
          return (
            <div key={lineNumber} className="flex" style={{ minHeight: `${linePx}px` }}>
              {showLineNumbers && (
                <span
                  className="flex-shrink-0 text-right select-none pr-3"
                  style={{
                    width: `${gutterWidth + 1}ch`,
                    color: 'rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {lineNumber}
                </span>
              )}
              <span
                className="flex-1"
                style={{ whiteSpace: 'pre' }}
                dangerouslySetInnerHTML={{ __html: lineHtml }}
              />
            </div>
          );
        })}

        {loading && (
          <div className="text-xs text-zinc-500 py-2">{t('fileManager.loadingMore', 'Loading...')}</div>
        )}

        {!loading && eof && lineCount === 0 && (
          <div className="text-xs text-zinc-500 py-2">{t('fileManager.emptyFile', 'Empty file')}</div>
        )}
      </div>
    </div>
  );
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
