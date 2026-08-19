export {};

declare global {
  interface Window {
    runPrintExportTest?: () => Array<{ id: string; overflowCount: number }>;
  }
}
