import { PrintSection } from './PrintSection';
import * as React from 'react';

interface PrintRoundingNotesProps {
    fontSize: number;
}

export const PrintRoundingNotes = ({ fontSize }: PrintRoundingNotesProps) => {
    return (
        <PrintSection
            title="Rounding Notes"
            fontSize={fontSize}
            variant="amber"
        >
            <div className="min-h-[60px] w-full relative">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="border-b border-amber-300 h-[14px] w-full" />
                ))}
            </div>
        </PrintSection>
    );
};
