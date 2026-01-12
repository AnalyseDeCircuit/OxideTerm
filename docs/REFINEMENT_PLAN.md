# OxideTerm UI Refinement Plan: Practical Hybrid

**Vision:** Reconcile "Industrial Aesthetic" with "macOS Usability". Remove decorative noise (gradients), fix usability regressions (tiny targets, hard-to-read fonts), and adopt established sidebar patterns.

**Changes:**
1.  **Remove Gradients:** Clean up all gradients from borders and backgrounds.
2.  **Fix Sidebar Usability:** 
    - Restore familiar row heights and click targets.
    - Switch active state to full-row highlight (macOS style).
    - Use Sans-Serif (Inter) for primary labels for readability.
3.  **Refine Grid:** Make background grid subtle and uniform (no radial mask).

---

## 1. Clean Styles (No Gradients)
**Target:** `src/styles.css`
- **Action:** Update `.bg-grid-pattern`. Remove `mask-image`. Reduce opacity to `0.02`. Change lines to solid uniform color.

## 2. Sidebar Usability Overhaul
**Target:** `src/components/layout/Sidebar/Sidebar.tsx`

### 2.1 Connection Item (The "Row")
- **Typography:** Name -> `font-sans text-sm font-normal`. Host -> `font-mono text-xs opacity-60`.
- **Layout:** `h-8` or `py-1.5` for standard density.
- **Active State:** Solid background block (`bg-surface2` or similar) instead of border-l.
- **Hover State:** Subtle `bg-surface1`.

### 2.2 Section Headers
- **Design:** Uppercase, smaller tracking, muted color. Distinct from items.

### 2.3 Search & Footer
- **Search:** Clean input field, no fancy underlinings.
- **Footer:** Return to icon-based but clearer layout.

## 3. Global Polish
**Target:** `src/components/layout/AppShell.tsx`
- **Action:** Ensure `AppShellSidebar` uses a solid, high-contrast border-r (`border-surface1`), absolutely no gradient.

---
**Timeline:**
1.  Edit `Sidebar.tsx` (Component logic & formatting).
2.  Edit `styles.css` (Background & global cleanups).
