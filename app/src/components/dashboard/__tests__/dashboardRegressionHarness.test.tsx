import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { ChangeTrackingProvider } from "@/contexts/ChangeTrackingContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardTodosProvider } from "@/contexts/DashboardTodosContext";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { ClinicalGuidelinesProvider } from "@/contexts/ClinicalGuidelinesContext";
import { DashboardLayoutProvider } from "@/context/DashboardLayoutContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopDashboard } from "@/components/dashboard/DesktopDashboard";
import { VirtualizedPatientList } from "@/components/dashboard/VirtualizedPatientList";
import { MobileDashboard } from "@/components/dashboard/MobileDashboard";
import { VirtualizedMobilePatientList } from "@/components/mobile/VirtualizedMobilePatientList";
import {
  dashboardImportPatients,
  dashboardPatients3,
  dashboardPatients8,
  dashboardPatients20,
  makeDashboardTodosMap,
  productionReadinessFixtures,
} from "@/test/dashboardRegressionFixtures";
import { PatientFilterType } from "@/constants/config";
import type { Patient } from "@/types/patient";
import type { MobileTab } from "@/components/layout";

globalThis.MutationObserver = window.MutationObserver;
globalThis.NodeFilter = window.NodeFilter;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.ResizeObserver =
  window.ResizeObserver ??
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? function scrollIntoView() {};

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof window.IntersectionObserver !== "function") {
  window.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  window.dispatchEvent(new window.Event("resize"));
}

function isUserVisible(element: HTMLElement) {
  return (
    !element.hidden &&
    element.getAttribute("aria-hidden") !== "true" &&
    element.style.display !== "none" &&
    element.style.visibility !== "hidden"
  );
}

function buildDashboardValue({
  patients,
  filteredPatients = patients,
  mobileTab = "patients",
  selectedPatient = null,
  desktopSelectedPatientId = patients[0]?.id ?? null,
  setDesktopSelectedPatientId = () => {},
  searchQuery = "",
  setSearchQuery = () => {},
  filter = PatientFilterType.All,
  setFilter = () => {},
  onAddPatient = () => {},
  onRemovePatient = async () => {},
  onDuplicatePatient = async () => {},
  onClearAll = async () => {},
  onRefetchPatients = () => {},
  patientListViewMode = "compact",
  setPatientListViewMode = () => {},
}: {
  patients: Patient[];
  filteredPatients?: Patient[];
  mobileTab?: MobileTab;
  selectedPatient?: Patient | null;
  desktopSelectedPatientId?: string | null;
  setDesktopSelectedPatientId?: (patientId: string | null) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  filter?: PatientFilterType;
  setFilter?: (filter: PatientFilterType) => void;
  onAddPatient?: () => void;
  onRemovePatient?: (id: string) => Promise<void>;
  onDuplicatePatient?: (id: string) => Promise<void>;
  onClearAll?: () => Promise<void>;
  onRefetchPatients?: () => void | Promise<void>;
  patientListViewMode?: "rich" | "compact";
  setPatientListViewMode?: (mode: "rich" | "compact") => void;
}) {
  return {
    user: { email: "clinician@example.test" },
    patients,
    filteredPatients,
    autotexts: [],
    templates: [],
    customDictionary: {},
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    selectedPatient,
    mobileTab,
    setMobileTab: () => {},
    lastSaved: new Date("2026-05-27T12:00:00.000Z"),
    patientListViewMode,
    setPatientListViewMode,
    onAddPatient,
    onAddPatientWithData: async () => {},
    onUpdatePatient: async () => {},
    onRemovePatient,
    onDuplicatePatient,
    onToggleCollapse: async () => {},
    onCollapseAll: async () => {},
    onClearAll,
    onImportPatients: async () => {},
    onRefetchPatients,
    onAddAutotext: async () => true,
    onRemoveAutotext: async () => {},
    onAddTemplate: async () => true,
    onRemoveTemplate: async () => {},
    onImportDictionary: async () => true,
    onSignOut: () => {},
    onPatientSelect: () => {},
    desktopSelectedPatientId,
    setDesktopSelectedPatientId,
  };
}

function AppProviders({
  patients,
  filteredPatients = patients,
  mobileTab = "patients",
  selectedPatient = null,
  desktopSelectedPatientId = patients[0]?.id ?? null,
  setDesktopSelectedPatientId = () => {},
  searchQuery = "",
  setSearchQuery = () => {},
  filter = PatientFilterType.All,
  setFilter = () => {},
  onAddPatient = () => {},
  onRemovePatient = async () => {},
  onDuplicatePatient = async () => {},
  onClearAll = async () => {},
  onRefetchPatients = () => {},
  patientListViewMode = "compact",
  setPatientListViewMode = () => {},
  children,
}: {
  patients: Patient[];
  filteredPatients?: Patient[];
  mobileTab?: MobileTab;
  selectedPatient?: Patient | null;
  desktopSelectedPatientId?: string | null;
  setDesktopSelectedPatientId?: (patientId: string | null) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  filter?: PatientFilterType;
  setFilter?: (filter: PatientFilterType) => void;
  onAddPatient?: () => void;
  onRemovePatient?: (id: string) => Promise<void>;
  onDuplicatePatient?: (id: string) => Promise<void>;
  onClearAll?: () => Promise<void>;
  onRefetchPatients?: () => void | Promise<void>;
  patientListViewMode?: "rich" | "compact";
  setPatientListViewMode?: (mode: "rich" | "compact") => void;
  children: React.ReactNode;
}) {
  const queryClient = React.useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TeamProvider>
          <SettingsProvider>
            <DashboardLayoutProvider>
              <IBCCProvider>
                <ClinicalGuidelinesProvider>
                  <TooltipProvider>
                    <ChangeTrackingProvider>
                      <DashboardProvider
                        {...buildDashboardValue({
                          patients,
                          filteredPatients,
                          mobileTab,
                          selectedPatient,
                          desktopSelectedPatientId,
                          setDesktopSelectedPatientId,
                          searchQuery,
                          setSearchQuery,
                          filter,
                          setFilter,
                          onAddPatient,
                          onRemovePatient,
                          onDuplicatePatient,
                          onClearAll,
                          onRefetchPatients,
                          patientListViewMode,
                          setPatientListViewMode,
                        })}
                      >
                        <DashboardTodosProvider todosMap={makeDashboardTodosMap(patients)}>
                          {children}
                        </DashboardTodosProvider>
                      </DashboardProvider>
                    </ChangeTrackingProvider>
                  </TooltipProvider>
                </ClinicalGuidelinesProvider>
              </IBCCProvider>
            </DashboardLayoutProvider>
          </SettingsProvider>
        </TeamProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("production dashboard roster regression harness", () => {
  it("keeps section Todo focus and typing out of clinical notes", async () => {
    setViewport(1440, 900);
    render(
      <MemoryRouter>
        <AppProviders patients={dashboardPatients3} desktopSelectedPatientId={dashboardPatients3[0].id}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    const editor = await screen.findByRole("textbox", { name: "Enter clinical summary..." });
    const originalClinicalSummary = editor.innerHTML;
    const sectionTaskButton = screen.getAllByRole("button", { name: /Section tasks: add or manage tasks/i })[0];
    fireEvent.click(sectionTaskButton);

    const todoInput = await screen.findByPlaceholderText("Add a todo...");
    todoInput.focus();
    fireEvent.change(todoInput, { target: { value: "Repeat head CT" } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(document.activeElement, todoInput);
    assert.equal((todoInput as HTMLInputElement).value, "Repeat head CT");
    assert.equal(editor.innerHTML, originalClinicalSummary);
    assert.ok(screen.getByRole("button", { name: "Add todo" }));
  });

  it("opens visible patient and editor toolbar controls without redirecting focus", async () => {
    setViewport(1440, 900);
    render(
      <MemoryRouter>
        <AppProviders patients={dashboardPatients3} desktopSelectedPatientId={dashboardPatients3[0].id}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    const editor = await screen.findByRole("textbox", { name: "Enter clinical summary..." });
    const customize = screen.getByRole("button", { name: "Customize patient info toolbar" });
    fireEvent.click(customize);
    assert.ok(await screen.findByRole("heading", { name: "Customize Patient Info Toolbar" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      assert.equal(screen.queryByRole("heading", { name: "Customize Patient Info Toolbar" }), null);
    });

    assert.equal(
      screen.queryByRole("button", { name: /AI model:.*Open menu to change model/i }),
      null,
      "clinical model selection must remain organization-managed",
    );

    fireEvent.focus(editor);
    const phraseButton = await screen.findByRole("button", { name: "Insert clinical phrase from library" });
    fireEvent.click(phraseButton);
    const phraseSearch = await screen.findByPlaceholderText("Search phrases...");
    assert.notEqual(document.activeElement, editor);
    fireEvent.keyDown(phraseSearch, { key: "Escape" });

    fireEvent.focus(editor);
    fireEvent.keyDown(editor, { key: "Tab" });
    assert.notEqual(document.activeElement, editor);
    fireEvent.focus(editor);
    fireEvent.keyDown(editor, { key: "Escape" });
    assert.notEqual(document.activeElement, editor);
  });
  it("renders sober zero-patient dashboard recovery actions", async () => {
    setViewport(1440, 900);
    let addPatientCalls = 0;

    render(
      <MemoryRouter>
        <AppProviders patients={[]} onAddPatient={() => addPatientCalls += 1}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    assert.ok(await screen.findByRole("heading", { name: "Ready to Start Rounds" }));
    assert.ok(screen.getByText("No patients on your roster yet"));
    assert.ok(screen.getByText("Add your first patient to begin documenting rounds with your team."));
    fireEvent.click(screen.getByRole("button", { name: "Add First Patient" }));
    assert.equal(addPatientCalls, 1);
    assert.ok(screen.getByRole("button", { name: "Import from CSV/EHR" }));
    assert.ok(screen.getByRole("button", { name: "Preview example structure" }));
  });

  it("renders filtered-empty dashboard recovery actions without losing the source roster", async () => {
    setViewport(1440, 900);
    let clearedSearch = "";
    let clearedFilter: PatientFilterType | null = null;

    render(
      <MemoryRouter>
        <AppProviders
          patients={dashboardPatients3}
          filteredPatients={[]}
          searchQuery="zz-no-match"
          setSearchQuery={(query) => {
            clearedSearch = query;
          }}
          filter={PatientFilterType.Filled}
          setFilter={(nextFilter) => {
            clearedFilter = nextFilter;
          }}
        >
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    assert.ok(await screen.findByRole("heading", { name: "No patients match your filter" }));
    assert.ok(screen.getByText("0 of 3 patients"));
    assert.ok(screen.getByText("Try adjusting your search or filter criteria."));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    assert.equal(clearedSearch, "");
    assert.equal(clearedFilter, PatientFilterType.All);
  });

  it("renders real VirtualizedPatientList with at least four user-visible desktop roster rows at 1440x900", async () => {
    setViewport(1440, 900);
    render(
      <AppProviders patients={dashboardPatients8}>
        <VirtualizedPatientList />
      </AppProviders>,
    );

    const rows = await screen.findAllByRole("button", { name: /^Select / });
    assert.equal(rows.filter(isUserVisible).length >= 4, true);
    assert.ok(screen.getByRole("button", { name: /Select Alex Morgan, A01/ }));
    assert.ok(screen.getByRole("button", { name: /Select Devon Rivera, A04/ }));
    assert.equal(screen.getByRole("button", { name: /Select Alex Morgan, A01/ }).getAttribute("aria-current"), "true");
  });

  it("shows documentation progress in roster rows and exposes an accessible section navigator", async () => {
    setViewport(1440, 900);
    render(
      <AppProviders patients={dashboardPatients8}>
        <VirtualizedPatientList />
      </AppProviders>,
    );

    const alexRow = await screen.findByRole("button", { name: /Select Alex Morgan, A01/ });
    assert.match(alexRow.textContent ?? "", /In progress/);
    assert.match(alexRow.textContent ?? "", /3\/5 sections/);

    const sectionNavigator = screen.getByRole("navigation", { name: "Documentation sections" });
    for (const sectionName of ["Summary", "Events", "Systems", "Results", "Medications"]) {
      const sectionButton = screen.getByRole("button", { name: sectionName });
      assert.equal(sectionNavigator.contains(sectionButton), true);
    }
    assert.match(sectionNavigator.textContent ?? "", /60% complete/);
  });

  it("renders real DesktopDashboard controls and production roster rows for a 20-patient desktop census", async () => {
    setViewport(1440, 900);
    render(
      <MemoryRouter>
        <AppProviders patients={dashboardPatients20}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    assert.ok(await screen.findByRole("textbox", { name: "Search patients" }));
    assert.ok(screen.getByRole("button", { name: "Filter and sort patients" }));
    assert.ok(screen.getByRole("button", { name: /Print/i }));

    const rows = screen.getAllByRole("button", { name: /^Select / });
    assert.equal(rows.filter(isUserVisible).length >= 4, true);
    assert.ok(screen.getByRole("button", { name: /Select Alex Morgan, A01/ }));
  });

  it("opens the AI command palette with selected non-first patient context", async () => {
    setViewport(1440, 900);
    render(
      <MemoryRouter>
        <AppProviders
          patients={dashboardPatients20}
          selectedPatient={null}
          desktopSelectedPatientId={dashboardPatients20[3].id}
        >
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    assert.equal(
      screen.getByRole("button", { name: /Select Devon Rivera, A04/ }).getAttribute("aria-current"),
      "true",
    );

    fireEvent.click(await screen.findByRole("button", { name: "AI" }));

    assert.ok(await screen.findByText("Selected: Devon Rivera"));
    assert.ok(await screen.findByText("Draft note for Devon Rivera"));
    assert.ok(screen.getByText("Summarize Devon Rivera's overnight events"));
    assert.equal(screen.queryByText(/Draft note for Alex Morgan/), null);
  });

  it("explains unavailable patient-required AI actions when no patient is selected", async () => {
    setViewport(1440, 900);
    render(
      <MemoryRouter>
        <AppProviders
          patients={productionReadinessFixtures.threePatientRoster}
          selectedPatient={null}
          desktopSelectedPatientId={null}
        >
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "AI" }));

    assert.ok(
      await screen.findByText("No patient selected — choose a patient on the roster first"),
    );
    assert.ok(screen.getAllByText(/Unavailable — select a patient first/).length > 0);
    assert.equal(screen.queryByText(/Draft note for/), null);
  });

  it("keeps the active roster row and patient workspace on the same patient", async () => {
    setViewport(1440, 900);

    function SelectionConsistencyHarness() {
      const [selectedId, setSelectedId] = React.useState<string | null>(dashboardPatients8[0].id);
      return (
        <AppProviders
          patients={dashboardPatients8}
          desktopSelectedPatientId={selectedId}
          setDesktopSelectedPatientId={setSelectedId}
        >
          <VirtualizedPatientList />
        </AppProviders>
      );
    }

    render(<SelectionConsistencyHarness />);

    const devonRow = await screen.findByRole("button", { name: /Select Devon Rivera, A04/ });
    fireEvent.click(devonRow);

    await waitFor(() => {
      assert.equal(devonRow.getAttribute("aria-current"), "true");
      assert.ok(screen.getByRole("article", { name: "Patient: Devon Rivera" }));
      assert.equal(screen.getByRole("textbox", { name: "Patient name" }).getAttribute("value"), "Devon Rivera");
      assert.equal(screen.getByRole("textbox", { name: "Bed or room number" }).getAttribute("value"), "A04");
    });

    assert.equal(
      screen.getByRole("button", { name: /Select Alex Morgan, A01/ }).hasAttribute("aria-current"),
      false,
    );
  });

  it("applies a desktop patient-list view change and preserves it across dashboard rerenders", async () => {
    setViewport(1440, 900);

    function ViewModeHarness() {
      const [viewMode, setViewMode] = React.useState<"rich" | "compact">("compact");
      const [revision, setRevision] = React.useState(0);
      return (
        <AppProviders
          patients={dashboardPatients8}
          patientListViewMode={viewMode}
          setPatientListViewMode={setViewMode}
        >
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Rerender dashboard {revision}
          </button>
          <DesktopDashboard />
        </AppProviders>
      );
    }

    render(
      <MemoryRouter>
        <ViewModeHarness />
      </MemoryRouter>,
    );

    const viewModeSelect = await screen.findByRole("combobox", { name: "Patient list view" });
    assert.equal(viewModeSelect.textContent?.trim(), "Compact");
    fireEvent.click(viewModeSelect);
    fireEvent.click(await screen.findByRole("option", { name: "Rich" }));
    await waitFor(() => assert.equal(screen.getByRole("combobox", { name: "Patient list view" }).textContent?.trim(), "Rich"));

    fireEvent.click(screen.getByRole("button", { name: /Rerender dashboard/ }));
    assert.equal(screen.getByRole("combobox", { name: "Patient list view" }).textContent?.trim(), "Rich");
  });

  it("keeps desktop roster rows visible and active-row accessibility stable after add/import/selection", async () => {
    setViewport(1440, 768);

    function StatefulRosterHarness() {
      const [patients, setPatients] = React.useState<Patient[]>(dashboardPatients8);
      const [selectedId, setSelectedId] = React.useState<string | null>(dashboardPatients8[0].id);
      const filteredPatients = patients;

      return (
        <AppProviders
          patients={patients}
          filteredPatients={filteredPatients}
          desktopSelectedPatientId={selectedId}
          setDesktopSelectedPatientId={setSelectedId}
        >
          <button type="button" onClick={() => setPatients((prev) => [...prev, dashboardPatients20[8]])}>
            Add fixture patient
          </button>
          <button type="button" onClick={() => setPatients(dashboardPatients20)}>
            Import fixture census
          </button>
          <VirtualizedPatientList />
        </AppProviders>
      );
    }

    render(<StatefulRosterHarness />);

    const visibleRosterRows = () =>
      screen.getAllByRole("button", { name: /^Select / }).filter(isUserVisible);

    assert.equal((await screen.findAllByRole("button", { name: /^Select / })).filter(isUserVisible).length >= 4, true);

    fireEvent.click(screen.getByRole("button", { name: "Add fixture patient" }));
    await waitFor(() => assert.equal(visibleRosterRows().length >= 4, true));

    fireEvent.click(screen.getByRole("button", { name: "Import fixture census" }));
    await waitFor(() => assert.equal(visibleRosterRows().length >= 4, true));

    const devonRow = screen.getByRole("button", { name: /Select Devon Rivera, A04/ });
    devonRow.focus();
    assert.equal(document.activeElement, devonRow);

    fireEvent.click(devonRow);
    await waitFor(() => {
      assert.equal(devonRow.getAttribute("aria-current"), "true");
    });
    assert.match(devonRow.className, /focus-visible:ring-2/);

    const patientListRegion = screen.getByRole("region", { name: /Patients \(\d+\)/ });
    assert.match(patientListRegion.className, /lg:h-full/);
    assert.doesNotMatch(patientListRegion.className, /100vh-14rem/);
    assert.equal(document.querySelectorAll("[data-anime-stagger-item]").length, 0);
  });

  it("names the target patient before confirming a desktop remove action", async () => {
    setViewport(1440, 768);
    render(
      <AppProviders patients={dashboardPatients8} desktopSelectedPatientId={dashboardPatients8[0].id}>
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Alex Morgan, A01/ }));

    const removeButton = screen.getAllByRole("button", { name: /remove/i }).find(isUserVisible);
    assert.ok(removeButton, "expected a visible remove button for the selected patient");
    fireEvent.click(removeButton);

    assert.ok(await screen.findByRole("alertdialog", { name: "Remove Patient" }));
    assert.ok(screen.getByText(/Remove Alex Morgan.*from rounds\?/));
    assert.ok(screen.getByRole("button", { name: "Cancel" }));
  });

  it("returns focus to the remove trigger after closing a representative confirmation dialog", async () => {
    setViewport(1440, 768);
    render(
      <AppProviders patients={dashboardPatients8} desktopSelectedPatientId={dashboardPatients8[0].id}>
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Alex Morgan, A01/ }));

    const removeButton = screen.getAllByRole("button", { name: /remove/i }).find(isUserVisible);
    assert.ok(removeButton, "expected a visible remove button for the selected patient");
    removeButton.focus();
    assert.equal(document.activeElement, removeButton);

    fireEvent.click(removeButton);
    assert.ok(await screen.findByRole("alertdialog", { name: "Remove Patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Radix restores focus from a zero-delay task after the portal unmounts.
    // Yield before asserting so Testing Library does not install a document-wide
    // MutationObserver while the focus scope is still tearing down.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(screen.queryByRole("alertdialog", { name: "Remove Patient" }), null);
    assert.equal(document.activeElement, removeButton);
  });

  it("does not mutate when a remove confirmation is canceled", async () => {
    setViewport(1440, 768);
    const removedIds: string[] = [];

    render(
      <AppProviders
        patients={productionReadinessFixtures.threePatientRoster}
        desktopSelectedPatientId={productionReadinessFixtures.threePatientRoster[0].id}
        onRemovePatient={async (id) => {
          removedIds.push(id);
        }}
      >
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Alex Morgan, A01/ }));
    const removeButton = screen.getAllByRole("button", { name: /remove/i }).find(isUserVisible);
    assert.ok(removeButton, "expected a visible remove button for the selected patient");
    fireEvent.click(removeButton);

    assert.ok(await screen.findByRole("alertdialog", { name: "Remove Patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      assert.equal(screen.queryByRole("alertdialog", { name: "Remove Patient" }), null);
    });
    assert.deepEqual(removedIds, []);
  });

  it("exposes discoverable AI and sync help affordances on the desktop shell", async () => {
    setViewport(1440, 900);

    render(
      <MemoryRouter>
        <AppProviders patients={productionReadinessFixtures.threePatientRoster}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    const aiButton = await screen.findByRole("button", { name: /Open AI command palette/i });
    assert.match(aiButton.getAttribute("title") ?? "", /AI workspace/i);
    assert.match(aiButton.getAttribute("aria-label") ?? "", /organization-managed provider/i);

    const retrySyncButton = screen.getByRole("button", { name: "Retry sync and refresh patient list" });
    assert.ok(retrySyncButton);
    assert.equal(retrySyncButton.getAttribute("aria-busy"), "false");
  });

  it("names the target patient before confirming a desktop duplicate action", async () => {
    setViewport(1440, 768);
    const duplicatedIds: string[] = [];

    render(
      <AppProviders
        patients={productionReadinessFixtures.threePatientRoster}
        desktopSelectedPatientId={productionReadinessFixtures.threePatientRoster[0].id}
        onDuplicatePatient={async (id) => {
          duplicatedIds.push(id);
        }}
      >
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Alex Morgan, A01/ }));
    const duplicateButton = screen.getAllByRole("button", { name: /duplicate/i }).find(isUserVisible);
    assert.ok(duplicateButton, "expected a visible duplicate button for the selected patient");
    fireEvent.click(duplicateButton);

    assert.ok(await screen.findByRole("alertdialog", { name: /Duplicate Patient/i }));
    assert.ok(screen.getByText(/Create a new roster entry from Alex Morgan/i));
    assert.deepEqual(duplicatedIds, [], "duplicate must wait for confirmation");
  });

  it("does not mutate when a duplicate confirmation is canceled", async () => {
    setViewport(1440, 768);
    const duplicatedIds: string[] = [];

    render(
      <AppProviders
        patients={productionReadinessFixtures.threePatientRoster}
        desktopSelectedPatientId={productionReadinessFixtures.threePatientRoster[0].id}
        onDuplicatePatient={async (id) => {
          duplicatedIds.push(id);
        }}
      >
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Alex Morgan, A01/ }));
    const duplicateButton = screen.getAllByRole("button", { name: /duplicate/i }).find(isUserVisible);
    assert.ok(duplicateButton, "expected a visible duplicate button for the selected patient");
    fireEvent.click(duplicateButton);

    assert.ok(await screen.findByRole("alertdialog", { name: /Duplicate Patient/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      assert.equal(screen.queryByRole("alertdialog", { name: /Duplicate Patient/i }), null);
    });
    assert.deepEqual(duplicatedIds, []);
  });

  it("confirms a desktop duplicate mutation exactly once", async () => {
    setViewport(1440, 768);
    const duplicatedIds: string[] = [];

    render(
      <AppProviders
        patients={productionReadinessFixtures.threePatientRoster}
        desktopSelectedPatientId={productionReadinessFixtures.threePatientRoster[1].id}
        onDuplicatePatient={async (id) => {
          duplicatedIds.push(id);
        }}
      >
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Blair Patel, A02/ }));
    const duplicateButton = screen.getAllByRole("button", { name: /duplicate/i }).find(isUserVisible);
    assert.ok(duplicateButton, "expected a visible duplicate button for the selected patient");
    fireEvent.click(duplicateButton);

    assert.ok(await screen.findByRole("alertdialog", { name: /Duplicate Patient/i }));
    assert.ok(screen.getByText(/Create a new roster entry from Blair Patel/i));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    await waitFor(() => {
      assert.deepEqual(duplicatedIds, [productionReadinessFixtures.threePatientRoster[1].id]);
    });
    assert.equal(duplicatedIds.length, 1);
  });

  it("confirms a desktop remove mutation exactly once", async () => {
    setViewport(1440, 768);
    const removedIds: string[] = [];

    render(
      <AppProviders
        patients={productionReadinessFixtures.threePatientRoster}
        desktopSelectedPatientId={productionReadinessFixtures.threePatientRoster[0].id}
        onRemovePatient={async (id) => {
          removedIds.push(id);
        }}
      >
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Alex Morgan, A01/ }));
    const removeButton = screen.getAllByRole("button", { name: /remove/i }).find(isUserVisible);
    assert.ok(removeButton, "expected a visible remove button for the selected patient");
    fireEvent.click(removeButton);

    assert.ok(await screen.findByRole("alertdialog", { name: "Remove Patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      assert.deepEqual(removedIds, [productionReadinessFixtures.threePatientRoster[0].id]);
    });
    assert.equal(removedIds.length, 1);
  });

  it("exposes sync loading status while desktop patient refresh is in flight", async () => {
    setViewport(1440, 900);
    let resolveRefetch: (() => void) | undefined;
    const refetchPromise = new Promise<void>((resolve) => {
      resolveRefetch = resolve;
    });

    render(
      <MemoryRouter>
        <AppProviders patients={dashboardPatients3} onRefetchPatients={() => refetchPromise}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    const retrySyncButton = await screen.findByRole("button", { name: "Retry sync and refresh patient list" });
    fireEvent.click(retrySyncButton);

    await waitFor(() => {
      assert.equal(retrySyncButton.getAttribute("aria-busy"), "true");
      assert.equal(retrySyncButton.hasAttribute("disabled"), true);
    });

    resolveRefetch?.();

    await waitFor(() => {
      assert.equal(retrySyncButton.getAttribute("aria-busy"), "false");
      assert.equal(retrySyncButton.hasAttribute("disabled"), false);
    });
  });

  it("renders real VirtualizedMobilePatientList with visible 20-patient rows at 375px width", async () => {
    setViewport(375, 812);
    const selected: Patient[] = [];
    render(
      <VirtualizedMobilePatientList
        patients={dashboardPatients20}
        onPatientSelect={(patient) => selected.push(patient)}
        onPatientDelete={() => {}}
        onPatientDuplicate={() => {}}
        searchQuery=""
        onAddPatient={() => {}}
        onOpenImport={() => {}}
        viewMode="compact"
      />,
    );

    assert.ok(await screen.findByText("Alex Morgan"));
    assert.ok(screen.getByText("A01"));
    const mobileList = screen.getByTestId("virtualized-mobile-patient-list");
    assert.equal(mobileList.style.height, "576px");
    assert.equal(mobileList.style.width, "100%");
    fireEvent.click(screen.getByText("Alex Morgan"));
    assert.equal(selected[0]?.id, "patient-01");
  });

  it("renders real MobileDashboard patient and add/import controls at 375px width", async () => {
    setViewport(375, 812);
    function StatefulMobileHarness() {
      const [mobileTab, setMobileTab] = React.useState<MobileTab>("patients");
      const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
      const value = {
        ...buildDashboardValue({
          patients: dashboardPatients20,
          filteredPatients: dashboardPatients20,
          mobileTab,
          selectedPatient,
        }),
        setMobileTab,
        onPatientSelect: setSelectedPatient,
        onImportPatients: async (patients: unknown) => {
          assert.deepEqual(patients, dashboardImportPatients);
        },
      };
      const queryClient = React.useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }), []);

      return (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TeamProvider>
              <SettingsProvider>
                <DashboardLayoutProvider>
                  <IBCCProvider>
                    <ClinicalGuidelinesProvider>
                      <TooltipProvider>
                        <ChangeTrackingProvider>
                          <DashboardProvider {...value}>
                            <DashboardTodosProvider todosMap={makeDashboardTodosMap(dashboardPatients20)}>
                              <MobileDashboard />
                            </DashboardTodosProvider>
                          </DashboardProvider>
                        </ChangeTrackingProvider>
                      </TooltipProvider>
                    </ClinicalGuidelinesProvider>
                  </IBCCProvider>
                </DashboardLayoutProvider>
              </SettingsProvider>
            </TeamProvider>
          </AuthProvider>
        </QueryClientProvider>
      );
    }

    render(<StatefulMobileHarness />);

    assert.ok(await screen.findByRole("button", { name: "Open patient search" }));
    assert.ok(screen.getByRole("button", { name: "Add patient" }));
    assert.ok(screen.getByRole("button", { name: "Patients, 20 total" }));
    assert.ok(screen.getByRole("combobox", { name: "Patient list view" }));
    assert.ok(screen.getByRole("combobox", { name: "Sort patients" }));
    assert.ok(screen.getByRole("button", { name: "Filled" }));
    assert.ok(screen.getByRole("button", { name: "Empty" }));
    const controls = screen.getByTestId("mobile-patient-controls");
    assert.ok(controls.className.includes("flex-wrap"));
    assert.ok(controls.className.includes("overflow-x-hidden"));
    assert.equal(controls.className.includes("overflow-x-auto"), false);
    assert.ok(screen.getByText("A01"));
    assert.ok(screen.getByText("Alex Morgan"));

    fireEvent.click(screen.getByText("Blair Patel"));
    assert.ok(await screen.findByRole("button", { name: /Back/i }));

    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      assert.ok(screen.getByRole("button", { name: "Import Patient List - Upload a list file or paste patient text" }));
    });
  });

  /**
   * The roster rail is the primary way a clinician moves between charts, so
   * arrow-key traversal is exercised against the real rail inside the real
   * desktop shell rather than asserted from source.
   */
  function renderKeyboardRosterHarness() {
    setViewport(1440, 900);

    function KeyboardRosterHarness() {
      const [selectedId, setSelectedId] = React.useState<string | null>(dashboardPatients8[0].id);
      return (
        <MemoryRouter>
          <AppProviders
            patients={dashboardPatients8}
            desktopSelectedPatientId={selectedId}
            setDesktopSelectedPatientId={setSelectedId}
          >
            <DesktopDashboard />
          </AppProviders>
        </MemoryRouter>
      );
    }

    render(<KeyboardRosterHarness />);
  }

  /** Rail rows only — the trailing readiness clause is unique to the rail. */
  const rosterRows = () => screen.getAllByRole("button", { name: /^Select .* sections ready$/ });

  it("moves roster selection and focus with the arrow keys, wrapping at the ends", async () => {
    renderKeyboardRosterHarness();

    const first = await screen.findByRole("button", { name: /^Select Alex Morgan, A01/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });

    await waitFor(() => {
      const second = rosterRows()[1];
      assert.equal(second.getAttribute("aria-current"), "true");
      assert.equal(document.activeElement, second);
    });

    // Selection follows focus, so the open chart tracks the highlighted row.
    const secondName = rosterRows()[1]
      .getAttribute("aria-label")
      ?.replace(/^Select /, "")
      .split(",")[0];
    await waitFor(() => {
      assert.equal(
        screen.getByRole("textbox", { name: "Patient name" }).getAttribute("value"),
        secondName,
      );
    });

    // Back to the top, then ArrowUp wraps to the bottom of the roster.
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    await waitFor(() => {
      assert.equal(rosterRows()[0].getAttribute("aria-current"), "true");
    });

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowUp" });
    await waitFor(() => {
      const rows = rosterRows();
      assert.equal(rows[rows.length - 1].getAttribute("aria-current"), "true");
      assert.equal(document.activeElement, rows[rows.length - 1]);
    });
  });

  it("jumps with Home/End, ignores modified presses, and keeps one row tabbable", async () => {
    renderKeyboardRosterHarness();

    const first = await screen.findByRole("button", { name: /^Select Alex Morgan, A01/ });

    // Exactly one row is reachable by Tab; the rest are arrow-key targets.
    const initialRows = rosterRows();
    assert.ok(initialRows.length > 1, "expected a multi-patient roster");
    assert.deepEqual(
      initialRows.map((row) => row.getAttribute("tabindex")),
      initialRows.map((_, index) => (index === 0 ? "0" : "-1")),
    );

    // Modifier combos belong to app-level shortcuts, not the rail.
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown", metaKey: true });
    assert.equal(first.getAttribute("aria-current"), "true");
    assert.equal(document.activeElement, first);

    fireEvent.keyDown(first, { key: "End" });
    await waitFor(() => {
      const rows = rosterRows();
      assert.equal(document.activeElement, rows[rows.length - 1]);
    });

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    await waitFor(() => {
      assert.equal(document.activeElement, rosterRows()[0]);
    });
  });

  /** Documentation tab strip: same traversal as the rail, on the other axis. */
  const sectionTabs = () =>
    Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-documentation-tab]"),
    );

  it("moves focus across the documentation tabs with the horizontal arrows", async () => {
    renderKeyboardRosterHarness();

    await screen.findByRole("button", { name: /^Select Alex Morgan, A01/ });
    const tabs = sectionTabs();
    assert.equal(tabs.length, 5, "expected the five documentation sections");

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    await waitFor(() => assert.equal(document.activeElement, tabs[1]));

    fireEvent.keyDown(tabs[1], { key: "End" });
    await waitFor(() => assert.equal(document.activeElement, tabs[4]));

    // Wraps forward off the end, and back off the front.
    fireEvent.keyDown(tabs[4], { key: "ArrowRight" });
    await waitFor(() => assert.equal(document.activeElement, tabs[0]));

    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    await waitFor(() => assert.equal(document.activeElement, tabs[4]));
  });

  it("keeps documentation tabs on manual activation so focus stays in the strip", async () => {
    renderKeyboardRosterHarness();

    await screen.findByRole("button", { name: /^Select Alex Morgan, A01/ });
    const tabs = sectionTabs();

    // Arrowing moves focus without activating: the pressed tab must not change,
    // otherwise jumpToSection would pull focus into the section's editor.
    const pressedBefore = tabs.map((tab) => tab.getAttribute("aria-pressed"));
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    await waitFor(() => assert.equal(document.activeElement, tabs[1]));
    assert.deepEqual(
      sectionTabs().map((tab) => tab.getAttribute("aria-pressed")),
      pressedBefore,
    );

    // Exactly one tab is in the tab order, and it is the active one.
    const tabIndexes = sectionTabs().map((tab) => tab.getAttribute("tabindex"));
    assert.equal(tabIndexes.filter((value) => value === "0").length, 1);
    const activeIndex = sectionTabs().findIndex(
      (tab) => tab.getAttribute("aria-pressed") === "true",
    );
    assert.equal(tabIndexes[activeIndex], "0");

    // Vertical arrows belong to the scroll container, not the strip.
    tabs[1].focus();
    fireEvent.keyDown(tabs[1], { key: "ArrowDown" });
    assert.equal(document.activeElement, tabs[1]);

    // Modifier combos belong to app-level shortcuts.
    fireEvent.keyDown(tabs[1], { key: "ArrowRight", metaKey: true });
    assert.equal(document.activeElement, tabs[1]);
  });
});
