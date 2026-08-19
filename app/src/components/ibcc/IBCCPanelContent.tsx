/**
 * IBCC Panel Content
 * The actual panel UI - lazy loaded for performance
 */

import React, { useState, memo } from 'react';
import { Search, BookOpen, Star, Clock, X, ChevronRight, ExternalLink, Keyboard, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIBCCState } from '@/contexts/IBCCContext';
import { useLazyData } from '@/lib/lazyData';
import type { IBCCChapter, IBCCCategory, MedicalSystem } from '@/types/ibcc';
import { IBCCChapterView } from './IBCCChapterView';
import { cn } from '@/lib/utils';

// Memoized Chapter Card for better list performance
const ChapterCard = memo(function ChapterCard({
  chapter,
  onClick,
  isBookmarked,
  matchedKeywords
}: {
  chapter: IBCCChapter;
  onClick: () => void;
  isBookmarked: boolean;
  matchedKeywords?: string[];
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group p-3 rounded-lg border cursor-pointer transition-all",
        "bg-card hover:bg-secondary/50 border-border hover:border-primary/30",
        "hover:shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{chapter.category.icon}</span>
            <h3 className="font-medium text-sm truncate">{chapter.title}</h3>
            {isBookmarked && (
              <Star className="h-3 w-3 text-warning fill-warning flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{chapter.summary}</p>
          {matchedKeywords && matchedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {matchedKeywords.slice(0, 3).map(kw => (
                <Badge key={kw} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {kw}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1" />
      </div>
    </div>
  );
});

function IBCCPanelContent() {
  const {
    activeChapter,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    filteredChapters,
    contextSuggestions,
    detailedMatches,
    bookmarkedChapters,
    recentChapters,
    activeCategory,
    activeSystem,
    closePanel,
    viewChapter,
    closeChapter,
    toggleBookmark,
    setActiveCategory,
    setActiveSystem,
    isBookmarked,
    getCalculatorsForChapter,
    getChecklistsForChapter,
  } = useIBCCState();

  // Lazy-load category/system config
  const { data: ibccConfig } = useLazyData(
    () => import('@/data/ibccContent'),
    (mod) => ({ categories: mod.IBCC_CATEGORIES, systemMap: mod.MEDICAL_SYSTEM_MAP }),
  );
  const IBCC_CATEGORIES: IBCCCategory[] = ibccConfig?.categories ?? [];
  const MEDICAL_SYSTEM_MAP: Record<string, { label: string; icon: string }> = ibccConfig?.systemMap ?? {};

  const [activeTab, setActiveTab] = useState<'browse' | 'bookmarks' | 'recent'>('browse');

  // Show chapter view if a chapter is selected
  if (activeChapter) {
    return (
      <div className="h-full w-full bg-card flex flex-col animate-fade-in relative z-10">
        <IBCCChapterView
          chapter={activeChapter}
          isBookmarked={isBookmarked(activeChapter.id)}
          onToggleBookmark={() => toggleBookmark(activeChapter.id)}
          onClose={closeChapter}
          calculators={getCalculatorsForChapter(activeChapter.id)}
          checklists={getChecklistsForChapter(activeChapter.id)}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-card flex flex-col animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-sm">Clinical Reference</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Keyboard: Ctrl+I">
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search IBCC chapters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-secondary/50 border-0"
            autoFocus
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {contextSuggestions.length > 0 && !searchQuery && (
        <div className="p-4 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-primary">📋 Suggested for Current Patient</span>
            <Badge variant="secondary" className="text-[10px]">
              {contextSuggestions.length} found
            </Badge>
          </div>
          <div className="space-y-2">
            {detailedMatches && detailedMatches.length > 0 ? (
              detailedMatches.slice(0, 4).map((match) => (
                <div
                  key={match.chapter.id}
                  className="p-3 rounded-lg border cursor-pointer transition-all bg-card hover:bg-secondary/50 border-border hover:border-primary/30"
                  onClick={() => viewChapter(match.chapter)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{match.chapter.category.icon}</span>
                        <span className="font-medium text-sm">{match.chapter.title}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {match.matchReasons.slice(0, 2).map((reason, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge
                      variant={match.relevanceScore >= 5 ? 'default' : 'secondary'}
                      className="text-[10px] flex-shrink-0"
                    >
                      {match.relevanceScore} pts
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-wrap gap-2">
                {contextSuggestions.map(chapter => (
                  <Badge
                    key={chapter.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 border-primary/30 text-primary transition-colors"
                    onClick={() => viewChapter(chapter)}
                  >
                    {chapter.category.icon} {chapter.title}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {/* Search Results */}
        {searchResults && searchResults.length > 0 ? (
          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-2">
              {searchResults.map(result => (
                <ChapterCard
                  key={result.chapter.id}
                  chapter={result.chapter}
                  onClick={() => viewChapter(result.chapter)}
                  isBookmarked={isBookmarked(result.chapter.id)}
                  matchedKeywords={result.matchedKeywords}
                />
              ))}
            </div>
          </div>
        ) : searchQuery && !isSearching ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No chapters found for "{searchQuery}"</p>
            <p className="text-xs mt-1">Try different keywords</p>
          </div>
        ) : !searchQuery ? (
          /* Tabs: Browse / Bookmarks / Recent */
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="browse"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Browse
              </TabsTrigger>
              <TabsTrigger
                value="bookmarks"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Star className="h-3 w-3 mr-1" />
                Bookmarks
              </TabsTrigger>
              <TabsTrigger
                value="recent"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Clock className="h-3 w-3 mr-1" />
                Recent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-0 p-4">
              {/* Category Pills */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">By Category</p>
                <div className="flex flex-wrap gap-1.5">
                  {IBCC_CATEGORIES.map(cat => (
                    <Badge
                      key={cat.id}
                      variant={activeCategory === cat.id ? 'default' : 'outline'}
                      className="cursor-pointer text-xs transition-colors"
                      onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                    >
                      {cat.icon} {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* System Pills */}
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">By System</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(MEDICAL_SYSTEM_MAP) as MedicalSystem[]).map(system => {
                    const { label, icon } = MEDICAL_SYSTEM_MAP[system];
                    return (
                      <Badge
                        key={system}
                        variant={activeSystem === system ? 'default' : 'outline'}
                        className="cursor-pointer text-xs transition-colors"
                        onClick={() => setActiveSystem(activeSystem === system ? null : system)}
                      >
                        {icon} {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Chapter List */}
              <div className="space-y-2">
                {filteredChapters.map(chapter => (
                  <ChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    onClick={() => viewChapter(chapter)}
                    isBookmarked={isBookmarked(chapter.id)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="bookmarks" className="mt-0 p-4">
              {bookmarkedChapters.length > 0 ? (
                <div className="space-y-2">
                  {bookmarkedChapters.map(chapter => (
                    <ChapterCard
                      key={chapter.id}
                      chapter={chapter}
                      onClick={() => viewChapter(chapter)}
                      isBookmarked={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No bookmarks yet</p>
                  <p className="text-xs mt-1">Star chapters to save them here</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="recent" className="mt-0 p-4">
              {recentChapters.length > 0 ? (
                <div className="space-y-2">
                  {recentChapters.map(chapter => (
                    <ChapterCard
                      key={chapter.id}
                      chapter={chapter}
                      onClick={() => viewChapter(chapter)}
                      isBookmarked={isBookmarked(chapter.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent chapters</p>
                  <p className="text-xs mt-1">Your viewing history will appear here</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-secondary/30 text-center">
        <a
          href="https://emcrit.org/ibcc/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
        >
          Powered by EMCrit IBCC
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export default memo(IBCCPanelContent);
