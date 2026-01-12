# AGENTS.md

This file provides guidance for AI agents working on the OxideTerm codebase.

## Build & Development Commands

```bash
# Development
npm run tauri dev              # Start full dev server (frontend + Tauri)
npm run dev                    # Start Vite dev server only (port 1420)

# Build
npm run build                  # Build frontend (TypeScript + Vite)
npm run tauri build            # Build complete app for production

# Preview
npm run preview                # Preview production build
```

**Important:** No standalone lint/test commands exist. TypeScript type checking runs as part of `npm run build`. After making changes, run `npm run build` to verify type correctness.

## Code Style Guidelines

### Frontend (React/TypeScript)

#### Imports
- Use path aliases: `@/*` for src, `@/components/*`, `@/lib/*`, `@/hooks/*`, `@/stores/*`, `@/types/*`
- Organize imports: React → Third-party → Internal types → Components → Hooks/lib/store

```typescript
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { SessionInfo } from '@/types/session';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
```

#### Component Patterns
- PascalCase components: `Button`, `AppShell`
- Use `forwardRef` and set `displayName` for components with refs
- CVA for variant-based styling, Radix UI for accessibility
- Use `cn()` utility to merge Tailwind classes
- Add JSDoc comments for reusable components

```typescript
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {isLoading && <Spinner />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

#### State Management (Zustand)
- Use Zustand for global state
- Create selector hooks for common patterns to avoid re-renders
- Avoid inline selectors in `useEffect` dependencies
- Use `subscribeWithSelector` middleware

```typescript
// Good: Named selector hook
export const useActiveSession = () =>
  useSessionStore(state => state.sessions.get(state.activeTabId));

// Bad: Inline selector creates new object each render
useEffect(() => {
  const session = store(state => state.sessions.get(id));
}, []);
```

#### Types
- Define types in `/src/types/`
- Use `interface` for object shapes, `type` for unions/primitives
- Discriminated unions for state machines

#### Error Handling
- Wrap async operations in try-catch
- Log errors with context: `console.error('Operation failed:', error)`
- Display errors via toast notifications (use `useToast` hook)

```typescript
try {
  await invoke('some_command');
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error('Command failed:', error);
  toast.error(errorMsg);
}
```

#### Styling
- Tailwind CSS with CSS variables for theming
- Catppuccin Mocha palette, semantic colors: `primary`, `success`, `warning`, `error`
- Industrial design: no shadows, rounded-none edges, high contrast hover states
- Use `cn()` for conditional classes

### Backend (Rust)

#### Code Organization
- Module structure mirrors functionality: `ssh/`, `bridge/`, `session/`, `config/`, `forwarding/`, `sftp/`
- Tauri commands defined in `commands/mod.rs` and registered in `lib.rs`
- Shared state via `Arc<T>` with `tauri::Builder::manage()`

#### Naming
- snake_case for functions/variables: `connect_v2`
- PascalCase for types/structs: `SessionInfo`
- Module names: snake_case (e.g., `ssh/mod.rs`)

#### Error Handling
- Use `thiserror` for custom error types
- Use `tracing` for structured logging
- Return `Result<T, Error>` from fallible operations

```rust
#[derive(Debug, thiserror::Error)]
pub enum SshError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
}
```

#### Async Patterns
- Use `tokio` runtime, `async fn` for async commands
- Use `tauri::async_runtime::spawn` for background tasks

#### Code Style
- 4-space indentation, `use` statements for imports
- Add module-level docs with `//!`, function docs with `///`

### General Guidelines

#### Testing
- No test framework configured; manual testing required
- For Rust tests: `cargo test` in `src-tauri/` directory

#### File Organization
- Each component has its own directory with `index.ts` for exports
- Atomic UI components in `/src/components/ui/`
- Layout components in `/src/components/layout/`

#### Keyboard Shortcuts
- Support both Mac (⌘) and Windows/Linux (Ctrl): `e.metaKey || e.ctrlKey`

#### Comments
- Add JSDoc for exported functions/components
- Keep comments concise, avoid obvious code comments

## Technology Stack

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Zustand, Radix UI, xterm.js

**Backend:** Rust, Tauri 2, tokio, russh (SSH), tokio-tungstenite (WebSocket), thiserror, tracing

**Styling:** Tailwind CSS with CSS variables, Catppuccin Mocha theme, industrial design aesthetic
