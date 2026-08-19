import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  FileCheck,
  Search,
  Timer,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  Protocol,
  PatientProtocol,
  ProtocolCategory,
  ProtocolItem,
} from "@/types/protocols";
import {
  DEFAULT_PROTOCOLS,
  getProtocolById,
  calculateProtocolCompletion,
} from "@/types/protocols";

interface ProtocolChecklistProps {
  patientId: string;
  patientName: string;
  activeProtocols: PatientProtocol[];
  onStartProtocol: (protocol: Protocol) => void;
  onCompleteItem: (protocolId: string, itemId: string) => void;
  onUncompleteItem: (protocolId: string, itemId: string) => void;
  onAddNote: (protocolId: string, itemId: string, note: string) => void;
  onDiscontinueProtocol: (protocolId: string, reason: string) => void;
  className?: string;
}

const CATEGORY_COLORS: Record<ProtocolCategory, string> = {
  sepsis: 'bg-red-100 text-red-700 border-red-200',
  respiratory: 'bg-blue-100 text-blue-700 border-blue-200',
  cardiac: 'bg-pink-100 text-pink-700 border-pink-200',
  neuro: 'bg-purple-100 text-purple-700 border-purple-200',
  gi: 'bg-amber-100 text-amber-700 border-amber-200',
  renal: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  heme: 'bg-rose-100 text-rose-700 border-rose-200',
  endo: 'bg-orange-100 text-orange-700 border-orange-200',
  prophylaxis: 'bg-green-100 text-green-700 border-green-200',
  admission: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  discharge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  procedure: 'bg-violet-100 text-violet-700 border-violet-200',
};

export function ProtocolChecklist({
  activeProtocols,
  onStartProtocol,
  onCompleteItem,
  onUncompleteItem,
  onAddNote,
  onDiscontinueProtocol,
  className,
}: ProtocolChecklistProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<ProtocolCategory | 'all'>('all');
  const [expandedProtocols, setExpandedProtocols] = React.useState<Set<string>>(
    new Set(activeProtocols.map(p => p.protocolId))
  );

  const searchLower = searchTerm.toLowerCase();
  const availableProtocols = DEFAULT_PROTOCOLS.filter(p => {
    const isActive = activeProtocols.some(ap => ap.protocolId === p.id);
    const matchesSearch = p.name.toLowerCase().includes(searchLower) ||
      p.shortName.toLowerCase().includes(searchLower);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return !isActive && matchesSearch && matchesCategory && p.enabled;
  });

  const toggleProtocol = (protocolId: string) => {
    setExpandedProtocols(prev => {
      const next = new Set(prev);
      if (next.has(protocolId)) {
        next.delete(protocolId);
      } else {
        next.add(protocolId);
      }
      return next;
    });
  };

  const categories: ProtocolCategory[] = [
    'sepsis', 'respiratory', 'cardiac', 'neuro', 'gi', 'renal',
    'heme', 'endo', 'prophylaxis', 'admission', 'discharge', 'procedure'
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Active Protocols */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Active Protocols
          </h3>
          <ProtocolSelector
            availableProtocols={availableProtocols}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categories={categories}
            onSelectProtocol={onStartProtocol}
          />
        </div>

        {activeProtocols.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No active protocols</p>
              <p className="text-sm mt-1">Add a protocol to track compliance</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeProtocols.map(patientProtocol => {
              const protocol = getProtocolById(patientProtocol.protocolId);
              if (!protocol) return null;

              const completion = calculateProtocolCompletion(patientProtocol, protocol);
              const isExpanded = expandedProtocols.has(patientProtocol.protocolId);

              return (
                <ActiveProtocolCard
                  key={patientProtocol.id}
                  patientProtocol={patientProtocol}
                  protocol={protocol}
                  completion={completion}
                  isExpanded={isExpanded}
                  onToggle={() => toggleProtocol(patientProtocol.protocolId)}
                  onCompleteItem={(itemId) => onCompleteItem(patientProtocol.protocolId, itemId)}
                  onUncompleteItem={(itemId) => onUncompleteItem(patientProtocol.protocolId, itemId)}
                  onAddNote={(itemId, note) => onAddNote(patientProtocol.protocolId, itemId, note)}
                  onDiscontinue={(reason) => onDiscontinueProtocol(patientProtocol.protocolId, reason)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActiveProtocolCardProps {
  patientProtocol: PatientProtocol;
  protocol: Protocol;
  completion: number;
  isExpanded: boolean;
  onToggle: () => void;
  onCompleteItem: (itemId: string) => void;
  onUncompleteItem: (itemId: string) => void;
  onAddNote: (itemId: string, note: string) => void;
  onDiscontinue: (reason: string) => void;
}

function ActiveProtocolCard({
  patientProtocol,
  protocol,
  completion,
  isExpanded,
  onToggle,
  onCompleteItem,
  onUncompleteItem,
  onAddNote,
  onDiscontinue,
}: ActiveProtocolCardProps) {
  const completedCount = patientProtocol.completedItems.length;
  const totalItems = protocol.items.length;
  const requiredItems = protocol.items.filter(i => i.required);

  const [showDiscontinueDialog, setShowDiscontinueDialog] = React.useState(false);
  const [discontinueReason, setDiscontinueReason] = React.useState('');

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <Card className={cn(
          "transition-all",
          completion === 100 && "border-green-300 bg-green-50/50"
        )}>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{protocol.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", CATEGORY_COLORS[protocol.category])}
                    >
                      {protocol.shortName}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <Progress value={completion} className="flex-1 h-2" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {completedCount}/{totalItems} ({Math.round(completion)}%)
                    </span>
                  </div>
                </div>

                {completion === 100 && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {protocol.items.map((item) => {
                  const isCompleted = patientProtocol.completedItems.includes(item.id);
                  const completionTime = patientProtocol.completionTimes[item.id];
                  const note = patientProtocol.notes[item.id];

                  return (
                    <ProtocolItemRow
                      key={item.id}
                      item={item}
                      isCompleted={isCompleted}
                      completionTime={completionTime}
                      note={note}
                      onToggle={() =>
                        isCompleted ? onUncompleteItem(item.id) : onCompleteItem(item.id)
                      }
                      onAddNote={(noteText) => onAddNote(item.id, noteText)}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="text-xs text-muted-foreground">
                  Started: {new Date(patientProtocol.startedAt).toLocaleString()}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setShowDiscontinueDialog(true)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Discontinue
                </Button>
              </div>

              {protocol.source && (
                <div className="text-xs text-muted-foreground mt-2">
                  Source: {protocol.source}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={showDiscontinueDialog} onOpenChange={setShowDiscontinueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discontinue Protocol</DialogTitle>
            <DialogDescription>
              Confirm removing this protocol checklist from the patient chart.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for discontinuation</label>
              <Input
                value={discontinueReason}
                onChange={(e) => setDiscontinueReason(e.target.value)}
                placeholder="e.g., Patient discharged, Condition improved..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDiscontinueDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (discontinueReason.trim()) {
                    onDiscontinue(discontinueReason);
                    setShowDiscontinueDialog(false);
                  }
                }}
                disabled={!discontinueReason.trim()}
              >
                Discontinue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ProtocolItemRowProps {
  item: ProtocolItem;
  isCompleted: boolean;
  completionTime?: string;
  note?: string;
  onToggle: () => void;
  onAddNote: (note: string) => void;
}

function ProtocolItemRow({
  item,
  isCompleted,
  completionTime,
  note,
  onToggle,
  onAddNote,
}: ProtocolItemRowProps) {
  const [noteInput, setNoteInput] = React.useState(note || '');
  const [showNote, setShowNote] = React.useState(false);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-2 rounded-lg transition-colors",
        isCompleted ? "bg-green-50" : "hover:bg-muted/50"
      )}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className={cn(
            "text-sm",
            isCompleted && "line-through text-muted-foreground"
          )}>
            {item.text}
          </span>

          {item.required && (
            <Badge variant="outline" className="text-[10px] px-1 flex-shrink-0">
              Required
            </Badge>
          )}

          {item.details && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{item.details}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {item.timeframe && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Timer className="h-3 w-3" />
            {item.timeframe}
          </div>
        )}

        {isCompleted && completionTime && (
          <div className="text-xs text-green-600 mt-1">
            Completed: {new Date(completionTime).toLocaleTimeString()}
          </div>
        )}

        {note && (
          <div className="text-xs text-muted-foreground mt-1 italic">
            Note: {note}
          </div>
        )}
      </div>

      <Popover open={showNote} onOpenChange={setShowNote}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-2">
            <Input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add a note..."
              className="text-sm"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                onAddNote(noteInput);
                setShowNote(false);
              }}
            >
              Save Note
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface ProtocolSelectorProps {
  availableProtocols: Protocol[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedCategory: ProtocolCategory | 'all';
  onCategoryChange: (category: ProtocolCategory | 'all') => void;
  categories: ProtocolCategory[];
  onSelectProtocol: (protocol: Protocol) => void;
}

function ProtocolSelector({
  availableProtocols,
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  onSelectProtocol,
}: ProtocolSelectorProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Protocol
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Protocol</DialogTitle>
          <DialogDescription>
            Choose a clinical protocol checklist to add to this patient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search protocols..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <Badge
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => onCategoryChange('all')}
            >
              All
            </Badge>
            {categories.map(cat => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                className={cn(
                  "cursor-pointer capitalize",
                  selectedCategory === cat && CATEGORY_COLORS[cat]
                )}
                onClick={() => onCategoryChange(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {availableProtocols.map(protocol => (
                <Card
                  key={protocol.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => onSelectProtocol(protocol)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{protocol.name}</span>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", CATEGORY_COLORS[protocol.category])}
                          >
                            {protocol.shortName}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {protocol.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{protocol.items.length} items</span>
                          <span>
                            {protocol.items.filter(i => i.required).length} required
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {availableProtocols.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No protocols found</p>
                  <p className="text-sm mt-1">Try a different search or category</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProtocolChecklist;
