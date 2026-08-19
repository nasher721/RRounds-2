/**
 * Phrase Picker - Context menu for selecting and inserting clinical phrases
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Folder, 
  FileText, 
  Clock, 
  Zap, 
  ChevronRight,
  Keyboard,
  Search,
  Sparkles,
} from 'lucide-react';
import type { ClinicalPhrase, PhraseFolder } from '@/types/phrases';
import { useAuth } from '@/hooks/useAuth';
import { recallMemories, type HindsightFilters } from '@/lib/hindsightClient';

interface PhrasePickerProps {
  phrases: ClinicalPhrase[];
  folders: PhraseFolder[];
  trigger: React.ReactNode;
  onSelect: (phrase: ClinicalPhrase) => void;
  context?: {
    noteType?: string;
    section?: string;
  };
}

export const PhrasePicker: React.FC<PhrasePickerProps> = ({
  phrases,
  folders,
  trigger,
  onSelect,
  context,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const { user } = useAuth();
  const [preferredPhraseIds, setPreferredPhraseIds] = useState<Set<string>>(new Set());

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedFolder(null);
      setPreferredPhraseIds(new Set());
    }
  }, [open]);

  // Load preferred phrases from Hindsight when opened
  useEffect(() => {
    const loadPreferences = async () => {
      if (!open || !user) return;

      const bankId = `clinician:${user.id}`;
      const filters: HindsightFilters = { feature: 'phrases' };
      if (context?.noteType) {
        filters.noteType = context.noteType;
      }
      if (context?.section) {
        filters.section = context.section;
      }

      const recalled = await recallMemories({
        bankId,
        query: 'phrase and template preferences for this clinician and context',
        filters,
        limit: 20,
      });

      if (!recalled?.memories) {
        setPreferredPhraseIds(new Set());
        return;
      }

      const ids = new Set<string>();
      for (const memory of recalled.memories) {
        const meta = memory.metadata as { phraseId?: string } | undefined;
        if (meta?.phraseId) {
          ids.add(meta.phraseId);
        }
      }
      setPreferredPhraseIds(ids);
    };

    void loadPreferences();
  }, [open, user, context?.noteType, context?.section]);

  // Build folder tree
  const folderTree = useMemo(() => {
    const map = new Map<string, PhraseFolder & { children: PhraseFolder[] }>();
    const roots: (PhraseFolder & { children: PhraseFolder[] })[] = [];

    folders.forEach(f => {
      map.set(f.id, { ...f, children: [] });
    });

    folders.forEach(f => {
      const folder = map.get(f.id)!;
      if (f.parentId && map.has(f.parentId)) {
        map.get(f.parentId)!.children.push(folder);
      } else {
        roots.push(folder);
      }
    });

    return roots;
  }, [folders]);

  // Filter phrases by folder and search
  const filteredPhrases = useMemo(() => {
    let result = phrases.filter(p => p.isActive);

    if (selectedFolder) {
      result = result.filter(p => p.folderId === selectedFolder);
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(lowerSearch) ||
        p.shortcut?.toLowerCase().includes(lowerSearch) ||
        p.content.toLowerCase().includes(lowerSearch)
      );
    }

    if (preferredPhraseIds.size > 0) {
      result = [...result].sort((a, b) => {
        const aPref = preferredPhraseIds.has(a.id) ? 1 : 0;
        const bPref = preferredPhraseIds.has(b.id) ? 1 : 0;
        return bPref - aPref;
      });
    }

    return result;
  }, [phrases, selectedFolder, search, preferredPhraseIds]);

  // Context-matched phrases
  const contextPhrases = useMemo(() => {
    if (!context?.noteType && !context?.section) return [];
    
    const base = phrases.filter(p => {
      if (!p.isActive || !p.contextTriggers) return false;
      
      const matchesNoteType = !context.noteType || 
        !p.contextTriggers.noteType?.length ||
        p.contextTriggers.noteType.includes(context.noteType);
      
      const matchesSection = !context.section ||
        !p.contextTriggers.section?.length ||
        p.contextTriggers.section.includes(context.section);

      return matchesNoteType && matchesSection && 
        (p.contextTriggers.noteType?.length || p.contextTriggers.section?.length);
    });
    if (preferredPhraseIds.size === 0) {
      return base;
    }
    return [...base].sort((a, b) => {
      const aPref = preferredPhraseIds.has(a.id) ? 1 : 0;
      const bPref = preferredPhraseIds.has(b.id) ? 1 : 0;
      return bPref - aPref;
    });
  }, [phrases, context, preferredPhraseIds]);

  // Recent phrases (sorted by last used)
  const recentPhrases = useMemo(() => {
    const base = phrases
      .filter(p => p.isActive && p.lastUsedAt)
      .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())
      .slice(0, 5);
    if (preferredPhraseIds.size === 0) {
      return base;
    }
    return [...base].sort((a, b) => {
      const aPref = preferredPhraseIds.has(a.id) ? 1 : 0;
      const bPref = preferredPhraseIds.has(b.id) ? 1 : 0;
      return bPref - aPref;
    });
  }, [phrases, preferredPhraseIds]);

  // Frequently used phrases
  const frequentPhrases = useMemo(() => {
    const base = phrases
      .filter(p => p.isActive && p.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
    if (preferredPhraseIds.size === 0) {
      return base;
    }
    return [...base].sort((a, b) => {
      const aPref = preferredPhraseIds.has(a.id) ? 1 : 0;
      const bPref = preferredPhraseIds.has(b.id) ? 1 : 0;
      return bPref - aPref;
    });
  }, [phrases, preferredPhraseIds]);

  const handleSelect = useCallback((phrase: ClinicalPhrase) => {
    onSelect(phrase);
    setOpen(false);
  }, [onSelect]);

  const renderPhraseItem = (phrase: ClinicalPhrase, showFolder = false) => (
    <CommandItem
      key={phrase.id}
      value={`${phrase.name} ${phrase.shortcut || ''}`}
      onSelect={() => handleSelect(phrase)}
      className="flex items-start gap-2 py-2"
    >
      <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{phrase.name}</span>
          {phrase.shortcut && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {phrase.shortcut}
            </Badge>
          )}
          {phrase.hotkey && (
            <Badge variant="outline" className="text-xs shrink-0">
              <Keyboard className="h-3 w-3 mr-1" />
              {phrase.hotkey}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {phrase.content.slice(0, 80)}...
        </p>
        {showFolder && phrase.folderId && (
          <div className="flex items-center gap-1 mt-1">
            <Folder className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {folders.find(f => f.id === phrase.folderId)?.name}
            </span>
          </div>
        )}
      </div>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,calc(100vw-1rem))] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search phrases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <ScrollArea className="h-[350px]">
              <CommandEmpty>No phrases found.</CommandEmpty>

              {/* Folder navigation */}
              {!search && !selectedFolder && folderTree.length > 0 && (
                <>
                  <CommandGroup heading="Folders">
                    {folderTree.map(folder => (
                      <CommandItem
                        key={folder.id}
                        onSelect={() => setSelectedFolder(folder.id)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-primary" />
                          <span>{folder.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {phrases.filter(p => p.folderId === folder.id).length}
                          </Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Back button when in folder */}
              {selectedFolder && (
                <>
                  <CommandGroup>
                    <CommandItem onSelect={() => setSelectedFolder(null)}>
                      <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                      Back to folders
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Context suggestions */}
              {!search && !selectedFolder && contextPhrases.length > 0 && (
                <>
                  <CommandGroup heading={
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Suggested for this context
                    </span>
                  }>
                    {contextPhrases.slice(0, 3).map(p => renderPhraseItem(p, true))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Recent phrases */}
              {!search && !selectedFolder && recentPhrases.length > 0 && (
                <>
                  <CommandGroup heading={
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Recent
                    </span>
                  }>
                    {recentPhrases.map(p => renderPhraseItem(p))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Frequent phrases */}
              {!search && !selectedFolder && frequentPhrases.length > 0 && (
                <>
                  <CommandGroup heading={
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Frequently used
                    </span>
                  }>
                    {frequentPhrases.map(p => renderPhraseItem(p))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Filtered/All phrases */}
              {(search || selectedFolder) && (
                <CommandGroup heading={selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Results'}>
                  {filteredPhrases.map(p => renderPhraseItem(p, !!search))}
                </CommandGroup>
              )}

              {/* All phrases when no folder selected */}
              {!search && !selectedFolder && (
                <CommandGroup heading="All Phrases">
                  {phrases.filter(p => p.isActive && !p.folderId).map(p => renderPhraseItem(p))}
                </CommandGroup>
              )}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
