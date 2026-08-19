const PRINT_ACTIVE_CLASS = "print-export-active";

/** Print a disposable clone of the prepared report, never the surrounding app UI. */
export function printElement(source: HTMLElement | null): void {
  if (!source) {
    throw new Error("The print report is not ready yet.");
  }

  document.querySelectorAll("[data-browser-print-root]").forEach((root) => root.remove());

  const printRoot = document.createElement("div");
  printRoot.dataset.browserPrintRoot = "";
  printRoot.appendChild(source.cloneNode(true));
  document.body.appendChild(printRoot);
  document.documentElement.classList.add(PRINT_ACTIVE_CLASS);

  let cleanupTimer: number | undefined;
  let cleaned = false;
  const cleanup = () => {
    cleaned = true;
    if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
    window.removeEventListener("afterprint", cleanup);
    document.documentElement.classList.remove(PRINT_ACTIVE_CLASS);
    printRoot.remove();
  };

  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
    // Some embedded browsers omit `afterprint`; keep the invisible clone from
    // accumulating indefinitely without racing an asynchronous print dialog.
    if (!cleaned) cleanupTimer = window.setTimeout(cleanup, 5 * 60 * 1000);
  } catch (error) {
    cleanup();
    throw error;
  }
}
