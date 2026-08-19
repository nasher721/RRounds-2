/**
 * Change Tracking Types
 * For marking newly added text with visual styles
 */

export interface ChangeTrackingStyles {
  textColor: boolean;
  backgroundColor: boolean;
  italic: boolean;
}

export interface DaySettings {
  date: string; // YYYY-MM-DD
  enabled: boolean;
  color: string;
  styles: ChangeTrackingStyles;
}

export interface ChangeTrackingState {
  enabled: boolean;
  color: string;
  styles: ChangeTrackingStyles;
}

export interface ChangeTrackingContextValue extends ChangeTrackingState {
  toggleEnabled: () => void;
  setColor: (color: string) => void;
  toggleStyle: (style: keyof ChangeTrackingStyles) => void;
  wrapWithMarkup: (text: string) => string;
  wrapHtmlWithMarkup: (html: string) => string;
}

/** Default: primary (teal) for design-system alignment */
export const DEFAULT_TRACKING_COLOR = "#0d9488";

export const DEFAULT_STYLES: ChangeTrackingStyles = {
  textColor: true,
  backgroundColor: false,
  italic: false,
};
