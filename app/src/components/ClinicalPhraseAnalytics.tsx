import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import {
  TrendingUp,
  Clock,
  FileText,
  Sparkles,
  ArrowUpRight,
  Copy,
  Check,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import type { ClinicalPhrase } from "@/types/phrases";
import { supabase } from "@/integrations/supabase/client";
import { hasSupabaseConfig } from "@/integrations/supabase/client";
import {
  buildPhraseUsageStats,
  ESTIMATED_SECONDS_SAVED_PER_USE,
  type PhraseUsageStats,
} from "@/lib/clinicalPhraseAnalytics";

interface SuggestedPhrase {
  text: string;
  frequency: number;
  estimatedSavings: number;
  existingShortcut?: string;
}

interface PhraseAnalyticsProps {
  phrases: ClinicalPhrase[];
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function ClinicalPhraseAnalytics({ phrases }: PhraseAnalyticsProps) {
  const [open, setOpen] = React.useState(false);
  const [usageStats, setUsageStats] = React.useState<PhraseUsageStats[]>([]);
  const [suggestedPhrases, setSuggestedPhrases] = React.useState<SuggestedPhrase[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [timeRange, setTimeRange] = React.useState<'7d' | '30d' | '90d'>('30d');

  const fetchUsageStats = React.useCallback(async () => {
    if (!hasSupabaseConfig) return;

    setLoading(true);
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

      const { data: usageData, error } = await supabase
        .from('phrase_usage_log')
        .select('phrase_id, created_at')
        .gte('created_at', cutoffDate);

      if (error) throw error;

      setUsageStats(buildPhraseUsageStats(phrases, usageData ?? []));
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      toast.error('Phrase usage statistics could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [phrases, timeRange]);

  const generateSuggestions = React.useCallback(async () => {
    if (!hasSupabaseConfig) return;

    try {
      const { data: recentNotes } = await supabase
        .from('patients')
        .select('clinical_summary, systems')
        .order('last_modified', { ascending: false })
        .limit(50);

      if (!recentNotes) return;

      const textSegments: string[] = [];
      recentNotes.forEach(note => {
        if (note.clinical_summary) textSegments.push(note.clinical_summary);
        if (note.systems) {
          Object.values(note.systems).forEach(system => {
            if (system) textSegments.push(system);
          });
        }
      });

      const patterns = new Map<string, number>();
      const sentences = textSegments.join(' ').split(/[.!?]+/);

      sentences.forEach(sentence => {
        const trimmed = sentence.trim();
        if (trimmed.length > 30 && trimmed.length < 200) {
          const key = trimmed.substring(0, 50);
          patterns.set(key, (patterns.get(key) || 0) + 1);
        }
      });

      const suggestions: SuggestedPhrase[] = Array.from(patterns.entries())
        .filter(([_, count]) => count >= 3)
        .map(([text, frequency]) => {
          const existingPhrase = phrases.find(p => 
            (p.shortcut?.toLowerCase().includes(text.substring(0, 10).toLowerCase()) ?? false) ||
            p.name.toLowerCase().includes(text.substring(0, 10).toLowerCase())
          );

          return {
            text: text + '...',
            frequency,
            estimatedSavings: frequency * ESTIMATED_SECONDS_SAVED_PER_USE,
            existingShortcut: existingPhrase?.shortcut ?? undefined,
          };
        })
        .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
        .slice(0, 10);

      setSuggestedPhrases(suggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Phrase suggestions could not be generated');
    }
  }, [phrases]);

  React.useEffect(() => {
    if (open) {
      fetchUsageStats();
      generateSuggestions();
    }
  }, [open, fetchUsageStats, generateSuggestions]);

  const chartData = usageStats.slice(0, 10).map(stat => ({
    name: stat.phraseShortcut,
    usage: stat.usageCount,
  }));

  const pieData = usageStats.slice(0, 5).map((stat, index) => ({
    name: stat.phraseShortcut,
    value: stat.usageCount,
    color: COLORS[index % COLORS.length],
  }));

  const usageComparisonData = usageStats.slice(0, 7).map((stat) => ({
    name: stat.phraseShortcut.substring(0, 8),
    usage: stat.usageCount,
  }));

  const totalUsage = usageStats.reduce((sum, stat) => sum + stat.usageCount, 0);
  const totalTimeSaved = totalUsage * ESTIMATED_SECONDS_SAVED_PER_USE;
  const avgUsagePerDay = totalUsage / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Analytics</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Clinical Phrase Analytics</DialogTitle>
              <DialogDescription>
                Track usage patterns and discover new automation opportunities
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {['7d', '30d', '90d'].map(range => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range as typeof timeRange)}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" aria-busy={loading}>
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
              <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Usage</CardDescription>
                    <CardTitle className="text-2xl">{totalUsage}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <ArrowUpRight className="h-3 w-3 mr-1 text-green-700 dark:text-green-400" />
                      {avgUsagePerDay.toFixed(1)} per day
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Time Saved</CardDescription>
                    <CardTitle className="text-2xl">
                      {totalTimeSaved >= 3600 
                        ? `${(totalTimeSaved / 3600).toFixed(1)}h`
                        : `${Math.round(totalTimeSaved / 60)}m`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      Assumes {ESTIMATED_SECONDS_SAVED_PER_USE}s per use
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Active Phrases</CardDescription>
                    <CardTitle className="text-2xl">{usageStats.length}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <FileText className="h-3 w-3 mr-1" />
                      of {phrases.length} total
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Potential Savings</CardDescription>
                    <CardTitle className="text-2xl">
                      {suggestedPhrases.reduce((sum, s) => sum + s.estimatedSavings, 0) >= 3600
                        ? `${(suggestedPhrases.reduce((sum, s) => sum + s.estimatedSavings, 0) / 3600).toFixed(1)}h`
                        : `${Math.round(suggestedPhrases.reduce((sum, s) => sum + s.estimatedSavings, 0) / 60)}m`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {suggestedPhrases.length} suggestions
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Phrases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip />
                        <Bar dataKey="usage" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Usage Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="usage" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                    <CardTitle className="text-base">Usage Comparison</CardTitle>
                    <CardDescription>Phrase counts for the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={usageComparisonData}>
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Line type="monotone" dataKey="usage" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detailed Usage</CardTitle>
                  <CardDescription>All phrases with usage statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {usageStats.map((stat, index) => (
                      <div
                        key={stat.phraseId}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              #{index + 1}
                            </Badge>
                            <span className="font-medium">{stat.phraseShortcut}</span>
                            <span className="text-muted-foreground text-sm truncate">
                              {stat.phraseTitle}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {stat.usageCount} uses
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {stat.lastUsed ? new Date(stat.lastUsed).toLocaleDateString() : 'Never'}
                            </span>
                          </div>
                        </div>
                        <Progress 
                          value={(stat.usageCount / Math.max(...usageStats.map(s => s.usageCount))) * 100} 
                          className="w-20 h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suggestions" className="space-y-4 mt-4">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">Pattern-Based Suggestions</h3>
                    <p className="text-sm text-muted-foreground">
                      Repeated text from recent documentation is surfaced as a possible shortcut.
                      Savings use the stated {ESTIMATED_SECONDS_SAVED_PER_USE}-second estimate per occurrence.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {suggestedPhrases.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">
                        No suggestions yet. Continue using phrases to generate personalized recommendations.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  suggestedPhrases.map((suggestion, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {suggestion.frequency} occurrences
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                ~{suggestion.estimatedSavings}s saved
                              </Badge>
                              {suggestion.existingShortcut && (
                                <Badge variant="default" className="text-xs">
                                  <Check className="h-3 w-3 mr-1" />
                                  Exists
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm mb-3 line-clamp-2">
                              {suggestion.text}
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={() => {
                                  navigator.clipboard.writeText(suggestion.text);
                                  toast.success('Copied to clipboard');
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="efficiency" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Time Saved Analysis</CardTitle>
                  <CardDescription>Estimated time saved by using phrases instead of typing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {usageStats.slice(0, 10).map((stat, index) => {
                      const timeSaved = stat.usageCount * ESTIMATED_SECONDS_SAVED_PER_USE;
                      return (
                        <div key={stat.phraseId}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                #{index + 1}
                              </Badge>
                              <span className="font-medium">{stat.phraseShortcut}</span>
                            </div>
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>{stat.usageCount} uses</span>
                              <span className="font-medium">
                                {timeSaved >= 60 
                                  ? `${(timeSaved / 60).toFixed(1)}m`
                                  : `${Math.round(timeSaved)}s`}
                              </span>
                            </div>
                          </div>
                          <Progress 
                            value={(timeSaved / Math.max(...usageStats.map(s => s.usageCount * ESTIMATED_SECONDS_SAVED_PER_USE))) * 100}
                            className="h-2"
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Efficiency Tips</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" />
                      <span>Create shortcuts for phrases you use 3+ times per day</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" />
                      <span>Keep shortcut names short and memorable (2-4 characters)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" />
                      <span>Use consistent naming conventions (e.g., all uppercase for emergencies)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-700 dark:text-green-400 mt-0.5 shrink-0" />
                      <span>Review analytics weekly to identify new automation opportunities</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
