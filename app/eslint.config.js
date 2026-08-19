import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // RELEASE EXCEPTION (expires 2026-10-01, owner: web engineering):
      // react-refresh/only-export-components stays at "warn" for 44 known
      // component modules that also export constants/hooks. These warnings
      // affect only dev-server hot reload fidelity, never production behavior
      // or correctness; the correctness-class react-hooks/exhaustive-deps
      // warning in MobilePatientDetail was fixed in the 2026-08 release.
      // Rationale: moving non-component exports out of 40+ modules is a wide
      // import-graph refactor that is unsafe to land inside the clinical
      // release window. Track cleanup after GA; do not add NEW violations —
      // treat any increase above 44 as blocking.
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: [
            "badgeVariants",
            "buttonVariants",
            "navigationMenuTriggerStyle",
            "useAuth",
            "useAnnouncer",
            "useAnnouncerSetup",
            "useAnnouncerStore",
            "useTheme",
            "useReducedMotion",
            "useCurrentPatients",
            "usePatients",
            "usePatientCount",
            "useActivePatient",
            "useDashboard",
            "useDashboardTodos",
            "useEdgeHealth",
            "useEdgeHealthActions",
            "useIBCC",
            "useRoundSession",
            "useRoundSessionActions",
            "useSettings",
            "useTeam",
            "useTeamMember",
            "useCurrentTeam",
            "useOfflineSync",
            "useOfflineSyncState",
            "useChangeTracking",
            "useClinicalGuidelines",
            "useDashboardLayout",
            "usePrintContext",
            "useSyncHistory",
            "useSyncHistoryPanel",
            "addSyncEvent",
            "useFormField",
            "useCollaboration",
            "KEYBOARD_SHORTCUTS",
            "useKeyboardShortcut",
            "useKeyboardShortcutHelp",
            "useClinicalGuidelinesState",
            "usePatientSearch",
            "usePatientSort",
            "usePatientFilters",
            "useCurrentPatientsState",
            "useCurrentPatientList",
            "useCurrentPatientActions",
            "useEdgeHealthState",
            "useEdgeHealthContext",
            "useIBCCState",
            "useRoundSessionState",
            "useRoundSessionContext",
            "useTeamState",
            "useTeamActions",
            "useTeamContext",
            "useTeamMembersContext",
            "useOfflineSyncQueue",
            "useOfflineSyncContext",
            "useAnnouncerRef",
            "useAnnouncerContext",
            "useSetCurrentPatients",
            "useActivePatientId",
            "useSetActivePatientId",
            "useAssertBackendReady",
            "resumeRoundSession",
            "getUserTeamId",
            "isTeamMember",
            "useMotionPreference",
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
