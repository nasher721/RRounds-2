import * as React from "react";
import { Home, Plus, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTab = "patients" | "add" | "reference" | "settings";

interface MobileNavBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  patientCount?: number;
}

export const MobileNavBar = ({ activeTab, onTabChange, patientCount = 0 }: MobileNavBarProps) => {
  const tabs: { id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "patients", label: "Patients", icon: Home },
    { id: "add", label: "Add", icon: Plus },
    { id: "reference", label: "Reference", icon: BookOpen },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav
      className="safe-area-bottom fixed bottom-2 left-2 right-2 z-50 rounded-[1.5rem] border border-white/70 bg-background/86 shadow-[0_24px_55px_-34px_rgba(7,40,27,0.58),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl"
      aria-label="Main sections"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? "true" : undefined}
            aria-label={
              id === "patients" && patientCount > 0
                ? `Patients, ${patientCount} total`
                : label
            }
            className={cn(
              "relative flex h-full min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl transition-[transform,color,background-color] duration-500 ease-premium active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground/60"
            )}
          >
            {activeTab === id && (
              <span className="absolute left-1/3 right-1/3 top-0 h-0.5 rounded-full bg-primary shadow-[0_4px_12px_hsl(var(--primary)/0.35)]" aria-hidden />
            )}
            <div
              className={cn(
                "relative rounded-2xl px-4 py-1.5 transition-[transform,background-color,box-shadow] duration-500 ease-premium",
                activeTab === id && "-translate-y-0.5 bg-primary/[0.08] shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]"
              )}
            >
              <Icon className={cn("h-5 w-5", activeTab === id && "text-primary")} aria-hidden />
              {id === "patients" && patientCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] flex items-center justify-center text-[9px] font-bold bg-primary text-primary-foreground rounded-full px-0.5 border-2 border-background"
                  aria-hidden
                >
                  {patientCount}
                </span>
              )}
            </div>
            <span className={cn(
              "text-[10px] tracking-wide transition-colors",
              activeTab === id ? "font-semibold text-primary" : "font-medium"
            )}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
