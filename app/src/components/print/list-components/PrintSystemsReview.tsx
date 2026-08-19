import { Patient } from '@/types/patient';
import { systemLabels } from '../constants';
import { cleanInlineStyles } from '../utils';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface PrintSystemsReviewProps {
    systems: Patient['systems'];
    enabledSystemKeys: string[];
    fontSize: number;
}

export const PrintSystemsReview = ({ systems, enabledSystemKeys, fontSize }: PrintSystemsReviewProps) => {
    if (enabledSystemKeys.length === 0) return null;

    return (
        <div>
            <div
                className="bg-primary text-primary-foreground font-bold uppercase px-3 py-2 rounded-t-lg"
                style={{ fontSize: 'calc(var(--print-fs) + 1px)', letterSpacing: '0.5px' } as React.CSSProperties}
            >
                Systems Review
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 border-2 border-t-0 border-primary rounded-b-lg overflow-hidden">
                {enabledSystemKeys.map((key, sysIdx) => {
                    const value = systems[key as keyof typeof systems];
                    return (
                        <div key={key} className={cn(
                            "border-r border-b border-primary/30",
                            sysIdx % 5 === 4 && "border-r-0"
                        )}>
                            <div
                                className="bg-primary/90 text-primary-foreground font-bold uppercase px-2 py-1.5 text-center"
                                style={{ fontSize: 'var(--print-fs)', letterSpacing: '0.3px' } as React.CSSProperties}
                            >
                                {systemLabels[key]}
                            </div>
                            <div
                                className="p-2 bg-muted/10 min-h-[40px] whitespace-pre-wrap"
                                style={{ fontSize: 'calc(var(--print-fs) - 1px)' } as React.CSSProperties}
                                dangerouslySetInnerHTML={{ __html: cleanInlineStyles(value) || '<span class="text-muted-foreground">-</span>' }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
