import * as React from "react";

interface LiveRegionProps {
    /** The message to announce to screen readers */
    message: string;
    /** Politeness level: "polite" waits for silence, "assertive" interrupts */
    politeness?: "polite" | "assertive";
}

/**
 * Screen-reader-only live region that announces dynamic content changes.
 * Visually hidden but read aloud by assistive technologies.
 */
export function LiveRegion({ message, politeness = "polite" }: LiveRegionProps) {
    return (
        <div
            role="status"
            aria-live={politeness}
            aria-atomic="true"
            className="sr-only"
        >
            {message}
        </div>
    );
}
