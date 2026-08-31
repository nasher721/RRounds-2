import { useContext } from "react";
import { OpenEvidenceContext } from "@/contexts/openEvidenceContextCore";

export function useOpenEvidenceState() {
  const context = useContext(OpenEvidenceContext);
  if (!context) {
    throw new Error("useOpenEvidenceState must be used within an OpenEvidenceProvider");
  }
  return context;
}
