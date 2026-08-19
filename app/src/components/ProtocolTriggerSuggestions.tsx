import * as React from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Heart, 
  Activity, 
  Zap, 
  ShieldCheck,
  Plus,
  ChevronRight,
  Info
} from "lucide-react";
import { toast } from "sonner";
import type { Patient, PatientSystems } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";

interface ProtocolTrigger {
  id: string;
  name: string;
  category: 'sepsis' | 'vte' | 'vap' | 'clabsi' | 'cauti' | 'delirium' | 'pain';
  confidence: number;
  matchedTriggers: string[];
  description: string;
  actionItems: string[];
  icon: React.ElementType;
  urgency: 'critical' | 'high' | 'moderate' | 'low';
}

const PROTOCOL_DEFINITIONS: Partial<ProtocolTrigger>[] = [
  {
    id: 'sepsis-3hr-bundle',
    name: 'Sepsis 3-Hour Bundle',
    category: 'sepsis',
    urgency: 'critical',
    icon: Flame,
    description: 'Initiated for suspected sepsis with lactate ≥2 mmol/L or hypotension',
    actionItems: [
      'Obtain blood cultures',
      'Administer broad-spectrum antibiotics',
      'Measure lactate',
      'Administer 30 mL/kg crystalloid for hypotension',
      'Start vasopressors if refractory',
    ],
  },
  {
    id: 'vte-prophylaxis',
    name: 'VTE Prophylaxis',
    category: 'vte',
    urgency: 'high',
    icon: ShieldCheck,
    description: 'Venous thromboembolism prevention for high-risk patients',
    actionItems: [
      'Assess bleeding risk',
      'Start pharmacologic prophylaxis (if appropriate)',
      'Consider sequential compression devices',
      'Document VTE risk assessment',
    ],
  },
  {
    id: 'vap-bundle',
    name: 'VAP Prevention Bundle',
    category: 'vap',
    urgency: 'high',
    icon: Activity,
    description: 'Ventilator-associated pneumonia prevention for intubated patients',
    actionItems: [
      'Head of bed elevation 30-45°',
      'Daily sedation interruption',
      'Daily assessment for extubation readiness',
      'Peptic ulcer disease prophylaxis',
      'DVT prophylaxis',
    ],
  },
  {
    id: 'clabsi-bundle',
    name: 'CLABSI Prevention Bundle',
    category: 'clabsi',
    urgency: 'high',
    icon: ShieldCheck,
    description: 'Central line-associated bloodstream infection prevention',
    actionItems: [
      'Maximal barrier precautions',
      'Chlorhexidine skin antisepsis',
      'Optimal catheter site selection',
      'Daily review of line necessity',
      'Hand hygiene',
    ],
  },
  {
    id: 'cauti-bundle',
    name: 'CAUTI Prevention Bundle',
    category: 'cauti',
    urgency: 'moderate',
    icon: ShieldCheck,
    description: 'Catheter-associated urinary tract infection prevention',
    actionItems: [
      'Avoid unnecessary catheterization',
      'Maintain closed system',
      'Secure catheter properly',
      'Daily necessity assessment',
      'Early removal when possible',
    ],
  },
  {
    id: 'delirium-screening',
    name: 'Delirium Prevention',
    category: 'delirium',
    urgency: 'moderate',
    icon: Activity,
    description: 'ICU delirium screening and prevention bundle',
    actionItems: [
      'CAM-ICU screening q8-12h',
      'Minimize sedation',
      'Early mobilization',
      'Sleep optimization',
      'Reorientation protocols',
    ],
  },
  {
    id: 'pain-management',
    name: 'Pain Management Protocol',
    category: 'pain',
    urgency: 'moderate',
    icon: Heart,
    description: 'Standardized pain assessment and treatment',
    actionItems: [
      'Assess pain q4h',
      'Document pain score',
      'Consider multimodal analgesia',
      'Reassess after interventions',
    ],
  },
];

const SEPSIS_KEYWORDS = [
  'sepsis', 'septic', 'shock', 'bacteremia', 'infection', 'fever', 'hypotension',
  'lactate', 'vasopressor', 'norepinephrine', 'pressors', 'wbc', 'bands',
  'sirs', 'qsofa', 'organ dysfunction', 'acidosis', 'hypoperfusion',
];

const VTE_KEYWORDS = [
  'dvt', 'pe', 'vte', 'immobile', 'bedbound', 'post-op', 'surgery', 'trauma',
  'cancer', 'malignancy', 'obesity', 'thrombosis', 'clot',
];

const VAP_KEYWORDS = [
  'ventilator', 'intubated', 'mechanical ventilation', 'trach', 'tracheostomy',
  'et tube', 'endotracheal', 'vent', 'breathing tube',
];

const CLABSI_KEYWORDS = [
  'central line', 'picc', 'cvl', 'femoral', 'jugular', 'subclavian', 'dialysis catheter',
  'a-line', 'arterial line', 'central venous catheter',
];

const CAUTI_KEYWORDS = [
  'foley', 'urinary catheter', 'indwelling', 'french', 'suprapubic',
  'urinary tract', 'bladder catheter',
];

const DELIRIUM_KEYWORDS = [
  'confused', 'agitated', 'delirious', 'encephalopathy', 'icu psychosis',
  'withdrawal', 'alcohol withdrawal', 'sedation', 'haloperidol', 'quiet',
];

const PAIN_KEYWORDS = [
  'pain', 'painful', 'discomfort', 'analgesia', 'opioid', 'morphine', 'fentanyl',
  'hydromorphone', 'pain score', 'comfort', 'suffering',
];

interface ProtocolTriggerSuggestionsProps {
  patients: Patient[];
  onProtocolActivate: (patientId: string, protocolId: string) => void;
}

export function ProtocolTriggerSuggestions({ patients, onProtocolActivate }: ProtocolTriggerSuggestionsProps) {
  const [open, setOpen] = React.useState(false);
  const [suggestedProtocols, setSuggestedProtocols] = React.useState<Map<string, ProtocolTrigger[]>>(new Map());
  const [activeTab, setActiveTab] = React.useState<string>('all');

  const analyzePatientForProtocols = (patient: Patient): ProtocolTrigger[] => {
    const triggers: ProtocolTrigger[] = [];
    const allText = [
      patient.clinicalSummary,
      patient.intervalEvents,
      patient.labs,
      patient.imaging,
      ...Object.values(patient.systems),
      ...patient.medications.infusions,
      ...patient.medications.scheduled,
      ...patient.medications.prn,
    ].join(' ').toLowerCase();

    const checkKeywords = (keywords: string[], threshold: number = 2): { matches: string[]; score: number } => {
      const matches = keywords.filter(kw => allText.includes(kw));
      return {
        matches,
        score: matches.length,
      };
    };

    const sepsisCheck = checkKeywords(SEPSIS_KEYWORDS, 2);
    if (sepsisCheck.score >= 2 || allText.includes('lactate > 2')) {
      triggers.push({
        id: 'sepsis-3hr-bundle',
        name: 'Sepsis 3-Hour Bundle',
        category: 'sepsis',
        confidence: Math.min(100, sepsisCheck.score * 30),
        matchedTriggers: sepsisCheck.matches.slice(0, 3),
        description: PROTOCOL_DEFINITIONS.find(p => p.id === 'sepsis-3hr-bundle')?.description || '',
        actionItems: PROTOCOL_DEFINITIONS.find(p => p.id === 'sepsis-3hr-bundle')?.actionItems || [],
        icon: Flame,
        urgency: 'critical',
      });
    }

    const vteCheck = checkKeywords(VTE_KEYWORDS, 1);
    if (vteCheck.score >= 1) {
      triggers.push({
        id: 'vte-prophylaxis',
        name: 'VTE Prophylaxis',
        category: 'vte',
        confidence: Math.min(100, vteCheck.score * 40),
        matchedTriggers: vteCheck.matches.slice(0, 3),
        description: PROTOCOL_DEFINITIONS.find(p => p.id === 'vte-prophylaxis')?.description || '',
        actionItems: PROTOCOL_DEFINITIONS.find(p => p.id === 'vte-prophylaxis')?.actionItems || [],
        icon: ShieldCheck,
        urgency: 'high',
      });
    }

    const vapCheck = checkKeywords(VAP_KEYWORDS, 1);
    if (vapCheck.score >= 1) {
      triggers.push({
        id: 'vap-bundle',
        name: 'VAP Prevention Bundle',
        category: 'vap',
        confidence: Math.min(100, vapCheck.score * 60),
        matchedTriggers: vapCheck.matches.slice(0, 3),
        description: PROTOCOL_DEFINITIONS.find(p => p.id === 'vap-bundle')?.description || '',
        actionItems: PROTOCOL_DEFINITIONS.find(p => p.id === 'vap-bundle')?.actionItems || [],
        icon: Activity,
        urgency: 'high',
      });
    }

    const clabsiCheck = checkKeywords(CLABSI_KEYWORDS, 1);
    if (clabsiCheck.score >= 1) {
      triggers.push({
        id: 'clabsi-bundle',
        name: 'CLABSI Prevention Bundle',
        category: 'clabsi',
        confidence: Math.min(100, clabsiCheck.score * 50),
        matchedTriggers: clabsiCheck.matches.slice(0, 3),
        description: PROTOCOL_DEFINITIONS.find(p => p.id === 'clabsi-bundle')?.description || '',
        actionItems: PROTOCOL_DEFINITIONS.find(p => p.id === 'clabsi-bundle')?.actionItems || [],
        icon: ShieldCheck,
        urgency: 'high',
      });
    }

    const cautiCheck = checkKeywords(CAUTI_KEYWORDS, 1);
    if (cautiCheck.score >= 1) {
      triggers.push({
        id: 'cauti-bundle',
        name: 'CAUTI Prevention Bundle',
        category: 'cauti',
        confidence: Math.min(100, cautiCheck.score * 50),
        matchedTriggers: cautiCheck.matches.slice(0, 3),
        description: PROTOCOL_DEFINITIONS.find(p => p.id === 'cauti-bundle')?.description || '',
        actionItems: PROTOCOL_DEFINITIONS.find(p => p.id === 'cauti-bundle')?.actionItems || [],
        icon: ShieldCheck,
        urgency: 'moderate',
      });
    }

    const deliriumCheck = checkKeywords(DELIRIUM_KEYWORDS, 1);
    if (deliriumCheck.score >= 1) {
      triggers.push({
        id: 'delirium-screening',
        name: 'Delirium Prevention',
        category: 'delirium',
        confidence: Math.min(100, deliriumCheck.score * 50),
        matchedTriggers: deliriumCheck.matches.slice(0, 3),
        description: PROTOCOL_DEFINITIONS.find(p => p.id === 'delirium-screening')?.description || '',
        actionItems: PROTOCOL_DEFINITIONS.find(p => p.id === 'delirium-screening')?.actionItems || [],
        icon: Activity,
        urgency: 'moderate',
      });
    }

    const painCheck = checkKeywords(PAIN_KEYWORDS, 1);
    if (painCheck.score >= 1) {
      triggers.push({
        id: 'pain-management',
        name: 'Pain Management Protocol',
        category: 'pain',
        confidence: Math.min(100, painCheck.score * 40),
        matchedTriggers: painCheck.matches.slice(0, 3),
        description: PROTOCOL_DEFINITIONS.find(p => p.id === 'pain-management')?.description || '',
        actionItems: PROTOCOL_DEFINITIONS.find(p => p.id === 'pain-management')?.actionItems || [],
        icon: Heart,
        urgency: 'moderate',
      });
    }

    return triggers.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || b.confidence - a.confidence;
    });
  };

  React.useEffect(() => {
    const allSuggestions = new Map<string, ProtocolTrigger[]>();
    patients.forEach(patient => {
      const suggestions = analyzePatientForProtocols(patient);
      if (suggestions.length > 0) {
        allSuggestions.set(patient.id, suggestions);
      }
    });
    setSuggestedProtocols(allSuggestions);
  }, [patients]);

  const getAllSuggestions = (): Array<{ patient: Patient; protocol: ProtocolTrigger }> => {
    const all: Array<{ patient: Patient; protocol: ProtocolTrigger }> = [];
    patients.forEach(patient => {
      const protocols = suggestedProtocols.get(patient.id) || [];
      protocols.forEach(protocol => {
        all.push({ patient, protocol });
      });
    });
    return all.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      return urgencyOrder[a.protocol.urgency] - urgencyOrder[b.protocol.urgency] || b.protocol.confidence - a.protocol.confidence;
    });
  };

  const getSuggestionsByUrgency = (urgency: string): Array<{ patient: Patient; protocol: ProtocolTrigger }> => {
    return getAllSuggestions().filter(s => s.protocol.urgency === urgency);
  };

  const handleActivateProtocol = (patientId: string, protocolId: string) => {
    onProtocolActivate(patientId, protocolId);
    toast.success('Protocol activated');
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800';
      case 'high':
        return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800';
      case 'moderate':
        return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800';
      case 'low':
        return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800';
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <Badge variant="destructive" className="gap-1"><Zap className="h-3 w-3" />Critical</Badge>;
      case 'high':
        return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600"><AlertTriangle className="h-3 w-3" />High</Badge>;
      case 'moderate':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Moderate</Badge>;
      case 'low':
        return <Badge variant="outline" className="gap-1"><Info className="h-3 w-3" />Low</Badge>;
    }
  };

  const allSuggestions = getAllSuggestions();
  const criticalCount = getSuggestionsByUrgency('critical').length;
  const highCount = getSuggestionsByUrgency('high').length;
  const moderateCount = getSuggestionsByUrgency('moderate').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 relative">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Protocols</span>
          {(criticalCount + highCount) > 0 && (
            <Badge 
              variant={criticalCount > 0 ? 'destructive' : 'secondary'} 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
            >
              {criticalCount + highCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Protocol Trigger Suggestions</DialogTitle>
          <DialogDescription>
            AI-detected protocols that may be relevant for your patients
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="all">
                All ({allSuggestions.length})
              </TabsTrigger>
              <TabsTrigger value="critical">
                Critical ({criticalCount})
              </TabsTrigger>
              <TabsTrigger value="high">
                High ({highCount})
              </TabsTrigger>
              <TabsTrigger value="moderate">
                Moderate ({moderateCount})
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {(activeTab === 'all' ? allSuggestions : 
               activeTab === 'critical' ? getSuggestionsByUrgency('critical') :
               activeTab === 'high' ? getSuggestionsByUrgency('high') :
               getSuggestionsByUrgency('moderate')).map(({ patient, protocol }) => {
                const Icon = protocol.icon;
                return (
                  <Card key={`${patient.id}-${protocol.id}`} className={getUrgencyColor(protocol.urgency)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getUrgencyColor(protocol.urgency)}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-base">{protocol.name}</CardTitle>
                              {getUrgencyBadge(protocol.urgency)}
                            </div>
                            <CardDescription className="text-xs">
                              {patient.name} • {patient.bed}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{protocol.confidence}%</div>
                          <div className="text-[10px] text-muted-foreground">confidence</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <p className="text-sm mb-2">{protocol.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {protocol.matchedTriggers.map((trigger, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {trigger}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-xs font-medium mb-2">Key Actions</div>
                        <ul className="space-y-1">
                          {protocol.actionItems.slice(0, 3).map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleActivateProtocol(patient.id, protocol.id)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Activate Protocol
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            toast.dismiss();
                            toast.info(`Protocol details for ${protocol.name}`);
                          }}
                        >
                          <Info className="h-3.5 w-3.5 mr-1.5" />
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {allSuggestions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-muted/50 rounded-full p-4 mb-4">
                  <ShieldCheck className="h-12 w-12 text-muted-foreground/40" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No Protocol Suggestions</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Continue documenting patient data. The system will automatically suggest relevant protocols as clinical information is entered.
                </p>
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
