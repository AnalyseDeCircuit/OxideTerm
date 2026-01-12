# OxideTerm UI Redesign Plan: "Industrial HUD"

**Vision:** Transform OxideTerm from a "SaaS-style" application into a "High-Precision Industrial Tool". 
**Keywords:** Cyberpunk, Brutalist, Zero-Latency, HUD, Data-Driven.
**Art Direction:**
- **Shapes:** Squared (0px/2px radius), sharp edges.
- **Colors:** Deep Void Black background, Neon Green/Orange accents, High Contrast White text.
- **Texture:** Technical grid backgrounds, 1px structural borders, no soft shadows.
- **Motion:** Instant, snappy, "Typewriter" effects. No springs or bounces.

---

## Phase 1: Foundation (The "Zero-Point")
*Estimated Time: 1 Session*

### 1.1 Typography System & Assets
- **Task:** Move `JetBrainsMonoNerdFont-Regular.ttf` to `public/fonts/`.
- **Task:** Configure `@font-face` in `src/styles.css`.
- **Task:** Set `JetBrains Mono` as the primary font for Headers, Code, and UI elements (Monospace everywhere, or hybrid with Inter for small labels).

### 1.2 "Hard-Edge" Design System (Variables)
- **Task:** Refactor `src/styles/variables.css`:
    - **Colors:** 
        - Rename/Replace Catppuccin palette with "Void Palette".
        - `bg-base` -> `#050505` (Near Pitch Black)
        - `bg-surface` -> `#09090b` (Dark Grey)
        - `primary` -> `#00ff9d` (Cyber Green) or `#ff3333` (Alert Red)
    - **Radius:**
        - Global Reset: Set all `--radius-*` variables to `0px` or `2px`.
    - **Borders:**
        - Define specific border colors for "inactive" vs "active" states (e.g., dark grey vs neon).

---

## Phase 2: Atmosphere & Layout
*Estimated Time: 1 Session*

### 2.1 The "Blueprint" Background
- **Task:** Implement a CSS-only technical grid background in `src/styles.css`.
    - Subtle distinct lines every 20px/40px.
    - Radial gradient fade-out to focus attention on the center.

### 2.2 Shell Hardening
- **Task:** Update `src/components/layout/AppShell.tsx`:
    - Remove all `backdrop-blur` and transparency effects.
    - Enforce solid backgrounds.
    - Add explicit `1px` borders between Sidebar, Titlebar, and Main Content.

### 2.3 Sidebar "Wireframe" Redesign
- **Task:** Rewrite `src/components/Sidebar.tsx`:
    - Remove "Card" looks.
    - List items should look like data rows.
    - Active state: Left neon border indicator, slight background highlight.
    - Section Headers: All caps, monospaced, small size.

---

## Phase 3: The Command Center (Welcome Screen)
*Estimated Time: 1 Session*

### 3.1 Layout Structure
- **Task:** Replace existing `WelcomeScreen` (in `src/App.tsx`) with new `CommandCenter` component.
- **Task:** Abandon `EmptyState` component for this view. Use a custom centered layout.

### 3.2 Visual Components
- **Task:** Implement **Big Title**: `OxideTerm_v1.0` (White, Bold, Mono).
- **Task:** Implement **Status Line**: `STATUS: READY // PROTOCOL: SSH_RUST_CORE`.
- **Task:** Implement **CLI Input**:
    - Full width (max-w-xl).
    - Styling: Transparent background, Neon border, blinking cursor `>_`.
- **Task:** Implement **Keycap Shortcuts**:
    - Rectangular borders.
    - Key combination display (e.g., `[ ⌘ N ]`).

---

## Phase 4: Component Library Polish
*Estimated Time: 1 Session*

### 4.1 Button & Input Overhaul
- **Task:** Update `src/components/ui/Button.tsx`:
    - Variants: `outline` (default), `solid` (hover), `ghost`.
    - Remove hover lifts/shadows.
    - Add "corner markers" (optional decoration).
- **Task:** Update `src/components/ui/Input.tsx`:
    - Remove rounded corners.
    - Focus state: Hard 1px border change (no glow).

### 4.2 Animation Tuning
- **Task:** Simplify `src/lib/animations.ts`:
    - Change `spring` to strict `ease-out` (0.1s).
    - Menu appearing: Instant opacity switch or fast slide.

---

## Implementation Timeline

| Step | Focus | Description |
| :--- | :--- | :--- |
| **01** | **Assets & Vars** | Install font, reset variables, setup grid background. |
| **02** | **App Shell** | De-flesh the sidebar and main layout (remove blurs/rounds). |
| **03** | **Command Center** | Build the new "Homepage" (Input, Title, Status). |
| **04** | **Details** | Fix buttons, inputs, and animations to match. |
