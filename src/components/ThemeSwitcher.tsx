/**
 * ThemeSwitcher Component
 *
 * Allows users to switch between different themes.
 * Displays current theme with color indicator.
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useTheme, themes, useThemeStore } from '@/stores/themeStore';

export function ThemeSwitcher() {
  const theme = useTheme();
  const { setTheme } = useThemeStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium',
            'text-text rounded-lg',
            'hover:bg-ui-surface-hover transition-colors duration-200'
          )}
        >
          <div
            className="w-4 h-4 rounded-full border border-glass-border"
            style={{
              background: theme.accentColor,
              borderColor: theme.accentColor,
            }}
          />
          <span>Theme</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              'flex items-center gap-3 py-2',
              'cursor-pointer'
            )}
          >
            <div className="flex items-center justify-center w-6 h-6 shrink-0">
              {theme.id === t.id && (
                <Check size={14} className="text-text" />
              )}
            </div>
            <div
              className="w-5 h-5 rounded-full border-2 border-glass-border"
              style={{
                background: t.accentColor,
                borderColor: t.accentColor,
              }}
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-text">{t.name}</div>
              {theme.id === t.id && (
                <div className="text-xs text-subtext-0">Active</div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
