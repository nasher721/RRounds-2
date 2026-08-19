/**
 * HTML Formatting Utilities
 * Convert HTML to formatted text for various export formats
 */

import { sanitizeHtml, stripHtml } from '@/lib/sanitize';

// Re-export stripHtml for backward compatibility
export { stripHtml };

/**
 * Parse color from CSS style (handles rgb, rgba, hex, and color names)
 */
export const parseColor = (colorStr: string): { r: number; g: number; b: number } | null => {
    if (!colorStr) return null;
    
    // Handle rgb/rgba
    const rgbMatch = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
        return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
    }
    
    // Handle hex colors
    const hexMatch = colorStr.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
        return { r: parseInt(hexMatch[1], 16), g: parseInt(hexMatch[2], 16), b: parseInt(hexMatch[3], 16) };
    }
    
    // Handle 3-digit hex
    const hex3Match = colorStr.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
    if (hex3Match) {
        return { 
            r: parseInt(hex3Match[1] + hex3Match[1], 16), 
            g: parseInt(hex3Match[2] + hex3Match[2], 16), 
            b: parseInt(hex3Match[3] + hex3Match[3], 16) 
        };
    }
    
    // Common color names
    const colorNames: Record<string, { r: number; g: number; b: number }> = {
        red: { r: 255, g: 0, b: 0 },
        blue: { r: 0, g: 0, b: 255 },
        green: { r: 0, g: 128, b: 0 },
        yellow: { r: 255, g: 255, b: 0 },
        orange: { r: 255, g: 165, b: 0 },
        purple: { r: 128, g: 0, b: 128 },
        pink: { r: 255, g: 192, b: 203 },
        black: { r: 0, g: 0, b: 0 },
        white: { r: 255, g: 255, b: 255 },
        gray: { r: 128, g: 128, b: 128 },
        grey: { r: 128, g: 128, b: 128 },
    };
    
    return colorNames[colorStr.toLowerCase()] || null;
};

/**
 * Convert HTML to plain text with basic formatting preserved
 * Converts:
 * - <b>, <strong> to **text**
 * - <i>, <em> to *text*
 * - <u> to _text_
 * - <br>, <p> to line breaks
 * - <ul>, <ol> to bulleted/numbered lists
 */
export const htmlToFormattedText = (html: string): string => {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = sanitizeHtml(html);

    let result = '';

    const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();
            const childText = Array.from(element.childNodes)
                .map(child => processNode(child))
                .join('');

            switch (tagName) {
                case 'b':
                case 'strong':
                    return `**${childText}**`;
                case 'i':
                case 'em':
                    return `*${childText}*`;
                case 'u':
                    return `_${childText}_`;
                case 'br':
                    return '\n';
                case 'p':
                    return `${childText}\n`;
                case 'li':
                    return `• ${childText}\n`;
                case 'ul':
                case 'ol':
                    return `${childText}\n`;
                default:
                    return childText;
            }
        }

        return '';
    };

    result = Array.from(temp.childNodes)
        .map(node => processNode(node))
        .join('');

    return result.trim();
};

/**
 * RTF color table builder - tracks unique colors and returns their indices
 */
class RTFColorTable {
    private colors: Map<string, number> = new Map();
    private colorList: { r: number; g: number; b: number }[] = [];
    
    constructor() {
        // Index 0 is default (black), 1 is blue for headers, 2 is gray
        this.colorList = [
            { r: 0, g: 0, b: 0 },
            { r: 59, g: 130, b: 246 },
            { r: 100, g: 100, b: 100 }
        ];
        this.colors.set('0,0,0', 1);
        this.colors.set('59,130,246', 2);
        this.colors.set('100,100,100', 3);
    }
    
    addColor(r: number, g: number, b: number): number {
        const key = `${r},${g},${b}`;
        if (this.colors.has(key)) {
            return this.colors.get(key)!;
        }
        this.colorList.push({ r, g, b });
        const index = this.colorList.length;
        this.colors.set(key, index);
        return index;
    }
    
    getColorTable(): string {
        return `{\\colortbl;${this.colorList.map(c => `\\red${c.r}\\green${c.g}\\blue${c.b};`).join('')}}`;
    }
}

// Global color table for current RTF export
let rtfColorTable: RTFColorTable | null = null;

export const initRTFColorTable = (): RTFColorTable => {
    rtfColorTable = new RTFColorTable();
    return rtfColorTable;
};

export const getRTFColorTable = (): string => {
    return rtfColorTable?.getColorTable() || '{\\colortbl;\\red0\\green0\\blue0;\\red59\\green130\\blue246;\\red100\\green100\\blue100;}';
};

/**
 * Convert HTML to RTF format codes with color preservation
 */
export const htmlToRTF = (html: string): string => {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = sanitizeHtml(html);

    const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return escapeRTF(node.textContent || '');
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const tagName = element.tagName.toLowerCase();
            
            // Extract color from inline style
            const style = element.getAttribute('style') || '';
            const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
            const bgColorMatch = style.match(/background-color\s*:\s*([^;]+)/i);
            
            let colorPrefix = '';
            let colorSuffix = '';
            
            if (colorMatch && rtfColorTable) {
                const color = parseColor(colorMatch[1].trim());
                if (color) {
                    const colorIndex = rtfColorTable.addColor(color.r, color.g, color.b);
                    colorPrefix = `\\cf${colorIndex} `;
                    colorSuffix = '\\cf1 ';
                }
            }
            
            // Handle background color with highlighting
            let highlightPrefix = '';
            let highlightSuffix = '';
            if (bgColorMatch && rtfColorTable) {
                const bgColor = parseColor(bgColorMatch[1].trim());
                if (bgColor) {
                    const bgColorIndex = rtfColorTable.addColor(bgColor.r, bgColor.g, bgColor.b);
                    highlightPrefix = `\\highlight${bgColorIndex} `;
                    highlightSuffix = '\\highlight0 ';
                }
            }
            
            const childText = Array.from(element.childNodes)
                .map(child => processNode(child))
                .join('');

            switch (tagName) {
                case 'b':
                case 'strong':
                    return `${colorPrefix}${highlightPrefix}\\b ${childText}\\b0 ${highlightSuffix}${colorSuffix}`;
                case 'i':
                case 'em':
                    return `${colorPrefix}${highlightPrefix}\\i ${childText}\\i0 ${highlightSuffix}${colorSuffix}`;
                case 'u':
                    return `${colorPrefix}${highlightPrefix}\\ul ${childText}\\ul0 ${highlightSuffix}${colorSuffix}`;
                case 'span':
                    // Span with colors
                    if (colorPrefix || highlightPrefix) {
                        return `${colorPrefix}${highlightPrefix}${childText}${highlightSuffix}${colorSuffix}`;
                    }
                    return childText;
                case 'br':
                    return '\\par\n';
                case 'p':
                    return `${colorPrefix}${highlightPrefix}${childText}${highlightSuffix}${colorSuffix}\\par\n`;
                case 'li':
                    return `{\\pntext\\bullet\\tab}${colorPrefix}${highlightPrefix}${childText}${highlightSuffix}${colorSuffix}\\par\n`;
                default:
                    return `${colorPrefix}${highlightPrefix}${childText}${highlightSuffix}${colorSuffix}`;
            }
        }

        return '';
    };

    return Array.from(temp.childNodes)
        .map(node => processNode(node))
        .join('');
};

/**
 * Escape special RTF characters
 */
export const escapeRTF = (text: string): string => {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/\n/g, '\\par\n');
};

/**
 * Parse HTML and extract formatting for Excel rich text
 * Returns an array of text runs with formatting including colors
 */
export interface ExcelTextRun {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: { r: number; g: number; b: number };
    bgColor?: { r: number; g: number; b: number };
}

export const htmlToExcelRichText = (html: string): ExcelTextRun[] => {
    if (!html) return [{ text: '' }];

    const temp = document.createElement('div');
    temp.innerHTML = sanitizeHtml(html);

    const runs: ExcelTextRun[] = [];

    interface Formatting {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        color?: { r: number; g: number; b: number };
        bgColor?: { r: number; g: number; b: number };
    }

    const processNode = (node: Node, formatting: Formatting = {}): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text) {
                runs.push({ text, ...formatting });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const tagName = element.tagName.toLowerCase();

            const newFormatting: Formatting = { ...formatting };
            if (tagName === 'b' || tagName === 'strong') newFormatting.bold = true;
            if (tagName === 'i' || tagName === 'em') newFormatting.italic = true;
            if (tagName === 'u') newFormatting.underline = true;
            
            // Extract colors from inline styles
            const style = element.getAttribute('style') || '';
            const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
            const bgColorMatch = style.match(/background-color\s*:\s*([^;]+)/i);
            
            if (colorMatch) {
                const color = parseColor(colorMatch[1].trim());
                if (color) newFormatting.color = color;
            }
            if (bgColorMatch) {
                const bgColor = parseColor(bgColorMatch[1].trim());
                if (bgColor) newFormatting.bgColor = bgColor;
            }

            if (tagName === 'br') {
                runs.push({ text: '\n' });
            } else if (tagName === 'p' && element.previousElementSibling) {
                runs.push({ text: '\n' });
                Array.from(element.childNodes).forEach(child => processNode(child, newFormatting));
            } else {
                Array.from(element.childNodes).forEach(child => processNode(child, newFormatting));
            }
        }
    };

    Array.from(temp.childNodes).forEach(node => processNode(node));

    return runs.length > 0 ? runs : [{ text: stripHtml(html) }];
};

/**
 * Parse HTML and extract text segments with colors for PDF rendering
 */
export interface PDFTextSegment {
    text: string;
    bold?: boolean;
    italic?: boolean;
    color?: { r: number; g: number; b: number };
}

export const htmlToPDFSegments = (html: string): PDFTextSegment[] => {
    if (!html) return [{ text: '' }];

    const temp = document.createElement('div');
    temp.innerHTML = sanitizeHtml(html);

    const segments: PDFTextSegment[] = [];

    interface Formatting {
        bold?: boolean;
        italic?: boolean;
        color?: { r: number; g: number; b: number };
    }

    const processNode = (node: Node, formatting: Formatting = {}): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text) {
                segments.push({ text, ...formatting });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const tagName = element.tagName.toLowerCase();

            const newFormatting: Formatting = { ...formatting };
            if (tagName === 'b' || tagName === 'strong') newFormatting.bold = true;
            if (tagName === 'i' || tagName === 'em') newFormatting.italic = true;
            
            // Extract color from inline styles
            const style = element.getAttribute('style') || '';
            const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
            
            if (colorMatch) {
                const color = parseColor(colorMatch[1].trim());
                if (color) newFormatting.color = color;
            }

            if (tagName === 'br') {
                segments.push({ text: '\n' });
            } else if (tagName === 'p') {
                if (element.previousElementSibling) {
                    segments.push({ text: '\n' });
                }
                Array.from(element.childNodes).forEach(child => processNode(child, newFormatting));
            } else {
                Array.from(element.childNodes).forEach(child => processNode(child, newFormatting));
            }
        }
    };

    Array.from(temp.childNodes).forEach(node => processNode(node));

    return segments.length > 0 ? segments : [{ text: stripHtml(html) }];
};
