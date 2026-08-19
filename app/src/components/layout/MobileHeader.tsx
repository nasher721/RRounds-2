import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { KeyboardShortcutSystem } from "@/components/KeyboardShortcutSystem";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  rightAction?: React.ReactNode;
  statusText?: string;
  statusTone?: "success" | "warning" | "info";
}

export const MobileHeader = ({
  title,
  subtitle,
  searchQuery = "",
  onSearchChange,
  showSearch = true,
  rightAction,
  statusText,
  statusTone = "info",
}: MobileHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const statusClasses = {
    success: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    warning: "bg-amber-500/10 text-amber-700 border-amber-200",
    info: "bg-blue-500/10 text-blue-700 border-blue-200",
  };

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/30 safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        {isSearchOpen && onSearchChange ? (
          <div className="flex items-center gap-2 flex-1 animate-fade-in">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-10 bg-secondary/40 border-border/30 rounded-xl text-sm"
                autoFocus
                aria-label="Search patients"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearchOpen(false);
                onSearchChange("");
              }}
              className="h-10 w-10 rounded-full"
              aria-label="Close search"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <img src="/icons/favicon-64.png" alt="Rolling Rounds" className="h-7 w-7 rounded-md" />
              <div className="min-w-0">
                <h1 className="text-base font-semibold tracking-tight truncate">{title}</h1>
                {(subtitle || statusText) && (
                  <div className="flex items-center gap-2 min-w-0">
                    {subtitle && (
                      <p className="text-[11px] text-muted-foreground/70 truncate">{subtitle}</p>
                    )}
                    {statusText && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1.5 py-0 rounded-full border font-medium",
                          statusClasses[statusTone]
                        )}
                      >
                        {statusText}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <KeyboardShortcutSystem />
              <ThemeToggle />
              <OfflineIndicator />
              {showSearch && onSearchChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSearchOpen(true)}
                  className="h-11 w-11 rounded-full text-muted-foreground md:h-9 md:w-9"
                  aria-label="Open patient search"
                >
                  <Search className="h-5 w-5 md:h-4.5 md:w-4.5" aria-hidden />
                </Button>
              )}
              {rightAction}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
