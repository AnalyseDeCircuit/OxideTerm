/**
 * Terminal Search Bar Component
 * 
 * Features:
 * - Case sensitive search
 * - Whole word matching
 * - Regex support
 * - Keyboard navigation (Enter = next, Shift+Enter = prev)
 */

import { useState, useRef, useEffect } from 'react';

interface TerminalSearchBarProps {
  onSearch: (query: string, options: SearchOptions) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export function TerminalSearchBar({ onSearch, onNext, onPrev, onClose }: TerminalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Trigger search when options change
  useEffect(() => {
    if (query) {
      onSearch(query, { caseSensitive, wholeWord, regex });
    }
  }, [query, caseSensitive, wholeWord, regex, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className="absolute top-0 right-0 z-50 flex items-center gap-2 p-2 bg-gray-800 border border-gray-700 rounded-bl-lg shadow-lg">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="w-64 px-3 py-1.5 text-sm bg-gray-900 border border-gray-600 rounded 
                     text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
          {query ? 'Enter / Shift+Enter' : ''}
        </span>
      </div>

      {/* Search Options */}
      <div className="flex items-center gap-1">
        <OptionButton
          active={caseSensitive}
          onClick={() => setCaseSensitive(!caseSensitive)}
          title="Case Sensitive (Alt+C)"
        >
          Aa
        </OptionButton>
        <OptionButton
          active={wholeWord}
          onClick={() => setWholeWord(!wholeWord)}
          title="Whole Word (Alt+W)"
        >
          <span className="border-b border-current">ab</span>
        </OptionButton>
        <OptionButton
          active={regex}
          onClick={() => setRegex(!regex)}
          title="Use Regex (Alt+R)"
        >
          .*
        </OptionButton>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1 border-l border-gray-600 pl-2">
        <button
          onClick={onPrev}
          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
          title="Previous Match (Shift+Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onNext}
          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
          title="Next Match (Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
        title="Close (Escape)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface OptionButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function OptionButton({ active, onClick, title, children }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        px-2 py-1 text-xs font-mono rounded transition-colors
        ${active 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
        }
      `}
    >
      {children}
    </button>
  );
}
