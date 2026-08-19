/**
 * LayoutPreview Component
 * Real-time preview of the layout with sample patient data
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import type { LayoutConfig, LayoutSection } from '@/types/layoutDesigner';
import { SECTION_LABELS } from '@/types/layoutDesigner';

interface LayoutPreviewProps {
  layout: LayoutConfig;
  scale: number;
  onScaleChange: (scale: number) => void;
  mode: 'design' | 'preview';
}

// Sample patient data for preview
const SAMPLE_PATIENTS = [
  {
    id: '1',
    name: 'Smith, John',
    bed: 'ICU-12A',
    clinicalSummary: '72M with ARDS on mechanical ventilation, improving on current vent settings. FiO2 weaned to 40%.',
    intervalEvents: 'Overnight: Tolerated SBT for 30 min, suctioned x2 for thick secretions.',
    imaging: 'CXR this AM shows bilateral infiltrates, improved from prior.',
    labs: 'WBC 12.5 (down from 15), Cr 1.2, lactate 1.8',
    systems: {
      neuro: 'RASS -1, following commands',
      cv: 'MAP 70s on norepi 0.05',
      resp: 'AC 14/450/40%/8, SpO2 95%',
    },
    todos: ['Repeat ABG in 4 hrs', 'PT/OT eval', 'Family meeting @ 2pm'],
  },
  {
    id: '2',
    name: 'Johnson, Mary',
    bed: 'ICU-14B',
    clinicalSummary: '65F with septic shock 2/2 UTI, on vasopressors and broad spectrum abx.',
    intervalEvents: 'Pressors weaned overnight, urine output improved to 40cc/hr.',
    imaging: 'CT A/P pending for source control evaluation.',
    labs: 'Lactate trending down: 4.2 → 2.8 → 1.9',
    systems: {
      neuro: 'Alert, oriented x3',
      cv: 'Off pressors as of 0600, MAP 65-70',
      resp: 'NC 2L, SpO2 96%',
    },
    todos: ['ID consult for abx duration', 'Foley can be discontinued'],
  },
  {
    id: '3',
    name: 'Williams, Robert',
    bed: 'ICU-16C',
    clinicalSummary: '58M with STEMI s/p PCI to LAD, stable hemodynamics.',
    intervalEvents: 'No chest pain overnight, rhythm stable in NSR.',
    imaging: 'Echo pending today to assess EF.',
    labs: 'Trop peaked at 8.5, now trending down at 4.2',
    systems: {
      neuro: 'A&O, denies chest pain',
      cv: 'NSR 70s, BP 120/70, JVP flat',
      resp: 'Room air, clear lungs',
    },
    todos: ['Cardiac rehab referral', 'Statin education', 'Follow-up with cards in 2 weeks'],
  },
];

// Get font family CSS
const getFontFamilyCSS = (fontFamily: string): string => {
  const fonts: Record<string, string> = {
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    arial: "Arial, Helvetica, sans-serif",
    times: "'Times New Roman', Times, serif",
    georgia: "Georgia, 'Times New Roman', serif",
    courier: "'Courier New', Courier, monospace",
    verdana: "Verdana, Geneva, sans-serif",
    trebuchet: "'Trebuchet MS', Helvetica, sans-serif",
  };
  return fonts[fontFamily] || fonts.system;
};

// Get spacing value in pixels
const getSpacingValue = (spacing: string): number => {
  const values: Record<string, number> = {
    compact: 8,
    normal: 16,
    relaxed: 24,
  };
  return values[spacing] || values.normal;
};

// Get border radius value
const getBorderRadiusValue = (radius: string): string => {
  const values: Record<string, string> = {
    none: '0',
    small: '4px',
    medium: '8px',
    large: '12px',
  };
  return values[radius] || values.small;
};

// Get border width value
const getBorderWidthValue = (style: string): number => {
  const values: Record<string, number> = {
    none: 0,
    light: 1,
    medium: 2,
    heavy: 3,
  };
  return values[style] || values.light;
};

// Get shadow value
const getShadowValue = (shadow: string): string => {
  const values: Record<string, string> = {
    none: 'none',
    subtle: '0 1px 2px rgba(0,0,0,0.05)',
    medium: '0 4px 6px rgba(0,0,0,0.1)',
    strong: '0 10px 15px rgba(0,0,0,0.15)',
  };
  return values[shadow] || values.none;
};

// Get margin values
const getMarginValue = (margins: string | object): string => {
  if (typeof margins === 'object') {
    return `${(margins as { top: number }).top}px`;
  }
  const values: Record<string, string> = {
    narrow: '12px',
    normal: '24px',
    wide: '48px',
  };
  return values[margins as string] || values.normal;
};

// Section width to CSS
const getWidthCSS = (width?: LayoutSection['width']): string => {
  if (!width || width === 'auto') return 'auto';
  if (typeof width === 'number') return `${width}px`;
  const values: Record<string, string> = {
    full: '100%',
    half: '50%',
    third: '33.333%',
    quarter: '25%',
  };
  return values[width] || 'auto';
};

export const LayoutPreview = ({
  layout,
  scale,
  onScaleChange,
  mode,
}: LayoutPreviewProps) => {
  const previewRef = React.useRef<HTMLDivElement>(null);

  const { globalStyles, pageSettings, viewType, sections, cardConfig } = layout;
  const enabledSections = sections.filter(s => s.enabled).sort((a, b) => a.order - b.order);

  // Calculate page dimensions based on orientation
  const isLandscape = pageSettings.orientation === 'landscape';
  const pageWidth = isLandscape ? 297 : 210; // A4 in mm
  const pageHeight = isLandscape ? 210 : 297;
  const pageAspectRatio = pageWidth / pageHeight;

  // Zoom controls
  const zoomIn = () => onScaleChange(Math.min(2, scale + 0.1));
  const zoomOut = () => onScaleChange(Math.max(0.25, scale - 0.1));
  const resetZoom = () => onScaleChange(1);

  // Render a section
  const renderSection = (
    section: LayoutSection,
    patient: typeof SAMPLE_PATIENTS[0],
    index: number
  ) => {
    const label = SECTION_LABELS[section.type] || section.label;
    const sectionStyle = section.style || {};

    // Get content based on section type
    let content = '';
    switch (section.type) {
      case 'patient':
        content = `${patient.name} | ${patient.bed}`;
        break;
      case 'clinicalSummary':
        content = patient.clinicalSummary;
        break;
      case 'intervalEvents':
        content = patient.intervalEvents;
        break;
      case 'imaging':
        content = patient.imaging;
        break;
      case 'labs':
        content = patient.labs;
        break;
      case 'todos':
        content = patient.todos.map(t => `• ${t}`).join('\n');
        break;
      case 'systems.neuro':
        content = patient.systems.neuro || 'No data';
        break;
      case 'systems.cv':
        content = patient.systems.cv || 'No data';
        break;
      case 'systems.resp':
        content = patient.systems.resp || 'No data';
        break;
      default:
        content = 'Sample content for ' + label;
    }

    const headerStyles: Record<string, string> = {
      none: '',
      simple: 'border-b pb-1 mb-2',
      accent: 'border-l-4 pl-2 mb-2',
      filled: 'px-2 py-1 rounded mb-2',
    };

    return (
      <div
        key={section.id}
        className={cn('transition-all')}
        style={{
          width: getWidthCSS(section.width),
          backgroundColor: sectionStyle.backgroundColor || 'transparent',
          borderWidth: sectionStyle.borderWidth || 0,
          borderColor: sectionStyle.borderColor || globalStyles.secondaryColor,
          borderStyle: 'solid',
          borderRadius: sectionStyle.borderRadius || 0,
          padding: sectionStyle.padding || getSpacingValue(globalStyles.spacing) / 2,
        }}
      >
        {sectionStyle.headerStyle !== 'none' && (
          <div
            className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              headerStyles[sectionStyle.headerStyle || 'simple']
            )}
            style={{
              color: globalStyles.primaryColor,
              borderColor: globalStyles.accentColor,
              backgroundColor:
                sectionStyle.headerStyle === 'filled'
                  ? globalStyles.accentColor + '20'
                  : undefined,
            }}
          >
            {section.label || label}
          </div>
        )}
        <div
          className="whitespace-pre-wrap break-words"
          style={{
            fontSize: sectionStyle.fontSize || globalStyles.fontSize,
            fontWeight: sectionStyle.fontWeight || 'normal',
            color: sectionStyle.textColor || globalStyles.textColor,
          }}
        >
          {content}
        </div>
      </div>
    );
  };

  // Render a patient card
  const renderPatientCard = (patient: typeof SAMPLE_PATIENTS[0], index: number) => {
    const cardGap = cardConfig?.gap || 'medium';
    const gapValue = { none: 0, small: 8, medium: 16, large: 24 }[cardGap];
    const cardStyle = cardConfig?.cardStyle || 'bordered';

    const cardStyles: Record<string, string> = {
      flat: '',
      elevated: 'shadow-md',
      bordered: 'border',
      glass: 'backdrop-blur-sm bg-white/80 border',
    };

    return (
      <div
        key={patient.id}
        className={cn('rounded-lg overflow-hidden', cardStyles[cardStyle])}
        style={{
          borderRadius: getBorderRadiusValue(globalStyles.borderRadius),
          borderWidth: getBorderWidthValue(globalStyles.borderStyle),
          borderColor: globalStyles.secondaryColor + '40',
          boxShadow: getShadowValue(globalStyles.shadowStyle),
          marginBottom: gapValue,
        }}
      >
        {/* Patient header */}
        <div
          className="px-3 py-2 border-b flex items-center justify-between"
          style={{
            backgroundColor: globalStyles.primaryColor + '10',
            borderColor: globalStyles.primaryColor + '20',
          }}
        >
          <span className="font-semibold" style={{ color: globalStyles.primaryColor }}>
            {patient.name}
          </span>
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ borderColor: globalStyles.accentColor, color: globalStyles.accentColor }}
          >
            {patient.bed}
          </Badge>
        </div>

        {/* Sections */}
        <div
          className="p-3"
          style={{
            display: cardConfig?.contentFlow === 'grid' ? 'grid' : 'flex',
            flexDirection: cardConfig?.contentFlow === 'horizontal' ? 'row' : 'column',
            gridTemplateColumns:
              cardConfig?.contentFlow === 'grid' ? 'repeat(2, 1fr)' : undefined,
            gap: gapValue / 2,
          }}
        >
          {enabledSections
            .filter(s => s.type !== 'patient')
            .map((section, idx) => renderSection(section, patient, idx))}
        </div>
      </div>
    );
  };

  // Render table layout
  const renderTableLayout = () => (
    <div className="overflow-auto">
      <table className="w-full border-collapse" style={{ fontSize: globalStyles.fontSize }}>
        <thead>
          <tr>
            {enabledSections.map((section) => (
              <th
                key={section.id}
                className="text-left p-2 border-b-2"
                style={{
                  backgroundColor: globalStyles.primaryColor + '10',
                  borderColor: globalStyles.primaryColor,
                  color: globalStyles.primaryColor,
                }}
              >
                {section.label || SECTION_LABELS[section.type]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_PATIENTS.map((patient, rowIndex) => (
            <tr
              key={patient.id}
              style={{
                backgroundColor: rowIndex % 2 === 1 ? globalStyles.secondaryColor + '08' : undefined,
              }}
            >
              {enabledSections.map((section) => {
                let content = '';
                switch (section.type) {
                  case 'patient':
                    content = `${patient.name}\n${patient.bed}`;
                    break;
                  case 'clinicalSummary':
                    content = patient.clinicalSummary;
                    break;
                  case 'intervalEvents':
                    content = patient.intervalEvents;
                    break;
                  case 'imaging':
                    content = patient.imaging;
                    break;
                  case 'labs':
                    content = patient.labs;
                    break;
                  case 'todos':
                    content = patient.todos.join('; ');
                    break;
                  default:
                    content = '-';
                }

                return (
                  <td
                    key={section.id}
                    className="p-2 border-b align-top whitespace-pre-wrap"
                    style={{
                      borderColor: globalStyles.secondaryColor + '30',
                      maxWidth: typeof section.width === 'number' ? section.width : 200,
                    }}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render cards layout
  const renderCardsLayout = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cardConfig?.columns || 1}, 1fr)`,
        gap: getSpacingValue(globalStyles.spacing),
      }}
    >
      {SAMPLE_PATIENTS.map((patient, index) => renderPatientCard(patient, index))}
    </div>
  );

  // Render grid layout
  const renderGridLayout = () => {
    const { rows = 2, columns = 2, cellSpacing = 16 } = layout.gridConfig || {};
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: cellSpacing,
        }}
      >
        {SAMPLE_PATIENTS.slice(0, rows * columns).map((patient, index) => (
          <div
            key={patient.id}
            className="border rounded-lg p-3"
            style={{
              borderColor: globalStyles.secondaryColor + '40',
              borderRadius: getBorderRadiusValue(globalStyles.borderRadius),
            }}
          >
            <div className="font-semibold mb-2" style={{ color: globalStyles.primaryColor }}>
              {patient.name} | {patient.bed}
            </div>
            <div className="text-xs" style={{ color: globalStyles.textColor }}>
              {patient.clinicalSummary}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render newspaper layout
  const renderNewspaperLayout = () => {
    const { columns = 3, columnGap = 20, showColumnRules } = layout.newspaperConfig || {};
    return (
      <div
        style={{
          columnCount: columns,
          columnGap,
          columnRule: showColumnRules ? `1px solid ${globalStyles.secondaryColor}40` : 'none',
        }}
      >
        {SAMPLE_PATIENTS.map((patient, index) => (
          <div key={patient.id} className="break-inside-avoid mb-4">
            <h3 className="font-bold mb-1" style={{ color: globalStyles.primaryColor }}>
              {patient.name}
            </h3>
            <p className="text-xs mb-2" style={{ color: globalStyles.secondaryColor }}>
              {patient.bed}
            </p>
            <p style={{ fontSize: globalStyles.fontSize }}>{patient.clinicalSummary}</p>
            <p className="mt-2" style={{ fontSize: globalStyles.fontSize }}>
              {patient.intervalEvents}
            </p>
          </div>
        ))}
      </div>
    );
  };

  // Render condensed layout
  const renderCondensedLayout = () => (
    <div className="space-y-1">
      {SAMPLE_PATIENTS.map((patient) => (
        <div
          key={patient.id}
          className="flex items-center gap-3 py-1 border-b"
          style={{
            fontSize: globalStyles.fontSize - 1,
            borderColor: globalStyles.secondaryColor + '20',
          }}
        >
          <span className="font-medium w-24 truncate" style={{ color: globalStyles.primaryColor }}>
            {patient.name}
          </span>
          <span className="w-16 text-muted-foreground">{patient.bed}</span>
          <span className="flex-1 truncate">{patient.clinicalSummary}</span>
        </div>
      ))}
    </div>
  );

  // Main render based on view type
  const renderLayout = () => {
    switch (viewType) {
      case 'table':
        return renderTableLayout();
      case 'cards':
        return renderCardsLayout();
      case 'grid':
        return renderGridLayout();
      case 'newspaper':
        return renderNewspaperLayout();
      case 'condensed':
        return renderCondensedLayout();
      default:
        return renderCardsLayout();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Zoom controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-32">
            <Slider
              value={[scale * 100]}
              min={25}
              max={200}
              step={5}
              onValueChange={([value]) => onScaleChange(value / 100)}
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetZoom}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {layout.name}
          </Badge>
          <Badge variant="secondary" className="text-xs capitalize">
            {viewType}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {pageSettings.orientation}
          </Badge>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-8 bg-muted/50">
        <div
          className="mx-auto transition-transform origin-top"
          style={{ transform: `scale(${scale})` }}
        >
          {/* Page container */}
          <div
            ref={previewRef}
            className="bg-white shadow-lg mx-auto"
            style={{
              width: isLandscape ? '842px' : '595px', // A4 at 72dpi
              minHeight: isLandscape ? '595px' : '842px',
              padding: getMarginValue(pageSettings.margins),
              fontFamily: getFontFamilyCSS(globalStyles.fontFamily),
              fontSize: globalStyles.fontSize,
              lineHeight: globalStyles.lineHeight,
              color: globalStyles.textColor,
              backgroundColor: globalStyles.backgroundColor,
            }}
          >
            {/* Header */}
            {pageSettings.showHeader && (
              <div
                className="mb-4 pb-2 border-b flex items-center justify-between"
                style={{ borderColor: globalStyles.primaryColor + '40' }}
              >
                <div>
                  <h1
                    className="text-lg font-bold"
                    style={{ color: globalStyles.primaryColor }}
                  >
                    Patient List
                  </h1>
                  {globalStyles.headerStyle !== 'minimal' && (
                    <p className="text-xs text-muted-foreground">
                      {layout.name} Layout
                    </p>
                  )}
                </div>
                {pageSettings.showTimestamp && (
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {/* Content */}
            {renderLayout()}

            {/* Footer */}
            {pageSettings.showPageNumbers && (
              <div
                className="mt-4 pt-2 border-t text-center text-xs text-muted-foreground"
                style={{ borderColor: globalStyles.secondaryColor + '30' }}
              >
                Page 1 of 1
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
