/**
 * Guideline Detail View
 * Full guideline display with recommendations, diagnostic criteria, and treatment algorithms
 */

import { useState } from 'react';
import { ArrowLeft, Star, ExternalLink, CheckCircle, AlertCircle, Pill, FileText, Calendar, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ClinicalGuideline, GuidelineRecommendation, DiagnosticCriterion, TreatmentRecommendation } from '@/types/clinicalGuidelines';
import { SPECIALTY_MAP } from '@/types/clinicalGuidelines';
import { cn } from '@/lib/utils';

interface GuidelineDetailViewProps {
  guideline: ClinicalGuideline;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onClose: () => void;
}

// Recommendation class styling
function getRecommendationBadge(classOfRec: string, levelOfEvidence: string) {
  const classColors: Record<string, string> = {
    'I': 'bg-success/20 text-success border-success/30',
    'IIa': 'bg-primary/20 text-primary border-primary/30',
    'IIb': 'bg-warning/20 text-warning border-warning/30',
    'III': 'bg-destructive/20 text-destructive border-destructive/30',
    'A': 'bg-success/20 text-success border-success/30',
    'B': 'bg-primary/20 text-primary border-primary/30',
    'C': 'bg-warning/20 text-warning border-warning/30',
    'D': 'bg-destructive/20 text-destructive border-destructive/30',
  };

  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", classColors[classOfRec] || '')}>
        Class {classOfRec}
      </Badge>
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
        LOE: {levelOfEvidence}
      </Badge>
    </div>
  );
}

// Recommendation Component
function RecommendationItem({ recommendation }: { recommendation: GuidelineRecommendation }) {
  return (
    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
      <div className="flex items-start gap-2">
        <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm">{recommendation.text}</p>
          <div className="flex items-center gap-2 mt-2">
            {getRecommendationBadge(recommendation.classOfRecommendation, recommendation.levelOfEvidence)}
            {recommendation.category && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {recommendation.category}
              </Badge>
            )}
          </div>
          {recommendation.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">{recommendation.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Diagnostic Criteria Component
function DiagnosticCriteriaSection({ criteria }: { criteria: DiagnosticCriterion[] }) {
  return (
    <div className="space-y-3">
      {criteria.map(section => (
        <div key={section.id} className="p-3 bg-secondary/30 rounded-lg border border-border">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" />
            {section.category}
          </h4>
          <ul className="space-y-1.5">
            {section.criteria.map((criterion, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{criterion}</span>
              </li>
            ))}
          </ul>
          {section.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">{section.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Treatment Algorithm Component
function TreatmentAlgorithmSection({ steps }: { steps: TreatmentRecommendation[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={step.id} className="relative">
          {/* Timeline connector */}
          {idx < steps.length - 1 && (
            <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-border" />
          )}

          <div className="flex items-start gap-3">
            {/* Step number */}
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
              {idx + 1}
            </div>

            <div className="flex-1 pb-4">
              <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {step.phase}
                  </Badge>
                  {step.timing && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                      {step.timing}
                    </Badge>
                  )}
                </div>
                <h4 className="text-sm font-medium mb-2">{step.title}</h4>
                <ul className="space-y-1.5 mb-2">
                  {step.recommendations.map((rec, ridx) => (
                    <li key={ridx} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-success mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>

                {/* Medications */}
                {step.medications && step.medications.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1 mb-2">
                      <Pill className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Medications</span>
                    </div>
                    <div className="grid gap-2">
                      {step.medications.map((med, midx) => (
                        <div key={midx} className="text-xs p-2 bg-background/50 rounded border border-border/50">
                          <div className="font-medium">{med.name}</div>
                          <div className="text-muted-foreground">
                            {med.dose} {med.route} {med.frequency}
                            {med.duration && ` x ${med.duration}`}
                          </div>
                          {med.notes && (
                            <div className="text-muted-foreground italic mt-1">{med.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monitoring */}
                {step.monitoring && step.monitoring.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <span className="text-xs font-medium text-muted-foreground">Monitor: </span>
                    <span className="text-xs text-muted-foreground">{step.monitoring.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GuidelineDetailView({
  guideline,
  isBookmarked,
  onToggleBookmark,
  onClose,
}: GuidelineDetailViewProps) {
  const specialtyInfo = SPECIALTY_MAP[guideline.specialty];
  const [expandedSections, setExpandedSections] = useState<string[]>(['recommendations']);

  return (
    <div className="h-full w-full bg-card flex flex-col animate-fade-in relative z-20">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border bg-secondary/30">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span>{specialtyInfo?.icon || '📋'}</span>
            <h2 className="font-semibold truncate">{guideline.shortTitle}</h2>
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
          {/* Guideline Info Header */}
          <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <h3 className="font-medium text-sm mb-2">{guideline.title}</h3>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs gap-1">
                <Building2 className="h-3 w-3" />
                {guideline.organization.abbreviation}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Calendar className="h-3 w-3" />
                {guideline.year}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {specialtyInfo?.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{guideline.summary}</p>
          </div>

          {/* Content Sections */}
          <Accordion
            type="multiple"
            value={expandedSections}
            onValueChange={setExpandedSections}
            className="space-y-2"
          >
            {/* Key Recommendations */}
            {guideline.keyRecommendations && guideline.keyRecommendations.length > 0 && (
              <AccordionItem value="recommendations" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="font-medium text-sm">Key Recommendations</span>
                    <Badge variant="secondary" className="text-[10px] ml-2">
                      {guideline.keyRecommendations.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <div className="space-y-2">
                    {guideline.keyRecommendations.map(rec => (
                      <RecommendationItem key={rec.id} recommendation={rec} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Diagnostic Criteria */}
            {guideline.diagnosticCriteria && guideline.diagnosticCriteria.length > 0 && (
              <AccordionItem value="diagnosis" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Diagnostic Criteria</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <DiagnosticCriteriaSection criteria={guideline.diagnosticCriteria} />
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Treatment Algorithm */}
            {guideline.treatmentAlgorithm && guideline.treatmentAlgorithm.length > 0 && (
              <AccordionItem value="treatment" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-warning" />
                    <span className="font-medium text-sm">Treatment Algorithm</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <TreatmentAlgorithmSection steps={guideline.treatmentAlgorithm} />
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Quality Measures */}
            {guideline.qualityMeasures && guideline.qualityMeasures.length > 0 && (
              <AccordionItem value="quality" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Quality Measures</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <div className="space-y-2">
                    {guideline.qualityMeasures.map(measure => (
                      <div key={measure.id} className="p-3 bg-secondary/30 rounded-lg border border-border">
                        <p className="text-sm font-medium">{measure.measure}</p>
                        <p className="text-xs text-muted-foreground mt-1">Target: {measure.target}</p>
                        {measure.rationale && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{measure.rationale}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          {/* External Link */}
          <div className="mt-6">
            <a
              href={guideline.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="default" className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                View Full Guideline
              </Button>
            </a>
          </div>

          {/* Keywords */}
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Related Terms</h3>
            <div className="flex flex-wrap gap-1.5">
              {guideline.keywords.map(keyword => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>

          {/* Source Info */}
          <div className="mt-6 p-3 bg-secondary/30 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">
              Source: {guideline.organization.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Last Updated: {guideline.lastUpdated}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
