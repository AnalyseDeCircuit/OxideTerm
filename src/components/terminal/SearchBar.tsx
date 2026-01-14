import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown, CaseSensitive, Regex, WholeWord } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { api } from '../../lib/api';
import { SearchOptions, SearchResult } from '../../types';

interface SearchBarProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onJumpToLine?: (lineNumber: number) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  sessionId, 
  isOpen, 
  onClose,
  onJumpToLine 
}) => {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(async () => {
    if (!query.trim()) {
      setSearchResult(null);
      setCurrentMatchIndex(-1);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const options: SearchOptions = {
        query: query.trim(),
        case_sensitive: caseSensitive,
        regex: useRegex,
        whole_word: wholeWord,
      };

      const result = await api.searchTerminal(sessionId, options);
      setSearchResult(result);
      setCurrentMatchIndex(result.total_matches > 0 ? 0 : -1);

      // Jump to first match if available
      if (result.total_matches > 0 && onJumpToLine) {
        onJumpToLine(result.matches[0].line_number);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      setSearchResult(null);
      setCurrentMatchIndex(-1);
    } finally {
      setIsSearching(false);
    }
  }, [query, caseSensitive, useRegex, wholeWord, sessionId, onJumpToLine]);

  // Trigger search on query or options change (debounced)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [performSearch]);

  // Navigate to previous match
  const gotoPrevMatch = useCallback(() => {
    if (!searchResult || searchResult.total_matches === 0) return;

    const newIndex = currentMatchIndex > 0 
      ? currentMatchIndex - 1 
      : searchResult.total_matches - 1;
    
    setCurrentMatchIndex(newIndex);
    
    if (onJumpToLine) {
      onJumpToLine(searchResult.matches[newIndex].line_number);
    }
  }, [searchResult, currentMatchIndex, onJumpToLine]);

  // Navigate to next match
  const gotoNextMatch = useCallback(() => {
    if (!searchResult || searchResult.total_matches === 0) return;

    const newIndex = currentMatchIndex < searchResult.total_matches - 1 
      ? currentMatchIndex + 1 
      : 0;
    
    setCurrentMatchIndex(newIndex);
    
    if (onJumpToLine) {
      onJumpToLine(searchResult.matches[newIndex].line_number);
    }
  }, [searchResult, currentMatchIndex, onJumpToLine]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Esc to close
      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
        return;
      }

      // Enter to go to next match, Shift+Enter for previous
      if (e.key === 'Enter' && searchResult && searchResult.total_matches > 0) {
        if (e.shiftKey) {
          gotoPrevMatch();
        } else {
          gotoNextMatch();
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResult, gotoPrevMatch, gotoNextMatch, onClose]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-4 right-4 z-50 w-96 bg-zinc-900 border border-theme-border rounded-md shadow-2xl">
      {/* Main Search Row */}
      <div className="flex items-center gap-2 p-3 border-b border-theme-border">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索终端输出..."
          className="flex-1 h-8 text-sm border-0 focus-visible:ring-0 bg-transparent"
        />
        
        {/* Match Counter */}
        {searchResult && (
          <div className="text-xs text-zinc-400 whitespace-nowrap">
            {searchResult.total_matches === 0 
              ? '无结果' 
              : `${currentMatchIndex + 1}/${searchResult.total_matches}`
            }
          </div>
        )}

        {/* Navigation Buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={gotoPrevMatch}
          disabled={!searchResult || searchResult.total_matches === 0}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={gotoNextMatch}
          disabled={!searchResult || searchResult.total_matches === 0}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Options Row */}
      <div className="flex items-center gap-4 px-3 py-2 bg-zinc-950">
        {/* Case Sensitive */}
        <div className="flex items-center gap-1.5">
          <Checkbox
            id="case-sensitive"
            checked={caseSensitive}
            onCheckedChange={(checked: boolean) => setCaseSensitive(checked === true)}
          />
          <Label 
            htmlFor="case-sensitive" 
            className="text-xs cursor-pointer flex items-center gap-1"
          >
            <CaseSensitive className="w-3.5 h-3.5" />
            <span>大小写</span>
          </Label>
        </div>

        {/* Regex */}
        <div className="flex items-center gap-1.5">
          <Checkbox
            id="regex"
            checked={useRegex}
            onCheckedChange={(checked: boolean) => setUseRegex(checked === true)}
          />
          <Label 
            htmlFor="regex" 
            className="text-xs cursor-pointer flex items-center gap-1"
          >
            <Regex className="w-3.5 h-3.5" />
            <span>正则</span>
          </Label>
        </div>

        {/* Whole Word */}
        <div className="flex items-center gap-1.5">
          <Checkbox
            id="whole-word"
            checked={wholeWord}
            onCheckedChange={(checked: boolean) => setWholeWord(checked === true)}
          />
          <Label 
            htmlFor="whole-word" 
            className="text-xs cursor-pointer flex items-center gap-1"
          >
            <WholeWord className="w-3.5 h-3.5" />
            <span>全词</span>
          </Label>
        </div>

        {/* Loading/Error Indicator */}
        {isSearching && (
          <div className="ml-auto text-xs text-zinc-500">搜索中...</div>
        )}
        {error && (
          <div className="ml-auto text-xs text-red-400">{error}</div>
        )}
        {searchResult && searchResult.duration_ms > 0 && (
          <div className="ml-auto text-xs text-zinc-500">
            {searchResult.duration_ms}ms
          </div>
        )}
      </div>
    </div>
  );
};
