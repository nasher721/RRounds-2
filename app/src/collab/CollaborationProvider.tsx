import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import * as Y from "yjs";
import {
  createPatientNoteStore,
  PatientNoteStore,
  CursorInfo,
  updateCursor,
  removeCursor,
} from "./patient.store";

type CollaborationContextType = {
  store: PatientNoteStore | null;
  isConnected: boolean;
  collaborators: Array<{ userId: string } & CursorInfo>;
  setLocalCursor: (patientId: string, system: string) => void;
  clearLocalCursor: () => void;
};

const CollaborationContext = createContext<CollaborationContextType | null>(null);

export function useCollaboration(): CollaborationContextType {
  const context = useContext(CollaborationContext);
  if (!context) {
    return {
      store: null,
      isConnected: false,
      collaborators: [],
      setLocalCursor: () => {},
      clearLocalCursor: () => {},
    };
  }
  return context;
}

interface CollaborationProviderProps {
  children: React.ReactNode;
  roomPrefix?: string;
}

export function CollaborationProvider({
  children,
  roomPrefix = "roundrobin",
}: CollaborationProviderProps): React.ReactElement {
  const [store, setStore] = useState<PatientNoteStore | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<
    Array<{ userId: string } & CursorInfo>
  >([]);
  const userIdRef = useRef<string>(
    `user-${Math.random().toString(36).substring(2, 9)}`
  );
  useEffect(() => {
    const currentUserId = userIdRef.current;
    const doc = new Y.Doc();
    const newStore = createPatientNoteStore(doc);
    setStore(newStore);
    setIsConnected(true);

    doc.on("update", () => {
      if (newStore.cursors) {
        const cursorList: Array<{ userId: string } & CursorInfo> = [];
        for (const [uid, info] of Object.entries(newStore.cursors)) {
          if (
            info &&
            uid !== userIdRef.current &&
            info.timestamp > Date.now() - 30000
          ) {
            cursorList.push({ userId: uid, ...info });
          }
        }
        setCollaborators(cursorList);
      }
    });

    const cleanupInterval = setInterval(() => {
      removeCursor(newStore, userIdRef.current);
    }, 25000);

    const handleBeforeUnload = () => {
      removeCursor(newStore, userIdRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(cleanupInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      removeCursor(newStore, currentUserId);
      doc.destroy();
    };
  }, [roomPrefix]);

  const setLocalCursor = useCallback(
    (patientId: string, system: string) => {
      if (store) {
        const key = `${patientId}:${system}`;
        updateCursor(store, userIdRef.current, {
          name: "You",
          color: "#3b82f6",
          system: key,
          timestamp: Date.now(),
        });
      }
    },
    [store]
  );

  const clearLocalCursor = useCallback(() => {
    if (store) {
      removeCursor(store, userIdRef.current);
    }
  }, [store]);

  return (
    <CollaborationContext.Provider
      value={{
        store,
        isConnected,
        collaborators,
        setLocalCursor,
        clearLocalCursor,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
}
