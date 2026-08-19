import * as React from "react";
import { flushSync } from "react-dom";
import type { User, Session } from "@supabase/supabase-js";
import {
  hasSupabaseConfig,
  readCachedSessionForBootstrap,
  supabase,
} from "@/integrations/supabase/client";
import { prepareSensitiveClientState } from "@/lib/auth/clearSensitiveClientState";
import { AUTH_BOOTSTRAP_TIMEOUT_MS } from "@/lib/auth/authBootstrap";
import { isBrowserKnownOffline } from "@/lib/networkConnectivity";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  onAuthBoundary?: () => void;
  /** Test override; production uses a short public-shell availability deadline. */
  bootstrapTimeoutMs?: number;
}

export function AuthProvider({
  children,
  onAuthBoundary,
  bootstrapTimeoutMs = AUTH_BOOTSTRAP_TIMEOUT_MS,
}: AuthProviderProps): React.ReactElement {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const initialized = React.useRef(false);
  const activeUserId = React.useRef<string | null | undefined>(undefined);
  const transitionChain = React.useRef<Promise<void>>(Promise.resolve());

  const applySession = React.useCallback((nextSession: Session | null): Promise<void> => {
    const transition = transitionChain.current.catch(() => undefined).then(async () => {
      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      if (activeUserId.current !== nextUserId) {
        if (activeUserId.current !== undefined) {
          // Quarantine the old UI synchronously so open patient-data stores
          // (notably y-indexeddb) close before deletion. Null is safe to expose;
          // the new identity is still withheld until cleanup completes.
          flushSync(() => {
            setLoading(true);
            setSession(null);
            setUser(null);
            onAuthBoundary?.();
          });
          // Give passive-effect cleanup a turn to close y-indexeddb handles.
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        } else {
          onAuthBoundary?.();
        }
        await prepareSensitiveClientState(nextUserId);
        activeUserId.current = nextUserId;
      }

      // Publish only after persistent and in-memory state belongs to this user.
      setSession(nextSession);
      setUser(nextUser);
      setLoading(false);
    });
    transitionChain.current = transition;
    return transition;
  }, [onAuthBoundary]);

  React.useEffect(() => {
    initialized.current = false;

    if (!hasSupabaseConfig) {
      void applySession(null)
        .catch(() => console.error("Failed to clear local data without an auth session"))
        .finally(() => {
          if (!initialized.current) {
            initialized.current = true;
            setLoading(false);
          }
        });
      return;
    }

    let authEventSeen = false;
    let authoritativeResultSeen = false;
    let disposed = false;
    const bootstrapTimer = {
      current: undefined as ReturnType<typeof setTimeout> | undefined,
    };

    const finishLoading = () => {
      if (!disposed && !initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    };

    const recoverCachedSession = async (): Promise<void> => {
      if (disposed || authoritativeResultSeen || initialized.current) return;
      const cachedSession = readCachedSessionForBootstrap();
      if (cachedSession) {
        try {
          await applySession(cachedSession);
        } catch {
          console.error("Failed to prepare cached auth session");
        }
      }
      finishLoading();
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        // Auth-js also emits INITIAL_SESSION/null when its own initialization
        // throws (including retryable refresh failures). If a valid cached
        // session exists, let the independently bounded getSession path decide
        // whether this is signed-out truth or an unavailable backend. A real
        // SIGNED_OUT event is always authoritative.
        if (
          event === "INITIAL_SESSION"
          && nextSession === null
          && readCachedSessionForBootstrap() !== null
        ) {
          return;
        }
        authEventSeen = true;
        authoritativeResultSeen = true;
        if (bootstrapTimer.current) clearTimeout(bootstrapTimer.current);
        void applySession(nextSession)
          .catch(() => console.error("Failed to prepare local data for the auth session"))
          .finally(finishLoading);
      }
    );

    // Bound the public shell independently from the auth client's network
    // retry envelope. A valid, unexpired local session can continue offline;
    // the eventual Supabase result remains authoritative when it settles.
    bootstrapTimer.current = setTimeout(() => {
      void recoverCachedSession();
    }, Math.max(1, bootstrapTimeoutMs));
    if (isBrowserKnownOffline()) {
      void recoverCachedSession();
    }

    // THEN check for existing session
    const initializeSession = async () => {
      try {
        const { data: { session: restoredSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        authoritativeResultSeen = true;
        if (!disposed && !authEventSeen) {
          await applySession(restoredSession);
        }
      } catch {
        console.error("Failed to restore auth session");
        await recoverCachedSession();
      } finally {
        if (bootstrapTimer.current) clearTimeout(bootstrapTimer.current);
        finishLoading();
      }
    };

    void initializeSession();

    return () => {
      disposed = true;
      initialized.current = false;
      if (bootstrapTimer.current) clearTimeout(bootstrapTimer.current);
      subscription.unsubscribe();
    };
  }, [applySession, bootstrapTimeoutMs]);

  const signIn = async (email: string, password: string) => {
    if (!hasSupabaseConfig) {
      return { error: new Error("Authentication is not configured.") };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const signOut = async () => {
    if (!hasSupabaseConfig) {
      await applySession(null);
      return;
    }

    let signOutError: Error | null = null;
    try {
      const { error } = await supabase.auth.signOut();
      signOutError = error as Error | null;
    } catch (error) {
      signOutError = error instanceof Error ? error : new Error(String(error));
    }

    if (signOutError) {
      // A failed network revoke must not leave an unattended clinical workspace
      // or its refresh token open locally. Best-effort local scope avoids a
      // second network dependency; applySession performs the privacy cleanup.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // The authoritative in-app boundary below still clears all local PHI.
      }
    }

    // Supabase normally emits SIGNED_OUT. Explicitly await the same transition
    // so callers navigate only after local state is actually isolated.
    await applySession(null);
    if (signOutError) throw signOutError;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
