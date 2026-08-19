import * as React from "react";
import { Home, Plus, BookOpen, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type MobileTab = "patients" | "add" | "reference" | "settings";

interface MobileNavigationProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  patientCount?: number;
  alertCount?: number;
}

export const MobileNavigation = ({
  activeTab,
  onTabChange,
  patientCount = 0,
  alertCount = 0,
}: MobileNavigationProps) => {
  const tabs: {
    id: MobileTab;
    label: string;
    icon: LucideIcon;
    badge?: number;
  }[] = [
    {
      id: "patients",
      label: "Patients",
      icon: Home,
      badge: patientCount > 0 ? patientCount : undefined,
    },
    { id: "add", label: "Add", icon: Plus },
    { id: "reference", label: "Reference", icon: BookOpen },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      badge: alertCount > 0 ? alertCount : undefined,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border/40 safe-area-bottom"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-[68px] px-2 max-w-lg mx-auto">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? "true" : undefined}
            aria-label={
              badge && badge > 0
                ? `${label}, ${badge} ${badge === 1 ? "item" : "items"}`
                : label
            }
            className={cn(
              "flex flex-col items-center justify-center flex-1 min-h-[48px] h-full gap-1 rounded-xl",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground/60"
            )}
          >
            <div className="relative">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-2xl",
                  activeTab === id
                    ? "bg-primary/[0.08] shadow-sm"
                    : "bg-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "h-[22px] w-[22px]",
                    activeTab === id && "text-primary"
                  )}
                  strokeWidth={activeTab === id ? 2.5 : 2}
                  aria-hidden
                />
              </div>
              {badge !== undefined && badge > 0 && (
                <Badge
                  variant="default"
                  className={cn(
                    "absolute -top-1 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[9px] font-bold rounded-full border-2",
                    activeTab === id
                      ? "bg-primary text-primary-foreground border-background"
                      : "bg-destructive text-destructive-foreground border-background"
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </Badge>
              )}
            </div>
            <span
              className={cn(
                "text-[11px] leading-none tracking-tight",
                activeTab === id
                  ? "font-semibold text-primary"
                  : "font-medium text-muted-foreground/70"
              )}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
