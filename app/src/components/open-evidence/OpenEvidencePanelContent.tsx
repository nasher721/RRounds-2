/**
 * Open Evidence Panel Content
 * A single search box that hands off to openevidence.com's own search
 * results in a new tab, plus a short local history of recent searches.
 * There is no embedded results view — Open Evidence has no public search
 * API, so this stays an honest, clearly-labeled deep link rather than a
 * fake in-app results list.
 */

import React, { memo, useState } from "react";
import { Search, Microscope, X, Keyboard, Clock, ExternalLink, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOpenEvidenceState } from "@/hooks/useOpenEvidenceState";

function OpenEvidencePanelContent() {
  const { query, setQuery, search, recentSearches, clearRecentSearches, closePanel } = useOpenEvidenceState();
  const [justSearchedFor, setJustSearchedFor] = useState<string | null>(null);

  const runSearch = (value: string) => {
    if (search(value)) {
      setJustSearchedFor(value.trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  return (
    <div className="h-full w-full bg-card flex flex-col animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <Microscope className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="font-semibold text-sm">Open Evidence</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={closePanel}
            aria-label="Close Open Evidence"
            title="Close Open Evidence (Esc)"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Keyboard: Ctrl+E">
            <Keyboard className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSubmit} className="p-4 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search Open Evidence, e.g. DOAC vs warfarin in AFib"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setJustSearchedFor(null);
            }}
            className="pl-10 bg-secondary/50 border-0"
            aria-label="Search Open Evidence"
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={!query.trim()}>
          <ExternalLink className="h-4 w-4" aria-hidden />
          Search Open Evidence
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Opens openevidence.com in a new tab. Don&apos;t include patient names or other identifiers in your search.
        </p>
        {justSearchedFor && (
          <p className="text-[11px] text-primary" role="status">
            Opened Open Evidence search for &ldquo;{justSearchedFor}&rdquo;.
          </p>
        )}
      </form>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden />
              Recent searches
            </div>
            {recentSearches.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground gap-1"
                onClick={clearRecentSearches}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Clear
              </Button>
            )}
          </div>

          {recentSearches.length > 0 ? (
            <div className="space-y-1.5">
              {recentSearches.map((recent) => (
                <button
                  key={recent}
                  type="button"
                  onClick={() => {
                    setQuery(recent);
                    runSearch(recent);
                  }}
                  className="group flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/50 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden />
                  <span className="truncate flex-1">{recent}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Microscope className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden />
              <p className="text-sm">No recent searches</p>
              <p className="text-xs mt-1">Highlight text in a note or search above to look up evidence.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-secondary/30 text-center">
        <p className="text-xs text-muted-foreground">
          Search results open directly on openevidence.com in a new tab
        </p>
      </div>
    </div>
  );
}

export default memo(OpenEvidencePanelContent);
