import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfileCoachingBannerProps = {
  message: string;
  className?: string;
};

export const ProfileCoachingBanner = ({ message, className }: ProfileCoachingBannerProps) => {
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-600/50 bg-amber-500/15 px-3 py-2 text-sm text-foreground",
        "dark:border-amber-400/55 dark:bg-amber-500/25 dark:text-amber-50",
        className,
      )}
    >
      <Info className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200 mt-0.5" aria-hidden="true" />
      <p className="leading-snug">{message}</p>
    </div>
  );
};
