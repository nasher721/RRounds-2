import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { createOptimizedQueryClient } from "@/lib/cache/queryClientConfig";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Security from "./pages/Security";
import FHIRCallback from "./pages/FHIRCallback";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { SkipToContent } from "@/components/SkipToContent";
import { NavigationBreadcrumbTracker } from "@/components/observability/NavigationBreadcrumbTracker";
import { LazyPanelErrorBoundary } from "@/components/LazyPanelErrorBoundary";
import { AnnouncerProvider, useAnnouncerContext, LiveRegion } from "@/hooks/useAnnouncer";
import { MotionConfig } from "framer-motion";
import { ServiceWorkerUpdatePrompt } from "@/components/ServiceWorkerUpdatePrompt";
import { RouteMetadata } from "@/components/RouteMetadata";

// Auth and the FHIR callback stay in the app graph so recovery routes cannot
// be stranded behind a stale lazy chunk. The print harness is development-only
// and must never pull the export toolchain into the production entry graph.

const Index = React.lazy(() => import("./pages/Index"))
const Landing = React.lazy(() => import("./pages/Landing"))
const AuthenticatedAppProviders = React.lazy(() =>
  import("@/components/AuthenticatedAppProviders"),
)

/** Dev-only: Agentation visual feedback toolbar (not bundled in production). */
const DevAgentationOverlay = import.meta.env.DEV
  ? React.lazy(() =>
      import("@/dev/AgentationDevOverlay").then((m) => ({
        default: m.AgentationDevOverlay,
      }))
    )
  : null

const DevPrintExportTest = import.meta.env.DEV
  ? React.lazy(() => import("./pages/PrintExportTest"))
  : null

// Use optimized QueryClient (cache metrics, CACHE_CONFIG, structural sharing)
const queryClient = createOptimizedQueryClient();
const clearQueryClientAtAuthBoundary = () => queryClient.clear();

function AppRoutesShell({ authenticated }: { authenticated: boolean }): React.ReactElement {
  const location = useLocation();
  return (
    <LazyPanelErrorBoundary title="Failed to load page">
      <RouteMetadata authenticated={authenticated} />
      {/*
        Do not wrap <Routes> in AnimatePresence: the animated child must be the
        transitioning page, not the Router. Route-level transitions live in
        page-transition / layout components instead.
      */}
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={(
            <React.Suspense fallback={<AuthLoadingScreen />}>
              {authenticated ? <Index /> : <Landing />}
            </React.Suspense>
          )}
        />
        <Route path="/auth" element={<Auth />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/security" element={<Security />} />
        <Route path="/fhir/callback" element={<FHIRCallback />} />
        {DevPrintExportTest && (
          <Route
            path="/__print-export-test"
            element={(
              <React.Suspense fallback={null}>
                <DevPrintExportTest />
              </React.Suspense>
            )}
          />
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </LazyPanelErrorBoundary>
  );
}

function AuthLoadingScreen(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        <img
          src="/icons/icon-192.png"
          alt="Rolling Rounds"
          className="h-11 w-11 rounded-xl opacity-90"
        />
        <div className="loading" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="28" height="28">
            <polyline id="back" points="24,4 44,24 24,44 4,24" />
            <polyline id="front" points="24,4 44,24 24,44 4,24" />
          </svg>
        </div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground">
          Loading workspace
        </p>
      </div>
    </div>
  );
}

function AppContent(): React.ReactElement {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <>
      <LiveRegionWrapper />
      <NavigationBreadcrumbTracker />
      <SkipToContent />
      {user ? (
        <React.Suspense fallback={<AuthLoadingScreen />}>
          <AuthenticatedAppProviders>
            {DevAgentationOverlay ? (
              <React.Suspense fallback={null}>
                <DevAgentationOverlay />
              </React.Suspense>
            ) : null}
            <AppRoutesShell authenticated />
          </AuthenticatedAppProviders>
        </React.Suspense>
      ) : (
        <AppRoutesShell authenticated={false} />
      )}
    </>
  );
}

function LiveRegionWrapper(): React.ReactElement {
  const { announce } = useAnnouncerContext();
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    (window as unknown as { __announce?: typeof announce }).__announce = (msg: string) => setMessage(msg);
    return () => {
      delete (window as unknown as { __announce?: typeof announce }).__announce;
    };
  }, [announce]);

  return <LiveRegion message={message} priority="polite" />;
}

function App(): React.ReactElement {
  return (
    <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider onAuthBoundary={clearQueryClientAtAuthBoundary}>
          <TooltipProvider>
            <Toaster />
            <Sonner position="bottom-right" />
            <ServiceWorkerUpdatePrompt />
            <AnnouncerProvider>
              <MotionConfig reducedMotion="always">
                <BrowserRouter>
                  <AppContent />
                </BrowserRouter>
              </MotionConfig>
            </AnnouncerProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
