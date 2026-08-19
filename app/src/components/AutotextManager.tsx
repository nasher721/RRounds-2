import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Zap, 
  FileText, 
  Book, 
  Plus, 
  Trash2, 
  Search,
  Copy,
  Sparkles,
  Download,
  Upload
} from "lucide-react";
import { medicalDictionary } from "@/data/autotexts";
import { stripHtml } from "@/lib/sanitize";
import type { AutoText, Template } from "@/types/autotext";
import { useToast } from "@/hooks/use-toast";
import { getUserFacingErrorMessage, UserFacingError } from "@/lib/userFacingErrors";

interface AutotextManagerProps {
  onInsertText?: (text: string) => void;
  autotexts?: AutoText[];
  templates?: Template[];
  customDictionary?: Record<string, string>;
  onAddAutotext?: (shortcut: string, expansion: string, category: string) => Promise<boolean>;
  onRemoveAutotext?: (shortcut: string) => Promise<void>;
  onAddTemplate?: (name: string, content: string, category: string) => Promise<boolean>;
  onRemoveTemplate?: (id: string) => Promise<void>;
  onImportDictionary?: (entries: Record<string, string>) => Promise<boolean | void>;
}

export const AutotextManager = ({ 
  onInsertText,
  autotexts = [],
  templates = [],
  customDictionary = {},
  onAddAutotext,
  onRemoveAutotext,
  onAddTemplate,
  onRemoveTemplate,
  onImportDictionary,
}: AutotextManagerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [newShortcut, setNewShortcut] = useState("");
  const [newExpansion, setNewExpansion] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("Custom");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge default dictionary with custom entries
  const fullDictionary = { ...medicalDictionary, ...customDictionary };

  // Export dictionary to JSON file
  const handleExportDictionary = () => {
    const data = JSON.stringify(fullDictionary, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medical-dictionary.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Dictionary exported", description: `${Object.keys(fullDictionary).length} entries exported` });
  };

  // Import dictionary from JSON file
  const handleImportDictionary = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate the data structure
      if (typeof data !== "object" || data === null) {
        throw new UserFacingError("Invalid dictionary format");
      }

      // Validate all entries are string -> string
      const validEntries: Record<string, string> = {};
      let invalidCount = 0;
      
      for (const [key, value] of Object.entries(data)) {
        if (typeof key === "string" && typeof value === "string") {
          validEntries[key.toLowerCase()] = value;
        } else {
          invalidCount++;
        }
      }

      if (Object.keys(validEntries).length === 0) {
        throw new UserFacingError("No valid dictionary entries found");
      }

      if (onImportDictionary) {
        await onImportDictionary(validEntries);
      }

      toast({ 
        title: "Dictionary imported", 
        description: `${Object.keys(validEntries).length} entries imported${invalidCount > 0 ? `, ${invalidCount} invalid entries skipped` : ""}` 
      });
    } catch (error) {
      console.error("Dictionary import failed");
      toast({ 
        title: "Import failed", 
        description: getUserFacingErrorMessage(error, "Failed to parse dictionary file"),
        variant: "destructive" 
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddAutotext = async () => {
    if (!newShortcut || !newExpansion) return;
    
    if (onAddAutotext) {
      const success = await onAddAutotext(newShortcut, newExpansion, newCategory);
      if (success) {
        setNewShortcut("");
        setNewExpansion("");
      }
    }
  };

  const handleRemoveAutotext = async (shortcut: string) => {
    if (onRemoveAutotext) {
      await onRemoveAutotext(shortcut);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplateName || !newTemplateContent) return;
    
    if (onAddTemplate) {
      const success = await onAddTemplate(newTemplateName, newTemplateContent, newTemplateCategory);
      if (success) {
        setNewTemplateName("");
        setNewTemplateContent("");
      }
    }
  };

  const handleRemoveTemplate = async (id: string) => {
    if (onRemoveTemplate) {
      await onRemoveTemplate(id);
    }
  };

  const insertTemplate = (content: string) => {
    if (onInsertText) {
      onInsertText(content);
      setOpen(false);
      toast({ title: "Template inserted" });
    } else {
      navigator.clipboard.writeText(content);
      toast({ title: "Template copied to clipboard" });
    }
  };

  const handleCopyExpansion = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied expansion" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const searchLower = searchQuery.toLowerCase();

  const filteredAutotexts = autotexts.filter(a =>
    a.shortcut.toLowerCase().includes(searchLower) ||
    a.expansion.toLowerCase().includes(searchLower) ||
    a.category.toLowerCase().includes(searchLower)
  );

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchLower) ||
    t.category.toLowerCase().includes(searchLower) ||
    t.content.toLowerCase().includes(searchLower)
  );

  const autotextCategories = [...new Set(autotexts.map(a => a.category))];
  const templateCategories = [...new Set(templates.map(t => t.category))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Autotexts & Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Autotexts, Templates & Dictionary
          </DialogTitle>
          <DialogDescription>
            Shortcuts expand as you type in note fields. Use{" "}
            <span className="font-medium text-foreground">Manage Phrases</span>{" "}
            for longer snippets, folders, placeholders, and version history.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search autotexts, templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="autotexts" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="autotexts" className="gap-2">
              <Zap className="h-4 w-4" />
              Autotexts ({autotexts.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="dictionary" className="gap-2">
              <Book className="h-4 w-4" />
              Dictionary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="autotexts" className="flex-1 overflow-hidden flex flex-col m-0 pt-4">
            {/* Add new autotext */}
            <Card className="p-3 mb-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block">Shortcut</label>
                  <Input
                    placeholder="e.g., vss"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="text-xs font-medium mb-1 block">Expansion</label>
                  <Input
                    placeholder="e.g., Vital signs stable"
                    value={newExpansion}
                    onChange={(e) => setNewExpansion(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs font-medium mb-1 block">Category</label>
                  <Input
                    placeholder="Category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="h-8"
                  />
                </div>
                <Button onClick={handleAddAutotext} size="sm" className="h-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            <ScrollArea className="flex-1">
              {filteredAutotexts.length === 0 && autotexts.length > 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No autotexts match your search. Try another term or clear the search box.
                </p>
              ) : (
              <div className="space-y-2">
                {autotextCategories.map(category => {
                  const categoryAutotexts = filteredAutotexts.filter(a => a.category === category);
                  if (categoryAutotexts.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                        {category}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {categoryAutotexts.map(autotext => (
                          <div 
                            key={autotext.shortcut} 
                            className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 group"
                          >
                            <Badge variant="secondary" className="font-mono text-xs">
                              {autotext.shortcut}
                            </Badge>
                            <span className="flex-1 text-sm truncate">{autotext.expansion}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-70 md:opacity-0 md:group-hover:opacity-100"
                              aria-label="Copy expansion"
                              onClick={() => handleCopyExpansion(autotext.expansion)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              onClick={() => handleRemoveAutotext(autotext.shortcut)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </ScrollArea>

            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              💡 Type the shortcut followed by a space or tab to auto-expand
            </div>
          </TabsContent>

          <TabsContent value="templates" className="flex-1 overflow-hidden flex flex-col m-0 pt-4">
            {/* Add new template */}
            <Card className="p-3 mb-4">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Template name"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      placeholder="Category"
                      value={newTemplateCategory}
                      onChange={(e) => setNewTemplateCategory(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <Button onClick={handleAddTemplate} size="sm" className="h-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  placeholder="Template content (supports HTML formatting)"
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  rows={2}
                />
              </div>
            </Card>

            <ScrollArea className="flex-1">
              {filteredTemplates.length === 0 && templates.length > 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No templates match your search. Try another term or clear the search box.
                </p>
              ) : (
              <div className="space-y-3">
                {templateCategories.map(category => {
                  const categoryTemplates = filteredTemplates.filter(t => t.category === category);
                  if (categoryTemplates.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        {category}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {categoryTemplates.map(template => (
                          <Card 
                            key={template.id} 
                            className="p-3 hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => insertTemplate(template.content)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="font-medium text-sm">{template.name}</span>
                              <div className="flex gap-1">
                                <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                {template.id.startsWith('custom-') || !template.id.includes('-') ? null : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveTemplate(template.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-3">
                              {stripHtml(template.content).substring(0, 150)}
                              {template.content.length > 150 ? "…" : ""}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </ScrollArea>

            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              💡 Click a template to insert it (or copy to clipboard)
            </div>
          </TabsContent>

          <TabsContent value="dictionary" className="flex-1 overflow-hidden flex flex-col m-0 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm">
                Medical spelling dictionary with <strong>{Object.keys(fullDictionary).length}</strong> autocorrect entries. 
                Common misspellings are automatically corrected as you type.
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportDictionary}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={handleExportDictionary}
                >
                  <Download className="h-3 w-3" />
                  Export
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                {Object.entries(fullDictionary)
                  .filter(([wrong, correct]) => 
                    wrong.includes(searchQuery.toLowerCase()) || 
                    correct.includes(searchQuery.toLowerCase())
                  )
                  .map(([wrong, correct]) => (
                    <div key={wrong} className="text-xs p-2 bg-muted/30 rounded">
                      <span className="text-destructive line-through">{wrong}</span>
                      <span className="mx-1">→</span>
                      <span className="text-success font-medium">{correct}</span>
                    </div>
                  ))
                }
              </div>
            </ScrollArea>
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              💡 Export to backup your dictionary or import a JSON file with {"{"}"misspelling": "correction"{"}"}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
