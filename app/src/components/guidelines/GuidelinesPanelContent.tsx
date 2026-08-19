/**
 * Clinical Guidelines Panel Content
 * Main UI for browsing and searching clinical guidelines
 */

import React, { useState, memo } from 'react';
import { Search, FileText, Star, Clock, X, ChevronRight, ExternalLink, Keyboard, Loader2, Building2, Stethoscope } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClinicalGuidelinesState } from '@/contexts/ClinicalGuidelinesContext';
import { SPECIALTY_MAP, GUIDELINE_ORGANIZATIONS, type MedicalSpecialty } from '@/types/clinicalGuidelines';
import type { ClinicalGuideline } from '@/types/clinicalGuidelines';
import { GuidelineDetailView } from './GuidelineDetailView';
import { cn } from '@/lib/utils';

// Memoized Guideline Card for better list performance
const GuidelineCard = memo(function GuidelineCard({
  guideline,
  onClick,
  isBookmarked,
  matchedKeywords
}: {
  guideline: ClinicalGuideline;
  onClick: () => void;
  isBookmarked: boolean;
  matchedKeywords?: string[];
}) {
  const specialtyInfo = SPECIALTY_MAP[guideline.specialty];

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
            <span className="text-sm">{specialtyInfo?.icon || '📋'}</span>
            <h3 className="font-medium text-sm truncate">{guideline.shortTitle}</h3>
            {isBookmarked && (
              <Star className="h-3 w-3 text-warning fill-warning flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {guideline.organization.abbreviation}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{guideline.year}</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{guideline.summary}</p>
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

function GuidelinesPanelContent() {
  const {
    activeGuideline,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    filteredGuidelines,
    bookmarkedGuidelines,
    recentGuidelines,
    activeSpecialty,
    activeOrganization,
    closePanel,
    viewGuideline,
    closeGuideline,
    toggleBookmark,
    setActiveSpecialty,
    setActiveOrganization,
    isBookmarked,
  } = useClinicalGuidelinesState();

  const [activeTab, setActiveTab] = useState<'browse' | 'bookmarks' | 'recent'>('browse');

  // Show guideline detail view if a guideline is selected
  if (activeGuideline) {
    return (
      <div className="h-full w-full bg-card flex flex-col animate-fade-in relative z-10">
        <GuidelineDetailView
          guideline={activeGuideline}
          isBookmarked={isBookmarked(activeGuideline.id)}
          onToggleBookmark={() => toggleBookmark(activeGuideline.id)}
          onClose={closeGuideline}
        />
      </div>
    );
  }

  // Get unique specialties and organizations from guidelines
  const availableSpecialties = Object.keys(SPECIALTY_MAP) as MedicalSpecialty[];
  const availableOrgs = GUIDELINE_ORGANIZATIONS.slice(0, 8); // Show top organizations

  return (
    <div className="h-full w-full bg-card flex flex-col animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-sm">Clinical Guidelines</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Keyboard: Ctrl+G">
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search guidelines by diagnosis, condition..."
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

      <ScrollArea className="flex-1">
        {/* Search Results */}
        {searchResults && searchResults.length > 0 ? (
          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              {searchResults.length} guideline{searchResults.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-2">
              {searchResults.map(result => (
                <GuidelineCard
                  key={result.guideline.id}
                  guideline={result.guideline}
                  onClick={() => viewGuideline(result.guideline)}
                  isBookmarked={isBookmarked(result.guideline.id)}
                  matchedKeywords={result.matchedKeywords}
                />
              ))}
            </div>
          </div>
        ) : searchQuery && !isSearching ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No guidelines found for "{searchQuery}"</p>
            <p className="text-xs mt-1">Try different keywords or browse by specialty</p>
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
                Saved
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
              {/* Specialty Pills */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">By Specialty</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableSpecialties.slice(0, 12).map(specialty => {
                    const info = SPECIALTY_MAP[specialty];
                    return (
                      <Badge
                        key={specialty}
                        variant={activeSpecialty === specialty ? 'default' : 'outline'}
                        className="cursor-pointer text-xs transition-colors"
                        onClick={() => setActiveSpecialty(activeSpecialty === specialty ? null : specialty)}
                      >
                        {info.icon} {info.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Organization Pills */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">By Organization</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableOrgs.map(org => (
                    <Badge
                      key={org.id}
                      variant={activeOrganization === org.id ? 'default' : 'outline'}
                      className="cursor-pointer text-xs transition-colors"
                      onClick={() => setActiveOrganization(activeOrganization === org.id ? null : org.id)}
                    >
                      {org.abbreviation}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Guideline List */}
              <div className="space-y-2">
                {filteredGuidelines.map(guideline => (
                  <GuidelineCard
                    key={guideline.id}
                    guideline={guideline}
                    onClick={() => viewGuideline(guideline)}
                    isBookmarked={isBookmarked(guideline.id)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="bookmarks" className="mt-0 p-4">
              {bookmarkedGuidelines.length > 0 ? (
                <div className="space-y-2">
                  {bookmarkedGuidelines.map(guideline => (
                    <GuidelineCard
                      key={guideline.id}
                      guideline={guideline}
                      onClick={() => viewGuideline(guideline)}
                      isBookmarked={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No saved guidelines</p>
                  <p className="text-xs mt-1">Star guidelines to save them here</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="recent" className="mt-0 p-4">
              {recentGuidelines.length > 0 ? (
                <div className="space-y-2">
                  {recentGuidelines.map(guideline => (
                    <GuidelineCard
                      key={guideline.id}
                      guideline={guideline}
                      onClick={() => viewGuideline(guideline)}
                      isBookmarked={isBookmarked(guideline.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent guidelines</p>
                  <p className="text-xs mt-1">Your viewing history will appear here</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-secondary/30 text-center">
        <p className="text-xs text-muted-foreground">
          Guidelines sourced from AHA/ACC, ESC, IDSA, SCCM, ADA, and more
        </p>
      </div>
    </div>
  );
}

export default memo(GuidelinesPanelContent);
