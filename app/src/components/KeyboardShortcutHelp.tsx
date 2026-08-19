import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Keyboard, Search, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shortcut definition for the reference list */
interface ShortcutDefinition {
  id: string;
  name: string;
  keys: string;
  description: string;
  category: 'global' | 'navigation' | 'patient' | 'actions';
}

/** All documented shortcuts organized by category */
export const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
  // Global shortcuts
  { id: 'help', name: 'Show Shortcuts', keys: '?', description: 'Open this help dialog', category: 'global' },
  { id: 'esc', name: 'Close Modal', keys: 'Esc', description: 'Close any open dialog or panel', category: 'global' },
  { id: 'save', name: 'Save', keys: 'Cmd+S', description: 'Save current changes', category: 'global' },
  { id: 'copy', name: 'Copy', keys: 'Cmd+C', description: 'Copy selected text', category: 'global' },
  { id: 'paste', name: 'Paste', keys: 'Cmd+V', description: 'Paste from clipboard', category: 'global' },
  { id: 'undo', name: 'Undo', keys: 'Cmd+Z', description: 'Undo last action', category: 'global' },
  { id: 'redo', name: 'Redo', keys: 'Cmd+Shift+Z', description: 'Redo last action', category: 'global' },

  // Navigation shortcuts
  { id: 'quick-search', name: 'Quick Search', keys: 'Cmd+K', description: 'Focus patient search', category: 'navigation' },
  { id: 'focus-search-slash', name: 'Focus Search', keys: '/', description: 'Focus patient search (not in text fields)', category: 'navigation' },
  { id: 'next-patient', name: 'Next Patient', keys: 'Cmd+]', description: 'Navigate to next patient', category: 'navigation' },
  { id: 'prev-patient', name: 'Previous Patient', keys: 'Cmd+[', description: 'Navigate to previous patient', category: 'navigation' },
  { id: 'find', name: 'Find in Page', keys: 'Cmd+F', description: 'Search within current page', category: 'navigation' },
  { id: 'toggle-sidebar', name: 'Toggle Sidebar', keys: 'Cmd+B', description: 'Show or hide sidebar', category: 'navigation' },

  // Patient shortcuts
  { id: 'add-patient', name: 'Add Patient', keys: 'N', description: 'Create new patient (not in text fields)', category: 'patient' },
  { id: 'quick-add-patient', name: 'Quick Add', keys: 'Cmd+Shift+N', description: 'Open add patient dialog', category: 'patient' },
  { id: 'collapse-all', name: 'Collapse All', keys: 'Cmd+Shift+C', description: 'Collapse all patient cards', category: 'patient' },

  // Action shortcuts
  { id: 'print-export', name: 'Print / Export', keys: 'Cmd+P', description: 'Open print and export dialog', category: 'actions' },
  { id: 'ai-command', name: 'AI Workspace', keys: 'Cmd+Shift+A', description: 'Open AI command palette', category: 'actions' },
  { id: 'quick-reference', name: 'Quick Reference', keys: 'Cmd+R', description: 'Open IBCC and clinical guidelines', category: 'actions' },
  { id: 'bold', name: 'Bold', keys: 'Cmd+B', description: 'Format text as bold', category: 'actions' },
  { id: 'italic', name: 'Italic', keys: 'Cmd+I', description: 'Format text as italic', category: 'actions' },
];

const CATEGORY_LABELS: Record<ShortcutDefinition['category'], string> = {
  global: 'Global',
  navigation: 'Navigation',
  patient: 'Patient',
  actions: 'Actions',
};

const CATEGORY_ORDER: ShortcutDefinition['category'][] = ['global', 'navigation', 'patient', 'actions'];

interface KeyboardShortcutHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Keyboard shortcut reference modal - searchable and organized by category */
export function KeyboardShortcutHelp({ open, onOpenChange }: KeyboardShortcutHelpProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  React.useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is mounted
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [open]);

  // Filter shortcuts based on search query
  const filteredShortcuts = React.useMemo(() => {
    if (!searchQuery.trim()) return KEYBOARD_SHORTCUTS;
    
    const query = searchQuery.toLowerCase();
    return KEYBOARD_SHORTCUTS.filter(shortcut =>
      shortcut.name.toLowerCase().includes(query) ||
      shortcut.keys.toLowerCase().includes(query) ||
      shortcut.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group shortcuts by category
  const groupedShortcuts = React.useMemo(() => {
    const groups: Record<string, ShortcutDefinition[]> = {};
    
    filteredShortcuts.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });
    
    return groups;
  }, [filteredShortcuts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-sm">
            Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">?</kbd> anytime to open this reference. Use the search below to find specific shortcuts.
          </DialogDescription>
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              ref={inputRef}
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
              aria-label="Search keyboard shortcuts"
            />
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-2">
            {CATEGORY_ORDER.map(category => {
              const shortcuts = groupedShortcuts[category];
              if (!shortcuts?.length) return null;
              
              return (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {shortcuts.length}
                    </Badge>
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <div className="space-y-1.5">
                    {shortcuts.map(shortcut => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">
                            {highlightMatch(shortcut.name, searchQuery)}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {highlightMatch(shortcut.description, searchQuery)}
                          </p>
                        </div>
                        <kbd className="ml-4 shrink-0 rounded border bg-muted px-2 py-1 font-mono text-xs font-medium text-foreground shadow-sm">
                          {shortcut.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {filteredShortcuts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No shortcuts found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-2 pt-4 border-t text-xs text-muted-foreground">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Shortcuts with "/" or "N" only work when not focused in text fields</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Highlight matching text in search results */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  
  if (matchIndex === -1) return text;
  
  return (
    <>
      {text.slice(0, matchIndex)}
      <mark className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {text.slice(matchIndex, matchIndex + query.length)}
      </mark>
      {text.slice(matchIndex + query.length)}
    </>
  );
}

/** Hook to manage the keyboard shortcut help dialog state */
export function useKeyboardShortcutHelp() {
  const [isOpen, setIsOpen] = React.useState(false);

  // Global keyboard handler for ? key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if ? is pressed and not in an input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable ||
                      target.closest('[contenteditable="true"]') ||
                      target.closest('.ProseMirror'); // TipTap/editor

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !isInput) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
}
