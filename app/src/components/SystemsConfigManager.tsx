/**
 * Systems Configuration Manager
 * UI for customizing which systems appear in the Systems Review section
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Trash2,
  GripVertical,
  RotateCcw,
  Settings2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useSystemsConfig, SystemConfig } from '@/hooks/useSystemsConfig';
import { toast } from 'sonner';

interface SystemsConfigManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Common emoji options for system icons
const ICON_OPTIONS = [
  '🧠', '❤️', '🫁', '💧', '🍽️', '⚡', '🩸', '🦠', '🩹', '🏠',
  '💊', '🏥', '🩺', '💉', '🔬', '📋', '⚕️', '🫀', '🦴', '👁️',
  '👂', '🦷', '💪', '🧬', '🧪', '📊', '🔍', '✅', '⭐', '🔔',
];

export const SystemsConfigManager: React.FC<SystemsConfigManagerProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    systems,
    toggleSystem,
    updateSystem,
    addSystem,
    removeSystem,
    reorderSystems,
    resetToDefaults,
  } = useSystemsConfig();

  const [isAdding, setIsAdding] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingDeleteSystem, setPendingDeleteSystem] = useState<SystemConfig | null>(null);
  const [newSystem, setNewSystem] = useState({
    label: '',
    shortLabel: '',
    icon: '📋',
    key: '',
  });

  const handleAddSystem = () => {
    if (!newSystem.label.trim()) {
      toast.error('System name is required');
      return;
    }

    addSystem({
      key: newSystem.key || newSystem.label.toLowerCase().replace(/[^a-z0-9]/g, ''),
      label: newSystem.label,
      shortLabel: newSystem.shortLabel || newSystem.label.substring(0, 8),
      icon: newSystem.icon,
      enabled: true,
    });

    setNewSystem({ label: '', shortLabel: '', icon: '📋', key: '' });
    setIsAdding(false);
    toast.success('System added');
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      reorderSystems(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < systems.length - 1) {
      reorderSystems(index, index + 1);
    }
  };

  const handleReset = () => {
    resetToDefaults();
    setShowResetConfirm(false);
    toast.success('Systems reset to defaults');
  };

  const handleConfirmDeleteSystem = () => {
    if (!pendingDeleteSystem) return;
    removeSystem(pendingDeleteSystem.key);
    toast.success('System removed');
    setPendingDeleteSystem(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Customize Systems Review
          </DialogTitle>
          <DialogDescription>
            Add, remove, or reorder systems. Changes apply to all patients.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-2">
            {systems.map((system, index) => (
              <div
                key={system.key}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  system.enabled
                    ? 'bg-card border-border'
                    : 'bg-muted/50 border-muted opacity-60'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === systems.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>

                <span className="text-xl w-8 text-center">{system.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{system.label}</span>
                    {system.isCustom && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Custom
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Short: {system.shortLabel} | Key: {system.key}
                  </span>
                </div>

                <Switch
                  checked={system.enabled}
                  onCheckedChange={() => toggleSystem(system.key)}
                />

                {system.isCustom && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setPendingDeleteSystem(system)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Add New System */}
          {isAdding ? (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={newSystem.label}
                    onChange={(e) =>
                      setNewSystem((prev) => ({ ...prev, label: e.target.value }))
                    }
                    placeholder="e.g., Psych"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Short Name</Label>
                  <Input
                    value={newSystem.shortLabel}
                    onChange={(e) =>
                      setNewSystem((prev) => ({ ...prev, shortLabel: e.target.value }))
                    }
                    placeholder="e.g., Psych"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-1">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewSystem((prev) => ({ ...prev, icon }))}
                      className={`w-8 h-8 rounded-md text-lg hover:bg-accent transition-colors ${
                        newSystem.icon === icon
                          ? 'bg-primary/20 ring-2 ring-primary'
                          : 'bg-muted'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddSystem} size="sm">
                  Add System
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAdding(false);
                    setNewSystem({ label: '', shortLabel: '', icon: '📋', key: '' });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Custom System
            </Button>
          )}
        </ScrollArea>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset systems to defaults</AlertDialogTitle>
            <AlertDialogDescription>
              Reset all systems to defaults? This will remove custom systems.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={pendingDeleteSystem !== null} onOpenChange={(open) => !open && setPendingDeleteSystem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom system</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteSystem
                ? `Delete "${pendingDeleteSystem.label}"?`
                : 'Delete this custom system?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSystem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
