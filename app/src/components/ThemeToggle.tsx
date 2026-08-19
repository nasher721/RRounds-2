import * as React from "react";
import { Contrast, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ThemeToggle() {
  const { theme, setTheme, highContrast, setHighContrast } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden />;
      case "dark":
        return <Moon className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden />;
      default:
        return <Laptop className="h-3.5 w-3.5 mr-2 shrink-0" aria-hidden />;
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      default:
        return "System";
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 min-h-[44px] w-9 min-w-[44px] rounded-full md:min-h-0 md:h-8 md:w-8 md:min-w-0 shrink-0",
          highContrast
            ? "text-primary bg-primary/15 border border-primary/30"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
        )}
        aria-pressed={highContrast}
        aria-label={highContrast ? "High contrast on" : "High contrast off"}
        title={highContrast ? "Disable high contrast" : "Enable high contrast"}
        onClick={() => setHighContrast(!highContrast)}
      >
        <Contrast className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <Select
        value={theme}
        onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
      >
        <SelectTrigger
          className="h-9 min-h-[44px] w-[8.5rem] rounded-full text-card-foreground/60 hover:text-card-foreground hover:bg-accent/50 transition-colors border-0 md:min-h-0 md:h-8"
          aria-label={`Color theme: ${getThemeLabel()}`}
        >
          {getIcon()}
          <SelectValue placeholder="Select theme" className="text-sm" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="light">
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Light</span>
            </div>
          </SelectItem>
          <SelectItem value="dark">
            <div className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Dark</span>
            </div>
          </SelectItem>
          <SelectItem value="system">
            <div className="flex items-center gap-2">
              <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>System</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
