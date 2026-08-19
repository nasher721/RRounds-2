/**
 * IBCC Chapter View
 * Full chapter display with embedded clinical content, calculators, and checklists
 */

import { useState } from 'react';
import { ArrowLeft, Star, ExternalLink, Calculator, ClipboardList, CheckCircle2, Circle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { IBCCChapter, ClinicalCalculator, ProtocolChecklist, CalculatorResult } from '@/types/ibcc';
import { getChapterContent, hasChapterContent } from '@/data/ibccChapterContent';
import { ClinicalPearls, TreatmentAlgorithm, MedicationCards, DiagnosticCriteria, PitfallsAlert } from './content';
import { cn } from '@/lib/utils';

interface IBCCChapterViewProps {
  chapter: IBCCChapter;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onClose: () => void;
  calculators: ClinicalCalculator[];
  checklists: ProtocolChecklist[];
}

export function IBCCChapterView({
  chapter,
  isBookmarked,
  onToggleBookmark,
  onClose,
  calculators,
  checklists,
}: IBCCChapterViewProps) {
  const content = getChapterContent(chapter.id);
  const hasContent = hasChapterContent(chapter.id);

  return (
    <div className="h-full w-full bg-card flex flex-col animate-fade-in relative z-20">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border bg-secondary/30">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span>{chapter.category.icon}</span>
            <h2 className="font-semibold truncate">{chapter.title}</h2>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleBookmark}
          className="h-8 w-8"
        >
          <Star className={cn("h-4 w-4", isBookmarked && "fill-warning text-warning")} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Content Status Badge */}
          {hasContent && (
            <Badge variant="default" className="mb-4 gap-1">
              <BookOpen className="h-3 w-3" />
              Full Content Available
            </Badge>
          )}

          {/* Summary */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {chapter.summary}
            </p>
          </div>

          {/* Embedded Clinical Content */}
          {content && (
            <div className="space-y-2">
              {content.keyPearls && <ClinicalPearls pearls={content.keyPearls} />}
              {content.diagnosticCriteria && <DiagnosticCriteria sections={content.diagnosticCriteria} />}
              {content.treatmentAlgorithm && <TreatmentAlgorithm steps={content.treatmentAlgorithm} />}
              {content.medications && <MedicationCards medications={content.medications} />}
              {content.pitfalls && <PitfallsAlert pitfalls={content.pitfalls} />}

              {/* Differential Diagnosis */}
              {content.differentialDiagnosis && content.differentialDiagnosis.length > 0 && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Differential Diagnosis</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {content.differentialDiagnosis.map((dx, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {dx}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Calculators & Checklists */}
          {(calculators.length > 0 || checklists.length > 0) && (
            <Tabs defaultValue={calculators.length > 0 ? 'calculators' : 'checklists'} className="mt-4">
              <TabsList className="w-full mb-4">
                {calculators.length > 0 && (
                  <TabsTrigger value="calculators" className="flex-1 gap-1">
                    <Calculator className="h-3 w-3" />
                    Calculators
                  </TabsTrigger>
                )}
                {checklists.length > 0 && (
                  <TabsTrigger value="checklists" className="flex-1 gap-1">
                    <ClipboardList className="h-3 w-3" />
                    Protocols
                  </TabsTrigger>
                )}
              </TabsList>

              {calculators.length > 0 && (
                <TabsContent value="calculators" className="space-y-4">
                  {calculators.map(calc => (
                    <CalculatorWidget key={calc.id} calculator={calc} />
                  ))}
                </TabsContent>
              )}

              {checklists.length > 0 && (
                <TabsContent value="checklists" className="space-y-4">
                  {checklists.map(checklist => (
                    <ChecklistWidget key={checklist.id} checklist={checklist} />
                  ))}
                </TabsContent>
              )}
            </Tabs>
          )}

          {/* External Link - only show if no embedded content */}
          {!hasContent && (
            <div className="mt-6">
              <a
                href={chapter.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="default" className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open Full Chapter on IBCC
                </Button>
              </a>
            </div>
          )}

          {/* Keywords */}
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Related Terms</h3>
            <div className="flex flex-wrap gap-1.5">
              {chapter.keywords.map(keyword => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// Calculator Widget
function CalculatorWidget({ calculator }: { calculator: ClinicalCalculator }) {
  const [inputs, setInputs] = useState<Record<string, number | string>>({});
  const [result, setResult] = useState<CalculatorResult | null>(null);

  const handleInputChange = (id: string, value: number | string) => {
    const newInputs = { ...inputs, [id]: value };
    setInputs(newInputs);

    // Calculate result
    try {
      const calcResult = calculator.formula(newInputs);
      setResult(calcResult);
    } catch {
      setResult(null);
    }
  };

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <h4 className="font-medium text-sm mb-1">{calculator.name}</h4>
      <p className="text-xs text-muted-foreground mb-4">{calculator.description}</p>

      <div className="space-y-3">
        {calculator.inputs.map(input => (
          <div key={input.id} className="flex items-center justify-between">
            <Label htmlFor={input.id} className="text-xs">
              {input.label}
              {input.unit && <span className="text-muted-foreground ml-1">({input.unit})</span>}
            </Label>
            {input.type === 'boolean' ? (
              <Switch
                id={input.id}
                checked={inputs[input.id] === '1'}
                onCheckedChange={(checked) => handleInputChange(input.id, checked ? '1' : '0')}
              />
            ) : (
              <Input
                id={input.id}
                type="number"
                className="w-24 h-8 text-sm"
                min={input.min}
                max={input.max}
                value={inputs[input.id] as number || ''}
                onChange={(e) => handleInputChange(input.id, parseFloat(e.target.value))}
              />
            )}
          </div>
        ))}
      </div>

      {result && (
        <div className={cn(
          "mt-4 p-3 rounded-lg text-sm",
          result.risk === 'low' && "bg-success/10 border border-success/30",
          result.risk === 'moderate' && "bg-warning/10 border border-warning/30",
          result.risk === 'high' && "bg-destructive/10 border border-destructive/30",
          result.risk === 'critical' && "bg-destructive/20 border border-destructive/50",
          !result.risk && "bg-secondary"
        )}>
          <div className="font-semibold text-lg mb-1">
            Score: {result.value}
          </div>
          <p className="text-xs text-muted-foreground">{result.interpretation}</p>
        </div>
      )}
    </div>
  );
}

// Checklist Widget
function ChecklistWidget({ checklist }: { checklist: ProtocolChecklist }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const toggleItem = (itemId: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const progress = Math.round((completed.size / checklist.items.length) * 100);

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm">{checklist.name}</h4>
        <Badge variant={progress === 100 ? 'default' : 'secondary'} className="text-xs">
          {progress}%
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-secondary rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {checklist.items.map(item => (
          <div
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={cn(
              "flex items-start gap-2 p-2 rounded cursor-pointer transition-colors",
              completed.has(item.id)
                ? "bg-success/10"
                : "hover:bg-secondary/50"
            )}
          >
            {completed.has(item.id) ? (
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-xs",
                completed.has(item.id) && "line-through text-muted-foreground"
              )}>
                {item.text}
              </p>
              {(item.category || item.timeframe) && (
                <div className="flex gap-2 mt-1">
                  {item.category && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {item.category}
                    </Badge>
                  )}
                  {item.timeframe && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                      {item.timeframe}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
