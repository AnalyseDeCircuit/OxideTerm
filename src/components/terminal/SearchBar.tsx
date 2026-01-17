import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown, CaseSensitive, Regex, WholeWord } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, options: { caseSensitive?: boolean; regex?: boolean; wholeWord?: boolean }) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  resultIndex: number;  // -1 if no results or limit exceeded
  resultCount: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  isOpen, 
  onClose,
  onSearch,
  onFindNext,
  onFindPrevious,
  resultIndex,
  resultCount,
}) => {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Debounced search - triggers on query or options change
  useEffect(() => {
    if (!isOpen) return;
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onSearch(query, { caseSensitive, regex: useRegex, wholeWord });
    }, 150); // Faster debounce for better responsiveness

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, caseSensitive, useRegex, wholeWord, isOpen, onSearch]);

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
      if (e.key === 'Enter' && resultCount > 0) {
        if (e.shiftKey) {
          onFindPrevious();
        } else {
          onFindNext();
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, resultCount, onFindNext, onFindPrevious, onClose]);

  if (!isOpen) return null;

  // Prevent terminal from stealing focus
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Format result display
  const getResultDisplay = () => {
    if (!query.trim()) return null;
    if (resultCount === 0) return 'No results';
    if (resultIndex === -1) return `${resultCount}+ matches`; // Limit exceeded
    return `${resultIndex + 1}/${resultCount}`;
  };

  return (
    <div 
      className="absolute top-4 right-4 z-50 w-96 bg-zinc-900 border border-theme-border rounded-md shadow-2xl"
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
    >
      {/* Main Search Row */}
      <div className="flex items-center gap-2 p-3 border-b border-theme-border">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terminal output..."
          className="flex-1 h-8 text-sm border-0 focus-visible:ring-0 bg-transparent"
        />
        
        {/* Match Counter */}
        {query.trim() && (
          <div className="text-xs text-zinc-400 whitespace-nowrap">
            {getResultDisplay()}
          </div>
        )}

        {/* Navigation Buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onFindPrevious}
          disabled={resultCount === 0}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onFindNext}
          disabled={resultCount === 0}
          title="Next match (Enter)"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onClose}
          title="Close (Esc)"
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
            title="Case Sensitive"
          >
            <CaseSensitive className="w-3.5 h-3.5" />
            <span>Aa</span>
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
            title="Use Regular Expression"
          >
            <Regex className="w-3.5 h-3.5" />
            <span>.*</span>
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
            title="Match Whole Word"
          >
            <WholeWord className="w-3.5 h-3.5" />
            <span>Word</span>
          </Label>
        </div>
      </div>
    </div>
  );
};
