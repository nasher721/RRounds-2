/**
 * Lightweight registry used to cancel and drain offline sync before an auth
 * owner changes. It intentionally has no Supabase, Dexie, or UI dependencies.
 */
class SyncAuthTransitionGate {
  private pauses = 0;
  private activeOperations = new Set<Promise<unknown>>();
  private aborters = new Set<() => void>();

  get isPaused(): boolean {
    return this.pauses > 0;
  }

  track<T>(operation: Promise<T>, abort?: () => void): Promise<T> {
    this.activeOperations.add(operation);
    if (abort) this.aborters.add(abort);
    return operation.finally(() => {
      this.activeOperations.delete(operation);
      if (abort) this.aborters.delete(abort);
    });
  }

  async pause(): Promise<() => void> {
    this.pauses += 1;
    this.aborters.forEach((abort) => abort());
    await Promise.allSettled([...this.activeOperations]);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.pauses = Math.max(0, this.pauses - 1);
    };
  }
}

export const syncAuthTransitionGate = new SyncAuthTransitionGate();
