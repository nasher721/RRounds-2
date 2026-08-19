import * as React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { AutotextManager } from "@/components/AutotextManager";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { IBCCPanel } from "@/components/ibcc";
import { GuidelinesPanelLazy } from "@/components/guidelines";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Plus, ArrowUpDown, Printer, Trash2, Loader2 } from "lucide-react";
import type { Patient } from "@/types/patient";
import type { MobileTab } from "@/components/layout";
import { useIBCCState } from "@/contexts/IBCCContext";
import { useClinicalGuidelinesState } from "@/contexts/ClinicalGuidelinesContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { patientSafetyLabel } from "@/lib/patientIdentity";
import { PatientFilterType } from "@/constants/config";

const PrintExportModal = React.lazy(() =>
  import("@/components/PrintExportModal").then((module) => ({ default: module.PrintExportModal })),
);
const PhraseManager = React.lazy(() =>
  import("@/components/phrases/PhraseManager").then((module) => ({ default: module.PhraseManager })),
);
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mobile components
import { MobileNavBar, MobileHeader } from "@/components/layout";
import {
  VirtualizedMobilePatientList,
  MobilePatientDetail,
  MobileAddPanel,
  MobileSettingsPanel,
  MobileReferencePanel,
  MobileBatchCourseGenerator,
} from "@/components/mobile";

export const MobileDashboard = () => {
  const {
    user,
    patients,
    filteredPatients,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    autotexts,
    templates,
    customDictionary,
    onAddPatient,
    onAddPatientWithData,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    onCollapseAll,
    onClearAll,
    onImportPatients,
    onAddAutotext,
    onRemoveAutotext,
    onAddTemplate,
    onRemoveTemplate,
    onImportDictionary,
    onSignOut,
    onPatientSelect,
    selectedPatient,
    mobileTab,
    setMobileTab,
    lastSaved,
    patientListViewMode,
    setPatientListViewMode,
  } = useDashboard();
  const todosMap = useDashboardTodos();

  const { globalFontSize, setGlobalFontSize, todosAlwaysVisible, setTodosAlwaysVisible, sortBy, setSortBy, showLabFishbones, setShowLabFishbones, editorToolbarMode, setEditorToolbarMode } = useSettings();
  const changeTracking = useChangeTracking();
  const { closePanel: closeIbccPanel } = useIBCCState();
  const { closePanel: closeGuidelinesPanel } = useClinicalGuidelinesState();

  const outstandingTodosCount = useMemo(() => {
    return Object.values(todosMap).reduce((total, patientTodos) => {
      return total + patientTodos.filter((todo) => !todo.completed).length;
    }, 0);
  }, [todosMap]);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAutotextModal, setShowAutotextModal] = useState(false);
  const [showPhraseManager, setShowPhraseManager] = useState(false);
  const [showBatchCourse, setShowBatchCourse] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [pendingDuplicateId, setPendingDuplicateId] = useState<string | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isPatientTransitioning, setIsPatientTransitioning] = useState(false);

  const resetWindowScroll = useCallback(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (!selectedPatient) {
      setIsPatientTransitioning(false);
      return;
    }
    resetWindowScroll();
    setIsPatientTransitioning(true);
    const timer = window.setTimeout(() => {
      setIsPatientTransitioning(false);
      resetWindowScroll();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [selectedPatient?.id, resetWindowScroll, selectedPatient]);

  const handlePatientSelect = useCallback((patient: Patient | null) => {
    resetWindowScroll();
    if (patient) {
      closeIbccPanel();
      closeGuidelinesPanel();
    }
    onPatientSelect(patient);
  }, [onPatientSelect, resetWindowScroll, closeIbccPanel, closeGuidelinesPanel]);

  const handleTabChange = useCallback((tab: MobileTab) => {
    resetWindowScroll();
    setMobileTab(tab);
  }, [resetWindowScroll, setMobileTab]);

  const handlePrint = useCallback(() => {
    setShowPrintModal(true);
  }, []);

  const handleRemovePatient = useCallback((id: string) => {
    setPendingRemoveId(id);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (pendingRemoveId) {
      onRemovePatient(pendingRemoveId);
      handlePatientSelect(null);
      setPendingRemoveId(null);
    }
  }, [pendingRemoveId, onRemovePatient, handlePatientSelect]);

  const handleDuplicatePatient = useCallback((id: string) => {
    setPendingDuplicateId(id);
  }, []);

  const handleConfirmDuplicate = useCallback(() => {
    if (pendingDuplicateId) {
      onDuplicatePatient(pendingDuplicateId);
      setPendingDuplicateId(null);
    }
  }, [pendingDuplicateId, onDuplicatePatient]);

  const pendingRemovePatient = useMemo(
    () => patients.find((p) => p.id === pendingRemoveId) ?? null,
    [patients, pendingRemoveId],
  );

  const pendingDuplicatePatient = useMemo(
    () => patients.find((p) => p.id === pendingDuplicateId) ?? null,
    [patients, pendingDuplicateId],
  );

  const handleClearAll = useCallback(() => {
    setShowClearAllDialog(true);
  }, []);

  const handleConfirmClearAll = useCallback(() => {
    onClearAll();
    setShowClearAllDialog(false);
  }, [onClearAll]);

  const handleAddPatient = useCallback(() => {
    onAddPatient();
    setMobileTab("patients");
  }, [onAddPatient, setMobileTab]);

  const filterOptions = [
    { id: PatientFilterType.All, label: "All" },
    { id: PatientFilterType.Filled, label: "Filled" },
    { id: PatientFilterType.Empty, label: "Empty" },
  ];

  const lastSavedLabel = new Date(lastSaved).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Patient Detail View */}
      {selectedPatient ? (
        isPatientTransitioning ? (
          <div
            className="min-h-screen bg-background safe-area-top"
            role="status"
            aria-live="polite"
            aria-label={`Loading ${selectedPatient.name || "patient"}`}
          >
            <div className="sticky top-0 z-40 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {selectedPatient.name || "Unnamed patient"}
                  </p>
                  <p className="text-sm text-muted-foreground">Opening chart…</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="h-11 animate-pulse rounded-lg bg-muted/60" />
              <div className="h-28 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-28 animate-pulse rounded-lg bg-muted/40" />
            </div>
          </div>
        ) : (
        <MobilePatientDetail
          key={selectedPatient.id}
          patient={selectedPatient}
          onBack={() => handlePatientSelect(null)}
          onUpdate={onUpdatePatient}
          onRemove={onRemovePatient}
          onDuplicate={onDuplicatePatient}
          onPrint={handlePrint}
          autotexts={autotexts}
          globalFontSize={globalFontSize}
          changeTracking={changeTracking}
          initialTodos={todosMap[selectedPatient.id] ?? []}
          onNext={() => {
            const currentIndex = filteredPatients.findIndex(p => p.id === selectedPatient.id);
            if (currentIndex < filteredPatients.length - 1) {
              handlePatientSelect(filteredPatients[currentIndex + 1]);
            }
          }}
          onPrevious={() => {
            const currentIndex = filteredPatients.findIndex(p => p.id === selectedPatient.id);
            if (currentIndex > 0) {
              handlePatientSelect(filteredPatients[currentIndex - 1]);
            }
          }}
          hasNext={filteredPatients.findIndex(p => p.id === selectedPatient.id) < filteredPatients.length - 1}
          hasPrevious={filteredPatients.findIndex(p => p.id === selectedPatient.id) > 0}
        />
        )
      ) : (
        <>
          {/* Tab Content */}
          {mobileTab === "patients" && (
            <>
              <MobileHeader
                title="Rounds"
                subtitle={`${filteredPatients.length} of ${patients.length} patients · ${outstandingTodosCount} open tasks`}
                statusText={`Saved ${lastSavedLabel}`}
                statusTone="success"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                rightAction={
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePrint}
                      className="h-11 w-11"
                      title="Print / Export"
                      aria-label="Print / Export"
                    >
                      <Printer className="h-5 w-5" />
                    </Button>
                    {patients.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onCollapseAll}
                        className="h-11 w-11"
                        title={patients.every(p => p.collapsed) ? 'Expand All' : 'Collapse All'}
                        aria-label={patients.every(p => p.collapsed) ? 'Expand All' : 'Collapse All'}
                      >
                        <ChevronsUpDown className="h-5 w-5" />
                      </Button>
                    )}
                    {patients.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearAll}
                        className="h-11 w-11 text-destructive hover:text-destructive"
                        title="Clear all patients"
                        aria-label="Clear all patients"
                        data-testid="clear-all-patients"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                }
              />
              <div className="sticky top-14 z-30 bg-background/90 backdrop-blur-xl border-b border-border/20">
                <div className="flex items-center justify-between px-4 py-1.5 text-xs text-muted-foreground">
                  <span>
                    {searchQuery ? `Results for "${searchQuery}"` : `${filteredPatients.length} of ${patients.length} patients`}
                  </span>
                  <span>{filter === PatientFilterType.All ? "All patients" : filterOptions.find((option) => option.id === filter)?.label}</span>
                </div>
                <div
                  data-testid="mobile-patient-controls"
                  className="flex flex-wrap items-center gap-2 px-3 pb-2.5 overflow-x-hidden"
                >
                  <div className="flex min-h-11 min-w-0 items-center gap-1.5 bg-secondary/40 rounded-lg px-2">
                    <span className="text-xs text-muted-foreground">View</span>
                    <Select
                      value={patientListViewMode}
                      onValueChange={(value) => setPatientListViewMode(value as "rich" | "compact")}
                    >
                      <SelectTrigger
                        aria-label="Patient list view"
                        className="h-11 w-[88px] border-0 bg-transparent px-0 text-xs shadow-none focus:ring-0"
                      >
                        <SelectValue placeholder="View" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rich">Rich</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-h-11 min-w-0 items-center gap-1.5 bg-secondary/40 rounded-lg px-2">
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as "number" | "room" | "name")}>
                      <SelectTrigger
                        aria-label="Sort patients"
                        className="h-11 w-[104px] border-0 bg-transparent px-0 text-xs shadow-none focus:ring-0"
                      >
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Order Added</SelectItem>
                        <SelectItem value="room">Room</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filterOptions.map((option) => (
                    <Button
                      key={option.id}
                      variant={filter === option.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setFilter(option.id)}
                      className={cn(
                        "h-11 rounded-lg px-2.5 text-xs",
                        filter === option.id ? "shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="pb-mobile-nav">
                <VirtualizedMobilePatientList
                  patients={filteredPatients}
                  onPatientSelect={handlePatientSelect}
                  onPatientDelete={handleRemovePatient}
                  onPatientDuplicate={handleDuplicatePatient}
                  searchQuery={searchQuery}
                  onAddPatient={handleAddPatient}
                  onOpenImport={() => setShowImportModal(true)}
                  viewMode={patientListViewMode}
                />
              </div>
              <Button
                onClick={handleAddPatient}
                className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg shadow-primary/20 z-40 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
                size="icon"
              >
                <Plus className="h-5 w-5" />
                <span className="sr-only">Add patient</span>
              </Button>
            </>
          )}

          {mobileTab === "add" && (
            <>
              <MobileHeader title="Add Patients" showSearch={false} />
              <div className="pb-mobile-nav">
                <MobileAddPanel
                  onAddPatient={handleAddPatient}
                  onOpenImport={() => setShowImportModal(true)}
                  onSmartImport={onAddPatientWithData}
                />
              </div>
            </>
          )}

          {mobileTab === "reference" && (
            <>
              <MobileHeader title="Reference" showSearch={false} />
              <div className="pb-mobile-nav">
                <MobileReferencePanel />
              </div>
            </>
          )}

          {mobileTab === "settings" && (
            <>
              <MobileHeader title="Settings" showSearch={false} />
              <div className="pb-mobile-nav">
              <MobileSettingsPanel
                  globalFontSize={globalFontSize}
                  onFontSizeChange={setGlobalFontSize}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  changeTracking={changeTracking}
                  onSignOut={onSignOut}
                  onOpenPrint={handlePrint}
                  onClearAll={handleClearAll}
                  onOpenAutotexts={() => setShowAutotextModal(true)}
                  onOpenPhrases={() => setShowPhraseManager(true)}
                  onOpenBatchCourse={() => setShowBatchCourse(true)}
                  userEmail={user?.email ?? ""}
                  todosAlwaysVisible={todosAlwaysVisible}
                  onTodosAlwaysVisibleChange={setTodosAlwaysVisible}
                  showLabFishbones={showLabFishbones}
                  onShowLabFishbonesChange={setShowLabFishbones}
                  patientCount={patients.length}
                  editorToolbarMode={editorToolbarMode}
                  onEditorToolbarModeChange={setEditorToolbarMode}
                />
              </div>
            </>
          )}

          {/* Bottom Navigation */}
          <MobileNavBar
            activeTab={mobileTab}
            onTabChange={handleTabChange}
            patientCount={patients.length}
          />
        </>
      )}

      {/* Modals */}
      <React.Suspense fallback={null}>
        <PrintExportModal
          open={showPrintModal}
          onOpenChange={setShowPrintModal}
          patients={filteredPatients}
          patientTodos={todosMap}
          onUpdatePatient={onUpdatePatient}
        />
      </React.Suspense>

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <EpicHandoffImport
            existingBeds={patients.map(p => p.bed)}
            onImportPatients={async (importedPatients) => {
              await onImportPatients(importedPatients);
              setShowImportModal(false);
              setMobileTab("patients");
            }}
            noDialog
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showAutotextModal} onOpenChange={setShowAutotextModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Autotexts &amp; templates</DialogTitle>
            <DialogDescription>
              Manage typing shortcuts, note templates, and custom dictionary entries for mobile rounds.
            </DialogDescription>
          </DialogHeader>
          <AutotextManager
            autotexts={autotexts}
            templates={templates}
            customDictionary={customDictionary}
            onAddAutotext={onAddAutotext}
            onRemoveAutotext={onRemoveAutotext}
            onAddTemplate={onAddTemplate}
            onRemoveTemplate={onRemoveTemplate}
            onImportDictionary={onImportDictionary}
          />
        </DialogContent>
      </Dialog>

      <React.Suspense fallback={null}>
        <PhraseManager
          open={showPhraseManager}
          onOpenChange={setShowPhraseManager}
        />
      </React.Suspense>

      <MobileBatchCourseGenerator
        patients={patients}
        todosMap={todosMap}
        open={showBatchCourse}
        onOpenChange={setShowBatchCourse}
      />

      {/* Overlay-only panels — never stack into document flow under other tabs */}
      <IBCCPanel variant="overlay" />
      <GuidelinesPanelLazy />

      {/* Remove patient confirmation */}
      <AlertDialog open={pendingRemoveId !== null} onOpenChange={(open) => !open && setPendingRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Patient</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemovePatient
                ? `Remove ${patientSafetyLabel(pendingRemovePatient)} from rounds?`
                : "Remove this patient from rounds?"}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRemoveId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDuplicateId !== null}
        onOpenChange={(open) => !open && setPendingDuplicateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Patient</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDuplicatePatient
                ? `Create a new roster entry from ${patientSafetyLabel(pendingDuplicatePatient)}?`
                : "Create a new roster entry from this patient?"}{" "}
              Chart content is copied into the duplicate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDuplicateId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>Duplicate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all patients confirmation */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Patients</AlertDialogTitle>
            <AlertDialogDescription>
              {patients.length > 0
                ? `Remove all ${patients.length} patients from today's rounds?`
                : "Remove all patients from today's rounds?"}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
