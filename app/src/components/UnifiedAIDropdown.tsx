import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sparkles,
  ShieldCheck,
  FileText,
  Zap,
  List,
  Stethoscope,
  MessageSquarePlus,
  Loader2,
  Wand2,
  Plus,
  Trash2,
} from "lucide-react"
import { useAIClinicalAssistant } from "@/hooks/useAIClinicalAssistant"
import { useTextTransform, TransformType, CustomPrompt } from "@/hooks/useTextTransform"
import { useWritingStyleProfile } from "@/hooks/useWritingStyleProfile"
import { toast } from "sonner"
import type { Patient } from "@/types/patient"

export interface UnifiedAIDropdownProps {
  getSelectedText: () => string | null
  replaceSelectedText: (newText: string) => void
  /** For Sense Check: full document text. If not provided, Sense Check is hidden. */
  getDocumentText?: () => string | null
  /** When draft is ready, parent sets editor content (e.g. replace or append). */
  onDraftNoteGenerated?: (draft: string) => void
  patient?: Patient
  section?: string
  disabled?: boolean
  /** Optional trigger size/class for toolbar consistency */
  triggerClassName?: string
}

export const UnifiedAIDropdown = ({
  getSelectedText,
  replaceSelectedText,
  getDocumentText,
  onDraftNoteGenerated,
  patient,
  disabled,
  triggerClassName,
}: UnifiedAIDropdownProps) => {
  const [customDialogOpen, setCustomDialogOpen] = React.useState(false)
  const [savePromptDialogOpen, setSavePromptDialogOpen] = React.useState(false)
  const [customPromptText, setCustomPromptText] = React.useState("")
  const [newPromptName, setNewPromptName] = React.useState("")
  const [newPromptText, setNewPromptText] = React.useState("")
  const [aiPreview, setAiPreview] = React.useState<null | {
    original: string
    result: string
    latencyMs: number
    approxTokensOut: number
    actionLabel: string
  }>(null)

  const { checkDocumentation, processWithAI, generateDraft, smartExpand, correctMedicalText, isProcessing } =
    useAIClinicalAssistant()
  const {
    transformText,
    isTransforming,
    customPrompts,
    addCustomPrompt,
    removeCustomPrompt,
  } = useTextTransform()
  const { stylePrompt, updateFromSample } = useWritingStyleProfile()

  const isLoading = isProcessing || isTransforming
  const [menuOpen, setMenuOpen] = React.useState(false)
  const hasSelection = React.useMemo(() => {
    if (!menuOpen) return false
    return Boolean(getSelectedText()?.trim())
  }, [menuOpen, getSelectedText])
  const selectionUnavailableReason = "Unavailable — select text in the note first"

  const applyPreviewInsert = React.useCallback(() => {
    if (!aiPreview) return
    replaceSelectedText(aiPreview.result)
    updateFromSample(aiPreview.result)
    toast.success("Inserted")
    setAiPreview(null)
  }, [aiPreview, replaceSelectedText, updateFromSample])

  const handleTransform = React.useCallback(
    async (type: TransformType, customPrompt?: string): Promise<boolean> => {
      const selectedText = getSelectedText()
      if (!selectedText) {
        toast.error("Please select some text first")
        return false
      }
      const combinedPrompt = customPrompt ? `${stylePrompt}\n\n${customPrompt}` : stylePrompt
      const result = await transformText(selectedText, type, combinedPrompt)
      if (result) {
        const label =
          type === "comma-list"
            ? "Comma list"
            : type === "medical-shorthand"
              ? "Medical shorthand"
              : "Custom transform"
        setAiPreview({
          original: selectedText,
          result: result.text,
          latencyMs: result.latencyMs,
          approxTokensOut: result.approxTokensOut,
          actionLabel: label,
        })
        setCustomDialogOpen(false)
        return true
      }
      return false
    },
    [getSelectedText, stylePrompt, transformText]
  )

  const handleSmartExpand = React.useCallback(async () => {
    const selectedText = getSelectedText()
    if (!selectedText) {
      toast.error("Please select some text first")
      return
    }
    const started = typeof performance !== "undefined" ? performance.now() : Date.now()
    const result = await smartExpand(selectedText)
    const latencyMs = Math.round((
      typeof performance !== "undefined" ? performance.now() : Date.now()
    ) - started)
    if (result) {
      setAiPreview({
        original: selectedText,
        result,
        latencyMs,
        approxTokensOut: Math.max(1, Math.ceil(result.length / 4)),
        actionLabel: "Smart expand",
      })
    }
  }, [getSelectedText, smartExpand])

  const handleMedicalCorrection = React.useCallback(async () => {
    const selectedText = getSelectedText()
    if (!selectedText) {
      toast.error("Please select some text first")
      return
    }
    const started = typeof performance !== "undefined" ? performance.now() : Date.now()
    const result = await correctMedicalText(selectedText)
    const latencyMs = Math.round((
      typeof performance !== "undefined" ? performance.now() : Date.now()
    ) - started)
    if (result) {
      setAiPreview({
        original: selectedText,
        result,
        latencyMs,
        approxTokensOut: Math.max(1, Math.ceil(result.length / 4)),
        actionLabel: "Medical correction",
      })
    }
  }, [getSelectedText, correctMedicalText])

  const handleDraftNote = React.useCallback(async () => {
    if (!patient || !onDraftNoteGenerated) return
    try {
      toast.info("AI is drafting your note...")
      const draft = await generateDraft(patient)
      if (draft) {
        onDraftNoteGenerated(draft)
        toast.success("Draft generated!")
      }
    } catch {
      toast.error("Drafting failed. Please try again.")
    }
  }, [patient, onDraftNoteGenerated, generateDraft])

  const handleSenseCheck = React.useCallback(async () => {
    const text = getDocumentText?.()?.trim()
    if (!text) {
      toast.error("Please enter some text to check.")
      return
    }
    try {
      toast.info("AI is sense-checking your note...")
      await processWithAI("documentation_check", { text })
      toast.success("Sense check complete")
    } catch {
      toast.error("Sense check failed. Please try again.")
    }
  }, [getDocumentText, processWithAI])

  const handleCustomPromptSubmit = React.useCallback(async () => {
    if (!customPromptText.trim()) {
      toast.error("Please enter a prompt")
      return
    }
    const ok = await handleTransform("custom", customPromptText)
    if (ok) setCustomPromptText("")
  }, [customPromptText, handleTransform])

  const handleSavePrompt = React.useCallback(() => {
    if (!newPromptName.trim() || !newPromptText.trim()) {
      toast.error("Please fill in both fields")
      return
    }
    addCustomPrompt(newPromptName.trim(), newPromptText.trim())
    setNewPromptName("")
    setNewPromptText("")
    setSavePromptDialogOpen(false)
  }, [newPromptName, newPromptText, addCustomPrompt])

  const handleSavedPromptClick = React.useCallback(
    (prompt: CustomPrompt) => {
      handleTransform("custom", prompt.prompt)
    },
    [handleTransform]
  )

  const showDocumentSection = (patient && onDraftNoteGenerated) || getDocumentText

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || isLoading}
            className={triggerClassName ?? "h-7 w-7 p-0"}
            title="AI writing tools: expand, correct, transform selection — results open in a preview before inserting"
            aria-label={isLoading ? "AI writing tools busy" : "AI writing tools"}
            aria-busy={isLoading || undefined}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>

        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
          {showDocumentSection && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Document</DropdownMenuLabel>
              {patient && onDraftNoteGenerated && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    void handleDraftNote()
                  }}
                  disabled={isLoading}
                >
                  <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                  Draft note
                </DropdownMenuItem>
              )}
              {getDocumentText && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    void handleSenseCheck()
                  }}
                  disabled={isLoading}
                >
                  <ShieldCheck className="h-4 w-4 mr-2 text-blue-500" />
                  Sense check
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel className="text-xs text-muted-foreground">Selection</DropdownMenuLabel>
          {!hasSelection && (
            <p className="px-2 pb-1 text-[11px] text-amber-700 dark:text-amber-400">
              {selectionUnavailableReason}
            </p>
          )}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              void handleSmartExpand()
            }}
            disabled={isLoading || !hasSelection}
            title={!hasSelection ? selectionUnavailableReason : undefined}
          >
            <Zap className="h-4 w-4 mr-2 text-yellow-500" />
            Smart expand
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              void handleMedicalCorrection()
            }}
            disabled={isLoading || !hasSelection}
            title={!hasSelection ? selectionUnavailableReason : undefined}
          >
            <FileText className="h-4 w-4 mr-2 text-blue-500" />
            Medical correct
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isLoading || !hasSelection}>
              Transform
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  void handleTransform("custom", "Make it sound more professional")
                }}
                disabled={isLoading || !hasSelection}
              >
                Make professional
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  void handleTransform("comma-list")
                }}
                disabled={isLoading || !hasSelection}
              >
                <List className="h-4 w-4 mr-2" />
                To comma list
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  void handleTransform("medical-shorthand")
                }}
                disabled={isLoading || !hasSelection}
              >
                <Stethoscope className="h-4 w-4 mr-2" />
                Medical shorthand
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setCustomPromptText("")
                  setCustomDialogOpen(true)
                }}
                disabled={isLoading || !hasSelection}
              >
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Custom prompt...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {customPrompts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Saved prompts</DropdownMenuLabel>
              <ScrollArea className="max-h-40">
                {customPrompts.map((prompt) => (
                  <DropdownMenuItem
                    key={prompt.id}
                    onSelect={(e) => {
                      e.preventDefault()
                      handleSavedPromptClick(prompt)
                    }}
                    disabled={isLoading}
                    className="flex items-center gap-1"
                  >
                    <span className="flex-1 truncate">{prompt.name}</span>
                    <button
                      type="button"
                      className="h-6 w-6 p-0 opacity-70 hover:opacity-100 rounded flex items-center justify-center"
                      onClick={(ev) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        removeCustomPrompt(prompt.id)
                      }}
                      aria-label={`Remove ${prompt.name}`}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setSavePromptDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Save custom prompt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Custom AI prompt
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enter instructions to transform the selected clinical text.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="e.g. Summarize in 2 sentences, Convert to bullet points"
              value={customPromptText}
              onChange={(e) => setCustomPromptText(e.target.value)}
              className="min-h-[100px]"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCustomPromptSubmit}
              disabled={isLoading || !customPromptText.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transforming...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Transform
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!aiPreview} onOpenChange={(open) => !open && setAiPreview(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Review AI result</DialogTitle>
            <DialogDescription className="sr-only">
              Review the generated note text before inserting it into the chart.
            </DialogDescription>
            <p className="text-xs text-muted-foreground">
              {aiPreview ? (
                <>
                  <span className="font-medium text-foreground">{aiPreview.actionLabel}</span>
                  {" · "}
                  ~{aiPreview.approxTokensOut} tokens (est.) · {aiPreview.latencyMs} ms
                </>
              ) : null}
            </p>
          </DialogHeader>
          <ScrollArea className="max-h-[45vh] rounded-md border border-border/60 bg-muted/20 p-3">
            <p className="text-sm whitespace-pre-wrap font-sans">{aiPreview?.result}</p>
          </ScrollArea>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none text-foreground/80">Original selection</summary>
            <p className="mt-2 whitespace-pre-wrap border-t border-border/40 pt-2">{aiPreview?.original}</p>
          </details>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setAiPreview(null)}>
              Discard
            </Button>
            <Button type="button" onClick={applyPreviewInsert}>
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={savePromptDialogOpen} onOpenChange={setSavePromptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Save custom prompt
            </DialogTitle>
            <DialogDescription className="sr-only">
              Save reusable AI instructions for future note transformations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt name</label>
              <Input
                placeholder="e.g. Summarize, Simplify"
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Instructions</label>
              <Textarea
                placeholder="e.g. Summarize this text in 2-3 sentences"
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSavePromptDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePrompt}
              disabled={!newPromptName.trim() || !newPromptText.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
