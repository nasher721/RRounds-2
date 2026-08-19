import type { PrintSettings } from "./types";

export const PAGE_SIZES_MM = {
  portrait: { width: 210, height: 297 },
  landscape: { width: 297, height: 210 },
} as const;

export const MARGIN_MM_BY_SETTING = {
  narrow: 10,
  normal: 15,
  wide: 20,
} as const;

export const getPageMetrics = (settings: Pick<PrintSettings, "printOrientation" | "margins">) => {
  const pageSize = PAGE_SIZES_MM[settings.printOrientation];
  const margin = MARGIN_MM_BY_SETTING[settings.margins] ?? MARGIN_MM_BY_SETTING.normal;

  return {
    widthMm: pageSize.width,
    heightMm: pageSize.height,
    marginMm: margin,
  };
};
