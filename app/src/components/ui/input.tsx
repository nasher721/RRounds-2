import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  showSuccess?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, showSuccess, ...props }, ref) => {
    const shouldShowSuccess = Boolean(showSuccess) && !props.disabled;
    const rightPadding = endIcon && shouldShowSuccess ? "pr-16" : endIcon || shouldShowSuccess ? "pr-10" : "pr-3";
    return (
      <div className="relative w-full">
        {startIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10">
            {startIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border border-border bg-card text-card-foreground py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-xs hover:border-border/80 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/40",
            startIcon ? "pl-10" : "pl-3",
            rightPadding,
            className,
          )}
          ref={ref}
          {...props}
        />
        {shouldShowSuccess && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-success",
              endIcon ? "right-10" : "right-3",
            )}
            aria-hidden="true"
          >
            <Check className="h-4 w-4" />
          </div>
        )}
        {endIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10">
            {endIcon}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
