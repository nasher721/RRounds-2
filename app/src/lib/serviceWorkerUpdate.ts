export const SERVICE_WORKER_UPDATE_EVENT = "rolling-rounds:service-worker-update";

let updateReady = false;
let waitingWorker: ServiceWorker | null = null;

export function isServiceWorkerUpdateReady(): boolean {
  return updateReady;
}

export function markServiceWorkerUpdateReady(worker?: ServiceWorker | null): void {
  updateReady = true;
  if (worker) waitingWorker = worker;
  window.dispatchEvent(new Event(SERVICE_WORKER_UPDATE_EVENT));
}

export function clearServiceWorkerUpdateReady(): void {
  updateReady = false;
}

/**
 * Ask the installed worker to activate, then wait until it controls this page.
 * Returning false keeps the prompt visible rather than reloading into the old
 * worker and pretending the requested update succeeded.
 */
export async function activateWaitingServiceWorker(
  timeoutMs = 15_000,
): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  const registration = await navigator.serviceWorker.getRegistration("/");
  const worker = waitingWorker ?? registration?.waiting ?? null;
  if (!worker) return false;
  if (worker.state === "activated") {
    // Another tab may have activated and claimed this page while our prompt
    // remained visible. The update is already ready; reload immediately rather
    // than posting SKIP_WAITING again and waiting for an event that already ran.
    waitingWorker = null;
    return true;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let controllerChanged = false;
    let workerActivated = false;
    const maybeFinish = () => {
      if (controllerChanged && workerActivated) finish(true);
    };
    const finish = (activated: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker.removeEventListener("message", handleWorkerMessage);
      if (activated) waitingWorker = null;
      resolve(activated);
    };
    const handleControllerChange = () => {
      controllerChanged = true;
      maybeFinish();
    };
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "WORKER_ACTIVATED") return;
      if (event.source && event.source !== worker) return;
      workerActivated = true;
      maybeFinish();
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker.addEventListener("message", handleWorkerMessage);
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      finish(false);
    }
  });
}
