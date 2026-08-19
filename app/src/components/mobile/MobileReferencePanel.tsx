import * as React from "react";
import { BookOpen, ExternalLink, ClipboardList, Stethoscope, Calculator, Info, Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIBCCState } from "@/contexts/IBCCContext";

export const MobileReferencePanel = () => {
  const { allChapters, isDataLoaded, ensureDataLoaded, openPanel, viewChapter } = useIBCCState();

  React.useEffect(() => {
    void ensureDataLoaded();
  }, [ensureDataLoaded]);

  const handleOpenChapter = (chapter: typeof allChapters[0]) => {
    viewChapter(chapter);
    openPanel();
  };

  const popularChapters = allChapters.slice(0, 8);
  const resourceHighlights = [
    {
      title: "Rapid bedside answers",
      description: "Concise summaries, differential diagnoses, and pitfalls for quick decision support.",
      icon: <Stethoscope className="h-4 w-4 text-primary" aria-hidden />,
    },
    {
      title: "Protocols & checklists",
      description: "Stepwise workflows for high-stakes scenarios to keep teams aligned.",
      icon: <ClipboardList className="h-4 w-4 text-primary" aria-hidden />,
    },
    {
      title: "Point-of-care calculators",
      description: "Embedded scoring tools with interpretations to speed up risk stratification.",
      icon: <Calculator className="h-4 w-4 text-primary" aria-hidden />,
    },
  ];

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-xl font-semibold">Clinical Reference</h2>
        <Button variant="ghost" size="sm" className="min-h-11" onClick={openPanel}>
          <ExternalLink className="h-4 w-4 mr-1" aria-hidden />
          Open Full
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Quick access to IBCC clinical guidelines and protocols.
      </p>

      {!isDataLoaded ? (
        <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading clinical reference…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {popularChapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => handleOpenChapter(chapter)}
            aria-label={`Open ${chapter.title}${chapter.category ? `, ${chapter.category.name}` : ""}`}
            className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/50 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[5.5rem]"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0" aria-hidden>
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-sm leading-tight truncate">
                  {chapter.title}
                </h3>
                {chapter.category && (
                  <span className="text-xs text-muted-foreground">
                    {chapter.category.name}
                  </span>
                )}
              </div>
            </div>
          </button>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <Button variant="secondary" className="w-full min-h-11" onClick={openPanel}>
          <BookOpen className="h-4 w-4 mr-2" aria-hidden />
          Browse All Chapters
        </Button>
      </div>

      <div className="pt-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">IBCC Resource Highlights</h3>
        <div className="grid gap-3">
          {resourceHighlights.map((item) => (
            <Card key={item.title} className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center" aria-hidden>
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="pt-2 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">How to use during rounds</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-primary" aria-hidden />
            Start with a quick search or jump into a bookmarked chapter for rapid context.
          </li>
          <li className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 mt-0.5 text-primary" aria-hidden />
            Review the embedded pearls and treatment algorithms before opening the full chapter.
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-primary" aria-hidden />
            Use protocols and calculators to standardize care and document key decisions.
          </li>
        </ul>
      </div>

      <div className="pt-2 space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">About IBCC</h3>
        <p className="text-sm text-muted-foreground">
          The Internet Book of Critical Care (IBCC) is an online critical care reference by Dr. Josh Farkas.
          Content is embedded here for fast bedside review, with links to the full chapter when you need deeper
          guidance.
        </p>
        <Button variant="outline" className="w-full min-h-11" asChild>
          <a
            href="https://emcrit.org/ibcc/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-2" aria-hidden />
            Visit EMCrit IBCC
          </a>
        </Button>
      </div>
    </div>
  );
};
