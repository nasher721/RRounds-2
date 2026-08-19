import { cn } from "@/lib/utils";

interface LoadingProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Loading({ className, size = "md" }: LoadingProps) {
  const sizeClasses = {
    sm: "w-12 h-3",
    md: "w-24 h-6",
    lg: "w-36 h-9",
  };

  return (
    <div className={cn("loading flex items-center justify-center", className)}>
      <svg className={sizeClasses[size]} viewBox="0 0 187.3 93.7">
        <polyline
          id="back"
          points="0.7,45.8 62.2,45.8 75.5,6.1 88.7,84.4 102.4,45.8 186.6,45.8"
        />
        <polyline
          id="front"
          points="0.7,45.8 62.2,45.8 75.5,6.1 88.7,84.4 102.4,45.8 186.6,45.8"
        />
      </svg>
    </div>
  );
}

export function LoadingOverlay({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center p-8", className)}>
      <Loading size="lg" />
    </div>
  );
}

export function LoadingInline({ className }: { className?: string }) {
  return <Loading size="sm" className={className} />;
}
