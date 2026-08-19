import { useState, useEffect } from "react";

interface FieldTimestampProps {
  timestamp?: string;
  className?: string;
}

/**
 * Displays a relative time indicator for when a field was last updated
 */
export const FieldTimestamp = ({ timestamp, className = "" }: FieldTimestampProps) => {
  const [relativeTime, setRelativeTime] = useState<string>("");

  useEffect(() => {
    if (!timestamp) {
      setRelativeTime("");
      return;
    }

    const updateRelativeTime = () => {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        setRelativeTime("just now");
      } else if (diffMins < 60) {
        setRelativeTime(`${diffMins}m ago`);
      } else if (diffHours < 24) {
        setRelativeTime(`${diffHours}h ago`);
      } else if (diffDays < 7) {
        setRelativeTime(`${diffDays}d ago`);
      } else {
        // Show date for older timestamps
        setRelativeTime(date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }));
      }
    };

    updateRelativeTime();
    // Update every minute
    const interval = setInterval(updateRelativeTime, 60000);

    return () => clearInterval(interval);
  }, [timestamp]);

  if (!timestamp || !relativeTime) {
    return null;
  }

  return (
    <span 
      className={`text-xs text-muted-foreground/60 ${className}`}
      title={new Date(timestamp).toLocaleString()}
    >
      {relativeTime}
    </span>
  );
};
