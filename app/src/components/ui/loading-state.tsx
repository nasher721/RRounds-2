import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { animate, stagger } from "animejs";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { useMotionPreference } from "@/hooks/useReducedMotion";

function useShimmer<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const { prefersReducedMotion } = useMotionPreference();

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion) return;

    const bars = el.querySelectorAll<HTMLElement>(".skeleton-bar");
    if (!bars.length) return;

    bars.forEach(b => b.classList.remove("animate-pulse"));

    const anim = animate(bars, {
      opacity: [0.4, 1, 0.4],
      delay: stagger(40),
      duration: 1200,
      ease: "inOut(2)",
      loop: true,
    });

    return () => { anim.pause(); };
  }, [prefersReducedMotion]);

  return ref;
}

interface LoadingStateProps {
  /** Main message to display */
  message?: string;
  /** Optional subdescription */
  description?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Full screen overlay */
  fullScreen?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Compact loading spinner for inline use
 */
export function LoadingSpinner({ 
  size = "md", 
  className 
}: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8",
  };
  
  return (
    <Loader2 
      className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)} 
    />
  );
}

/**
 * Full loading state with message - used in content areas
 */
export function LoadingState({
  message = "Loading...",
  description,
  size = "md",
  fullScreen = false,
  className,
}: LoadingStateProps) {
  const containerClass = fullScreen 
    ? "fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50"
    : "flex items-center justify-center min-h-[200px]";
    
  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };
  
  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className={cn(containerClass, className)} role="status" aria-live="polite">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <Loader2 className={cn("animate-spin text-primary", iconSizes[size])} />
        <div className={cn("font-medium text-muted-foreground", textSizes[size])}>
          {message}
        </div>
        {description && (
          <div className="text-sm text-muted-foreground/70 max-w-xs">
            {description}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/**
 * Error state with retry action
 */
interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center min-h-[200px] gap-3 p-4",
        className
      )}
      role="alert"
    >
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="text-center">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground 
                     hover:bg-primary/90 transition-colors focus-visible:outline-none 
                     focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Try again
        </button>
      )}
    </motion.div>
  );
}

/**
 * Empty state with action
 */
interface EmptyStateProps {
  /** Icon to display (defaults to inbox) */
  icon?: React.ReactNode;
  /** Main title */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex flex-col items-center justify-center min-h-[200px] gap-4 p-6 text-center",
        className
      )}
      role="status"
    >
      <div className="rounded-full bg-muted p-4">
        {icon || <Inbox className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground text-lg">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground 
                     hover:bg-primary/90 transition-colors focus-visible:outline-none 
                     focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

/**
 * Skeleton variants for content loading
 */
export function CardSkeleton({ className }: { className?: string }) {
  const shimmerRef = useShimmer();
  return (
    <div ref={shimmerRef} className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      <div className="skeleton-bar h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="skeleton-bar h-3 w-full animate-pulse rounded bg-muted" />
        <div className="skeleton-bar h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  const shimmerRef = useShimmer();
  return (
    <div ref={shimmerRef} className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-bar h-12 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export function TableSkeleton({ 
  rows = 5, 
  cols = 4, 
  className 
}: { 
  rows?: number; 
  cols?: number; 
  className?: string;
}) {
  const shimmerRef = useShimmer();
  return (
    <div ref={shimmerRef} className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        {Array.from({ length: cols }).map((_, i) => (
          <div 
            key={i} 
            className="skeleton-bar h-4 flex-1 animate-pulse rounded bg-muted"
            style={{ opacity: 0.5 }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton-bar h-8 flex-1 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}
