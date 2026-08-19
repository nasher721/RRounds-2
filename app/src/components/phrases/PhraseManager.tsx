/**
 * Phrase Manager - Full CRUD interface for managing clinical phrases
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhraseContentEditor } from './PhraseContentEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Folder,
  FileText,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  History,
  FolderPlus,
  Loader2,
  Keyboard,
  Zap,
  ChevronRight,
  ChevronDown,
  Settings2,
  ArrowDownWideNarrow,
  AlertCircle,
} from 'lucide-react';
import { useClinicalPhrases } from '@/hooks/useClinicalPhrases';
import { useCloudAutotexts } from '@/hooks/useAutotexts';
import { PhraseFieldEditor } from './PhraseFieldEditor';
import type { ClinicalPhrase, PhraseFolder, PhraseField, PhraseVersion } from '@/types/phrases';
import { toast } from 'sonner';
import { ClinicalPhraseAnalytics } from '@/components/ClinicalPhraseAnalytics';
import { getPhraseShortcutConflicts } from '@/lib/phraseShortcutConflicts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PhraseManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PhraseManager: React.FC<PhraseManagerProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    phrases,
    folders,
    loading,
    createPhrase,
    updatePhrase,
    deletePhrase,
    createFolder,
    updateFolder,
    deleteFolder,
    getPhraseFields,
    addPhraseField,
    updatePhraseField,
    deletePhraseField,
    getPhraseVersions,
    restoreVersion,
  } = useClinicalPhrases();

  const { autotexts: autotextsForConflicts } = useCloudAutotexts();

  const [search, setSearch] = useState('');
  const [phraseSort, setPhraseSort] = useState<'name' | 'recent' | 'usage'>('name');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Edit state
  const [editingPhrase, setEditingPhrase] = useState<ClinicalPhrase | null>(null);
  const [editingFolder, setEditingFolder] = useState<PhraseFolder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'phrase' | 'folder'; id: string; name: string } | null>(null);

  // Version history
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<PhraseVersion[]>([]);
  const [versionPhrase, setVersionPhrase] = useState<ClinicalPhrase | null>(null);

  // Dynamic fields state
  const [phraseFields, setPhraseFields] = useState<PhraseField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    shortcut: '',
    hotkey: '',
    isActive: true,
    folderId: null as string | null,
  });

  const [folderFormData, setFolderFormData] = useState({
    name: '',
    description: '',
    parentId: null as string | null,
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setEditingPhrase(null);
      setEditingFolder(null);
      setIsCreating(false);
      setIsCreatingFolder(false);
      setShowVersions(false);
      setPhraseFields([]);
    }
  }, [open]);

  // Load phrase data into form
  useEffect(() => {
    if (editingPhrase) {
      setFormData({
        name: editingPhrase.name,
        description: editingPhrase.description || '',
        content: editingPhrase.content,
        shortcut: editingPhrase.shortcut || '',
        hotkey: editingPhrase.hotkey || '',
        isActive: editingPhrase.isActive,
        folderId: editingPhrase.folderId || null,
      });
      // Load phrase fields
      setLoadingFields(true);
      getPhraseFields(editingPhrase.id).then(fields => {
        setPhraseFields(fields);
        setLoadingFields(false);
      }).catch(() => {
        setLoadingFields(false);
      });
    } else if (isCreating) {
      setFormData({
        name: '',
        description: '',
        content: '',
        shortcut: '',
        hotkey: '',
        isActive: true,
        folderId: selectedFolder,
      });
      setPhraseFields([]);
    }
  }, [editingPhrase, isCreating, selectedFolder, getPhraseFields]);

  useEffect(() => {
    if (editingFolder) {
      setFolderFormData({
        name: editingFolder.name,
        description: editingFolder.description || '',
        parentId: editingFolder.parentId || null,
      });
    } else if (isCreatingFolder) {
      setFolderFormData({
        name: '',
        description: '',
        parentId: selectedFolder,
      });
    }
  }, [editingFolder, isCreatingFolder, selectedFolder]);

  // Filter phrases
  const searchLower = search.toLowerCase();
  const filteredPhrases = phrases.filter(p => {
    const matchesSearch = !search ||
      p.name.toLowerCase().includes(searchLower) ||
      p.content.toLowerCase().includes(searchLower) ||
      p.shortcut?.toLowerCase().includes(searchLower);
    
    const matchesFolder = !selectedFolder || p.folderId === selectedFolder;
    
    return matchesSearch && matchesFolder;
  });

  const displayPhrases = useMemo(() => {
    const list = [...filteredPhrases];
    if (phraseSort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (phraseSort === 'recent') {
      list.sort((a, b) => {
        const ta = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const tb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        return tb - ta;
      });
    } else {
      list.sort((a, b) => b.usageCount - a.usageCount);
    }
    return list;
  }, [filteredPhrases, phraseSort]);

  const shortcutConflicts = useMemo(
    () =>
      getPhraseShortcutConflicts(formData.shortcut, {
        autotextShortcuts: autotextsForConflicts.map((a) => a.shortcut),
        phrases: phrases.map((p) => ({
          id: p.id,
          shortcut: p.shortcut ?? null,
          name: p.name,
        })),
        excludePhraseId: editingPhrase?.id,
      }),
    [formData.shortcut, autotextsForConflicts, phrases, editingPhrase?.id],
  );

  // Build folder tree
  const getFolderChildren = useCallback((parentId: string | null): PhraseFolder[] => {
    return folders
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [folders]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleSavePhrase = useCallback(async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Name and content are required');
      return;
    }

    let phraseId: string;

    if (editingPhrase) {
      await updatePhrase(editingPhrase.id, {
        name: formData.name,
        description: formData.description || null,
        content: formData.content,
        shortcut: formData.shortcut || null,
        hotkey: formData.hotkey || null,
        isActive: formData.isActive,
        isShared: false,
        folderId: formData.folderId,
      });
      phraseId = editingPhrase.id;

      // Sync phrase fields: get existing, update/add/delete as needed
      const existingFields = await getPhraseFields(phraseId);
      const existingIds = new Set(existingFields.map(f => f.id));
      const currentIds = new Set(phraseFields.map(f => f.id));

      // Delete removed fields
      for (const existing of existingFields) {
        if (!currentIds.has(existing.id)) {
          await deletePhraseField(existing.id);
        }
      }

      // Update or add fields
      for (let i = 0; i < phraseFields.length; i++) {
        const field = phraseFields[i];
        if (existingIds.has(field.id) && !field.id.startsWith('temp_')) {
          // Update existing
          await updatePhraseField(field.id, {
            fieldKey: field.fieldKey,
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder,
            defaultValue: field.defaultValue,
            options: field.options,
            validation: field.validation,
            conditionalLogic: field.conditionalLogic,
            calculationFormula: field.calculationFormula,
            sortOrder: i,
          });
        } else {
          // Add new
          await addPhraseField({
            phraseId,
            fieldKey: field.fieldKey,
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder,
            defaultValue: field.defaultValue,
            options: field.options,
            validation: field.validation,
            conditionalLogic: field.conditionalLogic,
            calculationFormula: field.calculationFormula,
            sortOrder: i,
          });
        }
      }

      setEditingPhrase(null);
    } else {
      const newPhrase = await createPhrase({
        name: formData.name,
        description: formData.description || null,
        content: formData.content,
        shortcut: formData.shortcut || null,
        hotkey: formData.hotkey || null,
        contextTriggers: {},
        isActive: formData.isActive,
        isShared: false,
        folderId: formData.folderId,
        lastUsedAt: null,
      });

      if (newPhrase && phraseFields.length > 0) {
        // Add all fields for new phrase
        for (let i = 0; i < phraseFields.length; i++) {
          const field = phraseFields[i];
          await addPhraseField({
            phraseId: newPhrase.id,
            fieldKey: field.fieldKey,
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder,
            defaultValue: field.defaultValue,
            options: field.options,
            validation: field.validation,
            conditionalLogic: field.conditionalLogic,
            calculationFormula: field.calculationFormula,
            sortOrder: i,
          });
        }
      }

      setIsCreating(false);
    }
    setPhraseFields([]);
  }, [formData, editingPhrase, phraseFields, updatePhrase, createPhrase, getPhraseFields, addPhraseField, updatePhraseField, deletePhraseField]);

  const handleSaveFolder = useCallback(async () => {
    if (!folderFormData.name.trim()) {
      toast.error('Folder name is required');
      return;
    }

    if (editingFolder) {
      await updateFolder(editingFolder.id, {
        name: folderFormData.name,
        description: folderFormData.description || null,
        parentId: folderFormData.parentId,
      });
      setEditingFolder(null);
    } else {
      await createFolder({
        name: folderFormData.name,
        description: folderFormData.description || null,
        parentId: folderFormData.parentId,
        teamId: null,
        icon: 'folder',
        sortOrder: folders.length,
        isShared: false,
      });
      setIsCreatingFolder(false);
    }
  }, [folderFormData, editingFolder, updateFolder, createFolder, folders.length]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'phrase') {
      await deletePhrase(deleteTarget.id);
    } else {
      await deleteFolder(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, deletePhrase, deleteFolder]);

  const handleViewVersions = useCallback(async (phrase: ClinicalPhrase) => {
    const history = await getPhraseVersions(phrase.id);
    setVersions(history);
    setVersionPhrase(phrase);
    setShowVersions(true);
  }, [getPhraseVersions]);

  const handleRestoreVersion = useCallback(async (version: PhraseVersion) => {
    if (!versionPhrase) return;
    await restoreVersion(versionPhrase.id, version);
    setShowVersions(false);
    setVersionPhrase(null);
    toast.success('Version restored');
  }, [versionPhrase, restoreVersion]);

  const renderFolderTree = (parentId: string | null = null, level = 0) => {
    const children = getFolderChildren(parentId);
    
    return children.map(folder => {
      const isExpanded = expandedFolders.has(folder.id);
      const hasChildren = folders.some(f => f.parentId === folder.id);
      const phraseCount = phrases.filter(p => p.folderId === folder.id).length;

      return (
        <div key={folder.id}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent ${
              selectedFolder === folder.id ? 'bg-accent' : ''
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => setSelectedFolder(folder.id)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.id);
                }}
                className="p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}
            <Folder className="h-4 w-4 text-primary" />
            <span className="flex-1 truncate text-sm">{folder.name}</span>
            <Badge variant="secondary" className="text-xs">
              {phraseCount}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditingFolder(folder)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {isExpanded && renderFolderTree(folder.id, level + 1)}
        </div>
      );
    });
  };

  // Form view
  if (editingPhrase || isCreating) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingPhrase ? 'Edit Phrase' : 'New Phrase'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create or update a reusable clinical phrase and its shortcuts.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., SOB Denial"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="folder">Folder</Label>
                  <Select
                    value={formData.folderId || 'none'}
                    onValueChange={v => setFormData(prev => ({ ...prev, folderId: v === 'none' ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No folder</SelectItem>
                      {folders.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of when to use this phrase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <PhraseContentEditor
                  value={formData.content}
                  onChange={(val) => setFormData(prev => ({ ...prev, content: val }))}
                  placeholder="Patient denies shortness of breath at rest or with exertion."
                  minHeight="150px"
                />
              </div>

              <Separator />

              {/* Dynamic Fields Section */}
              {loadingFields ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <PhraseFieldEditor
                  fields={phraseFields}
                  onChange={setPhraseFields}
                  phraseContent={formData.content}
                />
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shortcut" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Autotext Shortcut
                  </Label>
                  <Input
                    id="shortcut"
                    value={formData.shortcut}
                    onChange={e => setFormData(prev => ({ ...prev, shortcut: e.target.value }))}
                    placeholder=".sob"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotkey" className="flex items-center gap-2">
                    <Keyboard className="h-4 w-4" />
                    Keyboard Shortcut
                  </Label>
                  <Input
                    id="hotkey"
                    value={formData.hotkey}
                    onChange={e => setFormData(prev => ({ ...prev, hotkey: e.target.value }))}
                    placeholder="ctrl+shift+1"
                    autoComplete="off"
                  />
                </div>
              </div>

              {shortcutConflicts.length > 0 && (
                <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                  <AlertTitle className="text-amber-900 dark:text-amber-100">Shortcut overlap</AlertTitle>
                  <AlertDescription className="text-amber-900/90 dark:text-amber-50/90">
                    <ul className="list-disc pl-4 space-y-1 text-sm">
                      {shortcutConflicts.some((c) => c.type === 'autotext') && (
                        <li>
                          This matches an autotext shortcut. In note fields, Space or Tab expands the{' '}
                          <span className="font-medium">autotext</span> first.
                        </li>
                      )}
                      {shortcutConflicts
                        .filter((c) => c.type === 'phrase')
                        .map((c, i) => (
                          <li key={`${c.label}-${i}`}>
                            Another phrase already uses this shortcut: &quot;{c.label}&quot;.
                          </li>
                        ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Enable or disable this phrase</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={v => setFormData(prev => ({ ...prev, isActive: v }))}
                />
              </div>

            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingPhrase(null);
              setIsCreating(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSavePhrase}>
              {editingPhrase ? 'Save Changes' : 'Create Phrase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Folder form view
  if (editingFolder || isCreatingFolder) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? 'Edit Folder' : 'New Folder'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Organize related clinical phrases into folders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Name *</Label>
              <Input
                id="folderName"
                value={folderFormData.name}
                onChange={e => setFolderFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., SOAP Notes"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="folderDesc">Description</Label>
              <Input
                id="folderDesc"
                value={folderFormData.description}
                onChange={e => setFolderFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Phrases for SOAP documentation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentFolder">Parent Folder</Label>
              <Select
                value={folderFormData.parentId || 'none'}
                onValueChange={v => setFolderFormData(prev => ({ ...prev, parentId: v === 'none' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (root level)</SelectItem>
                  {folders
                    .filter(f => f.id !== editingFolder?.id)
                    .map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingFolder(null);
              setIsCreatingFolder(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveFolder}>
              {editingFolder ? 'Save Changes' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Version history view
  if (showVersions && versionPhrase) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History: {versionPhrase.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Review earlier phrase versions and restore a prior draft if needed.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-3">
              {/* Current version */}
              <div className="p-3 border rounded-lg bg-accent/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge>Current</Badge>
                    <span className="text-sm text-muted-foreground">
                      v{versionPhrase.version}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(versionPhrase.updatedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-mono whitespace-pre-wrap">
                  {versionPhrase.content}
                </p>
              </div>

              {versions.map(version => (
                <div key={version.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      v{version.version}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreVersion(version)}
                      >
                        Restore
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-mono whitespace-pre-wrap">
                    {version.content}
                  </p>
                  {version.changeNote && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Note: {version.changeNote}
                    </p>
                  )}
                </div>
              ))}

              {versions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No previous versions
                </p>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowVersions(false);
              setVersionPhrase(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Main list view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle>Clinical Phrase Manager</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-normal pt-1">
            Folders and placeholders for reusable blocks. Short inline shorthand lives under Autotexts &amp; Templates in settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Folders */}
          <div className="w-64 border-r border-border/50 flex flex-col">
            <div className="p-3 border-b border-border/50">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setIsCreatingFolder(true)}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-accent ${
                    !selectedFolder ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedFolder(null)}
                >
                  <FileText className="h-4 w-4" />
                  <span className="flex-1 text-sm">All Phrases</span>
                  <Badge variant="secondary" className="text-xs">
                    {phrases.length}
                  </Badge>
                </div>
                <Separator className="my-2" />
                {renderFolderTree()}
              </div>
            </ScrollArea>
          </div>

          {/* Main content - Phrases */}
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-border/50 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search phrases..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={phraseSort} onValueChange={v => setPhraseSort(v as 'name' | 'recent' | 'usage')}>
                <SelectTrigger className="w-[200px] gap-2" aria-label="Sort phrases">
                  <ArrowDownWideNarrow className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A–Z)</SelectItem>
                  <SelectItem value="recent">Recently used</SelectItem>
                  <SelectItem value="usage">Most used</SelectItem>
                </SelectContent>
              </Select>
              <ClinicalPhraseAnalytics phrases={phrases} />
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Phrase
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPhrases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground px-4 text-center">
                  <FileText className="h-12 w-12 mb-2 opacity-50" />
                  {phrases.length === 0 ? (
                    <>
                      <p>No phrases yet</p>
                      <Button
                        variant="link"
                        onClick={() => setIsCreating(true)}
                        className="mt-2"
                      >
                        Create your first phrase
                      </Button>
                    </>
                  ) : (
                    <>
                      <p>No phrases match this folder or search</p>
                      <p className="text-xs mt-2 max-w-sm">
                        Clear the search box, choose &quot;All Phrases&quot;, or pick a different folder.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {displayPhrases.map(phrase => (
                    <div
                      key={phrase.id}
                      className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{phrase.name}</span>
                            {!phrase.isActive && (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                            {phrase.shortcut && (
                              <Badge variant="secondary">{phrase.shortcut}</Badge>
                            )}
                            {phrase.hotkey && (
                              <Badge variant="outline">
                                <Keyboard className="h-3 w-3 mr-1" />
                                {phrase.hotkey}
                              </Badge>
                            )}
                            {phrase.fields && phrase.fields.length > 0 && (
                              <Badge variant="outline" className="bg-primary/10">
                                <Settings2 className="h-3 w-3 mr-1" />
                                {phrase.fields.length} fields
                              </Badge>
                            )}
                          </div>
                          {phrase.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {phrase.description}
                            </p>
                          )}
                          <p className="text-sm font-mono mt-2 line-clamp-2 text-muted-foreground">
                            {phrase.content}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Used {phrase.usageCount} times</span>
                            {phrase.lastUsedAt && (
                              <span>Last: {new Date(phrase.lastUsedAt).toLocaleDateString()}</span>
                            )}
                            <span>v{phrase.version}</span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingPhrase(phrase)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewVersions(phrase)}>
                              <History className="h-4 w-4 mr-2" />
                              Version History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              navigator.clipboard.writeText(phrase.content);
                              toast.success('Content copied');
                            }}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Content
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget({ 
                                type: 'phrase', 
                                id: phrase.id, 
                                name: phrase.name 
                              })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteTarget?.name}"? 
                {deleteTarget?.type === 'folder' && ' All phrases in this folder will become uncategorized.'}
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
