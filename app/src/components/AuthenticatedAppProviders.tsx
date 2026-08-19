import * as React from "react";
import { TeamProvider } from "@/contexts/TeamContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { DashboardLayoutProvider } from "@/context/DashboardLayoutContext";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { ClinicalGuidelinesProvider } from "@/contexts/ClinicalGuidelinesContext";
import { CurrentPatientsProvider } from "@/contexts/CurrentPatientsContext";
import { SessionTimeoutGuard } from "@/components/SessionTimeoutGuard";
import { isRoundRunnerEnabled } from "@/lib/round/isRoundRunnerEnabled";

const UnifiedAIChatbot = React.lazy(() =>
  import("@/components/UnifiedAIChatbot").then((module) => ({
    default: module.UnifiedAIChatbot,
  })),
);

/**
 * Workspace-only providers. Keeping this module behind the resolved auth
 * boundary prevents public routes from downloading clinical workspace state.
 */
export function AuthenticatedAppProviders({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const showGlobalAssistant = !isRoundRunnerEnabled();

  return (
    <TeamProvider>
      <SettingsProvider>
        <DashboardLayoutProvider>
          <IBCCProvider>
            <ClinicalGuidelinesProvider>
              <CurrentPatientsProvider>
                <SessionTimeoutGuard />
                {showGlobalAssistant ? (
                  <React.Suspense fallback={null}>
                    <UnifiedAIChatbot />
                  </React.Suspense>
                ) : null}
                {children}
              </CurrentPatientsProvider>
            </ClinicalGuidelinesProvider>
          </IBCCProvider>
        </DashboardLayoutProvider>
      </SettingsProvider>
    </TeamProvider>
  );
}

export default AuthenticatedAppProviders;
