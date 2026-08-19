/**
 * SortableSection Component
 * Draggable section item for the layout designer
 */

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  GripVertical,
  Eye,
  EyeOff,
  Settings,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { LayoutSection } from '@/types/layoutDesigner';
import { SECTION_LABELS } from '@/types/layoutDesigner';

interface SortableSectionProps {
  section: LayoutSection;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onSettings: () => void;
  isDragging?: boolean;
}

export const SortableSection = ({
  section,
  isSelected,
  onSelect,
  onToggle,
  onRemove,
  onSettings,
  isDragging: isDraggingProp,
}: SortableSectionProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const [isExpanded, setIsExpanded] = React.useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSystemSection = section.type.startsWith('systems.');
  const label = SECTION_LABELS[section.type] || section.label;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex flex-col rounded-lg border bg-background transition-all',
        isDragging || isDraggingProp ? 'opacity-50 shadow-lg ring-2 ring-primary' : '',
        isSelected ? 'border-primary ring-1 ring-primary/50' : 'border-border',
        !section.enabled && 'opacity-60',
        isSystemSection && 'ml-4'
      )}
    >
      {/* Main row */}
      <div
        className={cn(
          'flex items-center gap-2 p-2',
          isSelected && 'bg-primary/5'
        )}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 hover:bg-muted active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Expand/collapse for system sections */}
        {section.style && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        )}

        {/* Section label */}
        <button
          onClick={onSelect}
          className={cn(
            'flex-1 text-left text-sm font-medium truncate',
            !section.enabled && 'text-muted-foreground'
          )}
        >
          {label}
        </button>

        {/* Width badge */}
        {section.width && section.width !== 'auto' && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {typeof section.width === 'number' ? `${section.width}px` : section.width}
          </Badge>
        )}

        {/* Enable/disable toggle */}
        <Switch
          checked={section.enabled}
          onCheckedChange={onToggle}
          className="scale-75"
        />

        {/* Settings button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onSettings}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>

        {/* Remove button (only for non-required sections) */}
        {section.type !== 'patient' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Expanded settings preview */}
      {isExpanded && section.style && (
        <div className="px-3 pb-2 pt-0 border-t border-dashed">
          <div className="flex flex-wrap gap-2 mt-2">
            {section.style.backgroundColor && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div
                  className="w-3 h-3 rounded border"
                  style={{ backgroundColor: section.style.backgroundColor }}
                />
                Background
              </div>
            )}
            {section.style.headerStyle && (
              <Badge variant="secondary" className="text-xs">
                {section.style.headerStyle} header
              </Badge>
            )}
            {section.style.fontSize && (
              <Badge variant="secondary" className="text-xs">
                {section.style.fontSize}pt
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Static section item (non-draggable preview)
interface StaticSectionProps {
  section: LayoutSection;
  showLabel?: boolean;
}

export const StaticSection = ({ section, showLabel = true }: StaticSectionProps) => {
  const label = SECTION_LABELS[section.type] || section.label;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded border',
        section.enabled ? 'border-border bg-background' : 'border-dashed bg-muted/30 opacity-60'
      )}
    >
      {section.enabled ? (
        <Eye className="h-3 w-3 text-muted-foreground" />
      ) : (
        <EyeOff className="h-3 w-3 text-muted-foreground" />
      )}
      {showLabel && (
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      )}
    </div>
  );
};
