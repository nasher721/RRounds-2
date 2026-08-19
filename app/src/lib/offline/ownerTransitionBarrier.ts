/**
 * Lightweight cross-module gate for browser data-owner changes. Keeping the
 * gate independent from Dexie lets auth block stale writes immediately while
 * the heavier offline implementation loads on demand.
 */
export class OwnerTransitionBarrier {
  private activeOperations = new Set<Promise<unknown>>();
  private pendingTransitions = 0;
  private transitionTail: Promise<void> = Promise.resolve();

  runOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.pendingTransitions > 0) {
      return Promise.reject(new Error('Offline queue owner transition is in progress'));
    }

    const trackedOperation = Promise.resolve().then(operation);
    this.activeOperations.add(trackedOperation);
    return trackedOperation.finally(() => {
      this.activeOperations.delete(trackedOperation);
    });
  }

  async runTransition<T>(transition: () => Promise<T>): Promise<T> {
    this.pendingTransitions += 1;

    let releasePreviousTransition: () => void = () => undefined;
    const previousTransition = this.transitionTail;
    this.transitionTail = new Promise<void>((resolve) => {
      releasePreviousTransition = resolve;
    });

    await previousTransition;
    try {
      await Promise.allSettled([...this.activeOperations]);
      return await transition();
    } finally {
      this.pendingTransitions -= 1;
      releasePreviousTransition();
    }
  }
}

export const offlineOwnerTransitionBarrier = new OwnerTransitionBarrier();
