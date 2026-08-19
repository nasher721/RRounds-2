export const loadRoundPrintExport = () =>
  import("@/components/PrintExportModal").then((module) => ({ default: module.PrintExportModal }))

export const preloadRoundPrintExport = async (): Promise<void> => {
  await loadRoundPrintExport()
}
