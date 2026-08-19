# Plan: Consolidate AI into One Dropdown + Align Imaging Editor

## Overview

1. **Consolidate all AI functions** into a single dropdown within textboxes to reduce toolbar clutter.
2. **Align the imaging text editor** (ImagePasteEditor) with the styling and structure used in RichTextEditor.

---

## Part 1: Consolidate AI into One Dropdown

### Current state

- **RichTextEditor** (`src/components/RichTextEditor.tsx`):
  - **Draft Note** – standalone button (purple, `generateDraft(patient)`).
  - **Sense Check** – standalone button (blue, `processWithAI('documentation_check', …)`).
  - **AppleAIAssistant** – popover with selection-based and document-level AI (DDx, doc check, SOAP, etc.).
  - **DictationButton** – separate mic button.
  - No AITextTools in RichTextEditor.

- **ImagePasteEditor** (`src/components/ImagePasteEditor.tsx`):
  - **AITextTools** – single dropdown (transform, smart expand, medical correct, custom prompts).
  - **DictationButton** – separate.
  - No Draft Note, Sense Check, or AppleAIAssistant.

- **AITextTools** (`src/components/AITextTools.tsx`): Popover with Wand2 trigger; selection-based transforms and GPT-4 actions.
- **AppleAIAssistant** (`src/components/AppleAIAssistant.tsx`): Popover with many features (DDx, documentation check, SOAP, etc.) and optional selection.

### Target state

- **One “AI” dropdown per text editor** that includes:
  - **Selection-based**: Smart expand, Medical correct, Transform (formalize/simplify/etc.), Custom prompts (current AITextTools), and selection-based “Ask AI” / assistant actions (from AppleAIAssistant where applicable).
  - **Document-level**: Draft Note (when `patient` is available), Sense Check (full-document check).
  - **Dictation**: Either one item inside the same dropdown, or keep as a separate one-tap button (recommend keeping separate for speed).

- **RichTextEditor**: Remove standalone Draft Note and Sense Check buttons and remove the standalone AppleAIAssistant trigger; replace with the single unified AI dropdown (and keep DictationButton as-is unless product says otherwise).
- **ImagePasteEditor**: Use the same unified AI dropdown (so imaging gets Draft Note and Sense Check when `patient` is passed); keep DictationButton as-is.

### Implementation approach

1. **Create a unified component** (e.g. `UnifiedAIDropdown` or extend `AITextTools`):
   - **Props**: `getSelectedText`, `replaceSelectedText`, `editorRef` (for full-document actions), `patient` (optional), `section` (optional), `changeTracking` (for `replaceSelectedText` markup if needed).
   - **Trigger**: Single button (e.g. Sparkles or Wand2) labeled “AI” or “AI tools”.
   - **Dropdown content** (sections):
     - **Document-level** (when `patient`): “Draft note”, “Sense check”.
     - **Selection-based**: “Smart expand”, “Medical correct”, “Transform” (submenu or inline: formalize, simplify, etc.), “Custom prompt”, and any AppleAIAssistant selection actions that make sense in this context (e.g. “Ask AI about selection”).
   - Reuse logic from `useAIClinicalAssistant`, `useTextTransform`, and existing AppleAIAssistant handlers; avoid duplicating API calls.

2. **Integration**:
   - **RichTextEditor**: Replace the Draft Note button, Sense Check button, and `<AppleAIAssistant … />` with `<UnifiedAIDropdown … />`. Keep `<DictationButton />` and other toolbar items unchanged.
   - **ImagePasteEditor**: Replace `<AITextTools … />` with `<UnifiedAIDropdown … />` (same component), passing `patient` and `editorRef` so Draft Note and Sense Check work when available.

3. **Optional**: Move Dictation into the same dropdown as an item; if so, ensure one-tap access (e.g. first item or “Start dictation”) and no extra click for common use.

### Files to touch (Part 1)

- Add: `src/components/UnifiedAIDropdown.tsx` (or extend `AITextTools.tsx` and rename/export as the single entry point).
- Edit: `src/components/RichTextEditor.tsx` – remove Draft Note button, Sense Check button, AppleAIAssistant; add UnifiedAIDropdown; keep DictationButton.
- Edit: `src/components/ImagePasteEditor.tsx` – replace AITextTools with UnifiedAIDropdown; pass `patient`, `editorRef`, and same getSelectedText/replaceSelectedText/changeTracking as today.

---

## Part 2: Align Imaging Text Editor with Other Text Editors

### Reference: RichTextEditor patterns

- **Outer wrapper**: `className={cn("border border-border/50 rounded-lg bg-card relative h-auto shadow-card", className)}`
- **Toolbar**: `role="toolbar" aria-label="Text formatting"` and `className="flex items-center gap-1.5 p-2 border-b border-border/50 bg-muted/40 rounded-t-lg flex-wrap"`
- **Editor area order**: Toolbar → scroll container (contentEditable) → EditorStatusBar.
- **Scroll container**: `className={cn("max-h-[380px] overflow-y-auto editor-scroll-container relative", …)}`
- **ContentEditable**: `role="textbox" aria-multiline="true" aria-label={section ? \`${section} notes\` : placeholder}`, `className="p-3 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-0 … min-h-[120px]"`, `prose prose-sm max-w-none … text-foreground`
- **EditorStatusBar**: Rendered **below** the editor content (after the scroll container).

### ImagePasteEditor today

- Wrapper: `border border-border/50 rounded-lg bg-card relative h-auto transition-colors shadow-card` – already close; can align to use `shadow-card` if RichTextEditor uses it.
- Toolbar: No `role="toolbar"` or `aria-label`; different spacing (`gap-1`, `h-6` vs `h-7`). No `rounded-t-lg` or `bg-muted/40` on toolbar.
- **EditorStatusBar**: Rendered **above** the editor content (between toolbar and thumbnails/scroll area). Should be moved **below** the content to match RichTextEditor.
- Scroll container: `max-h-[300px]`; contentEditable has `p-2`, `min-h-[80px]`, `focus:ring-ring/50`, no `rounded-b-lg`, no role/aria.

### Changes to apply in ImagePasteEditor

1. **Toolbar**
   - Add `role="toolbar"` and `aria-label="Text formatting"` to the toolbar container.
   - Use same toolbar strip styling as RichTextEditor: `rounded-t-lg`, `bg-muted/40`, `gap-1.5`, `p-2`, and consistent button size (e.g. `h-7 w-7` where appropriate) so it matches other editors.

2. **Editor area order**
   - Order should be: **Toolbar → (optional thumbnail gallery) → Scroll container (contentEditable) → EditorStatusBar**.
   - Move `EditorStatusBar` from its current position (above the scroll container) to **below** the scroll container, matching RichTextEditor.

3. **Scroll container**
   - Keep `max-h-[300px]` for imaging if desired (to leave room for thumbnails), or align to `max-h-[380px]` for consistency; document the choice. Ensure class remains `editor-scroll-container` for find/replace and any shared CSS.

4. **ContentEditable**
   - Add `role="textbox"`, `aria-multiline="true"`, `aria-label={section ? \`${section} notes\` : placeholder}`.
   - Align styling: `p-3`, `rounded-b-lg`, `focus:ring-2 focus:ring-primary/30 focus:ring-offset-0`, `prose prose-sm max-w-none … text-foreground`.
   - Use `min-h-[120px]` for consistency with RichTextEditor, or keep `min-h-[80px]` if product prefers a shorter imaging box; state in plan.

5. **Wrapper**
   - Use same wrapper as RichTextEditor: `border border-border/50 rounded-lg bg-card relative h-auto shadow-card` (and `className` prop if applicable).

### Files to touch (Part 2)

- `src/components/ImagePasteEditor.tsx` – toolbar attributes and classes, move EditorStatusBar, contentEditable attributes and classes, wrapper class.

---

## Suggested implementation order

1. **Part 2 first** (imaging editor alignment): Pure UI/structure changes; no new component. Delivers consistent look and behavior with other text editors.
2. **Part 1** (unified AI dropdown): Add or extend component, then wire into RichTextEditor and ImagePasteEditor. Test Draft Note and Sense Check in both editors when `patient` is present.

---

## Acceptance criteria

- **Part 1**: All AI actions (Draft note, Sense check, selection transforms, smart expand, medical correct, custom prompts, and any migrated AppleAIAssistant selection actions) are available from a single “AI” dropdown in both RichTextEditor and ImagePasteEditor. No standalone AI buttons other than the single dropdown (and optionally Dictation).
- **Part 2**: ImagePasteEditor’s toolbar has the same role, aria-label, and visual treatment as RichTextEditor; EditorStatusBar is below the content; contentEditable has matching focus ring, padding, rounding, and accessibility attributes; wrapper matches.
