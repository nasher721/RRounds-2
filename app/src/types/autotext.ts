/**
 * Autotext and Template Types
 */

export interface AutoText {
  shortcut: string;
  expansion: string;
  category: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
}
