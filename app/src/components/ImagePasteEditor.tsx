import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, List, ImageIcon, Loader2, Maximize2, Highlighter,
  Indent, Outdent, Palette, Undo2, Redo2, FileText, ImagePlus, ClipboardList,
  Pencil, Eraser, Square, Circle, ArrowUpRight, Type, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link2, Minus,
  Superscript, Subscript, Search, Table as TableIcon, ListOrdered, X
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { AutoText } from "@/types/autotext";
import { defaultAutotexts, medicalDictionary } from "@/data/autotexts";
import { ImageLightbox } from "./ImageLightbox";
import { PatientInfoToolbar } from "./PatientInfoToolbar";
import { DictationButton } from "./DictationButton";
import { UnifiedAIDropdown } from "./UnifiedAIDropdown";
import { PhrasePicker, PhraseFormDialog } from "./phrases";
import { usePhraseExpansion } from "@/hooks/usePhraseExpansion";
import { useClinicalPhrases } from "@/hooks/useClinicalPhrases";
import { useEditorKeyboardShortcuts } from "@/hooks/useEditorKeyboardShortcuts";
import { EditorFindReplace } from "./EditorFindReplace";
import { EditorStatusBar } from "./EditorStatusBar";
import type { Patient } from "@/types/patient";
import { Slider } from "@/components/ui/slider";
import { createSafeLinkHtml, sanitizeHtml, sanitizePastedHtml } from "@/lib/sanitize";
import { getUserFacingErrorMessage, UserFacingError } from "@/lib/userFacingErrors";
import {
  PATIENT_IMAGE_KEY_ATTRIBUTE,
  PATIENT_IMAGE_SIGNED_URL_TTL_SECONDS,
  capturePatientImageReplacementTarget,
  canonicalizePatientImageHtml,
  createPatientImageSignedUrl,
  deletePatientImageObjects,
  extractLegacyPatientImageDataUrls,
  extractPatientImageObjectKeyList,
  isOwnedPatientImageObjectKey,
  prepareStoredPatientImageReplacement,
  removePatientImageAtIndex,
  replacePatientImageAtIndex,
  resolvePatientImageReplacementIndex,
  uploadPatientImage,
} from "@/lib/patientImages";

// Text color options using HSL CSS variables from design system
const textColors = [
  { name: "Default", value: "", cssVar: "" },
  { name: "Red", value: "hsl(0 72% 51%)", cssVar: "--destructive" },
  { name: "Orange", value: "hsl(38 80% 50%)", cssVar: "--warning" },
  { name: "Yellow", value: "hsl(45 93% 47%)", cssVar: "" },
  { name: "Green", value: "hsl(160 60% 40%)", cssVar: "--success" },
  { name: "Blue", value: "hsl(200 50% 50%)", cssVar: "--medical-blue" },
  { name: "Purple", value: "hsl(265 70% 55%)", cssVar: "" },
  { name: "Pink", value: "hsl(330 80% 60%)", cssVar: "" },
  { name: "Gray", value: "hsl(var(--muted-foreground))", cssVar: "--muted-foreground" },
];

const highlightColors = [
  { name: "None", value: "" },
  { name: "Yellow", value: "#fef08a" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Purple", value: "#e9d5ff" },
];

// Annotation color options using HSL values aligned with design system
const annotationColors = [
  { name: "Red", value: "hsl(0 72% 51%)" },
  { name: "Orange", value: "hsl(38 80% 50%)" },
  { name: "Yellow", value: "hsl(45 93% 47%)" },
  { name: "Green", value: "hsl(160 60% 40%)" },
  { name: "Blue", value: "hsl(200 50% 50%)" },
  { name: "Purple", value: "hsl(265 70% 55%)" },
  { name: "Dark", value: "hsl(180 12% 6%)" },
];

interface ImagePasteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  autotexts?: AutoText[];
  fontSize?: number;
  changeTracking?: {
    enabled: boolean;
    wrapWithMarkup: (text: string) => string;
    wrapHtmlWithMarkup?: (html: string) => string;
  } | null;
  patient?: Patient;
  section?: string;
}

// Apply underline formatting to text between # and :
const applyUnderlineFormatting = (html: string): string => {
  // Match #text: pattern but not inside HTML tags
  const regex = /#([^:#<>]+):/g;
  return html.replace(regex, '<u>#$1:</u>');
};

export const ImagePasteEditor = ({
  value,
  onChange,
  placeholder = "Enter text or paste images...",
  className,
  minHeight = "120px",
  autotexts = defaultAutotexts,
  fontSize = 14,
  changeTracking = null,
  patient,
  section
}: ImagePasteEditorProps) => {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isInternalUpdate = React.useRef(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const mountedRef = React.useRef(false);
  const activeOwnerIdRef = React.useRef<string | undefined>(user?.id);
  activeOwnerIdRef.current = user?.id;
  // Per-editor toggle: when true, marking is disabled for this editor
  const [localMarkingDisabled, setLocalMarkingDisabled] = React.useState(false);
  const [annotationOpen, setAnnotationOpen] = React.useState(false);
  const [annotationUrl, setAnnotationUrl] = React.useState<string | null>(null);
  const [annotationTool, setAnnotationTool] = React.useState<"pen" | "highlighter" | "arrow" | "rect" | "ellipse" | "text" | "eraser">("pen");
  const [annotationColor, setAnnotationColor] = React.useState("hsl(0 72% 51%)");
  const [annotationWidth, setAnnotationWidth] = React.useState(4);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDrawingRef = React.useRef(false);
  const startPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = React.useRef<ImageData | null>(null);
  const baseSnapshotRef = React.useRef<ImageData | null>(null);
  const historyRef = React.useRef<ImageData[]>([]);
  const redoRef = React.useRef<ImageData[]>([]);
  const [historySize, setHistorySize] = React.useState(0);
  const [redoSize, setRedoSize] = React.useState(0);
  const annotationOpenRef = React.useRef(annotationOpen);
  annotationOpenRef.current = annotationOpen;
  const annotationSessionRef = React.useRef(0);
  const annotationTargetRef = React.useRef<ReturnType<
    typeof capturePatientImageReplacementTarget
  >>(null);
  const annotationUploadSessionRef = React.useRef<number | null>(null);

  // ── Apple Pencil / stylus support ──────────────────────────────────────
  /** Tracks active pointer IDs and their types so we can reject touch while pen is active */
  const activePointersRef = React.useRef<Map<number, string>>(new Map());
  /** True when at least one pen pointer is down this annotation session */
  const penActiveRef = React.useRef(false);
  /** For the auto-hide "pen detected" indicator */
  const [penDetected, setPenDetected] = React.useState(false);
  const penIndicatorTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Previous canvas point for quadratic-curve stroke smoothing */
  const lastStrokePointRef = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (penIndicatorTimerRef.current) clearTimeout(penIndicatorTimerRef.current);
    };
  }, []);

  const isActiveImageOwner = React.useCallback(
    (ownerId: string) => mountedRef.current && activeOwnerIdRef.current === ownerId,
    [],
  );

  const discardUncommittedImage = React.useCallback(async (objectKey: string, ownerId: string) => {
    try {
      await deletePatientImageObjects([objectKey], ownerId);
    } catch {
      console.warn("Uncommitted patient image cleanup was deferred");
    }
  }, []);

  // Find & replace state
  const [findReplaceMode, setFindReplaceMode] = React.useState<"find" | "replace" | null>(null);
  // Table picker state
  const [showTablePicker, setShowTablePicker] = React.useState(false);
  const [tableHover, setTableHover] = React.useState({ rows: 0, cols: 0 });


  // Effective change tracking state - must be defined before any callbacks that use it
  const effectiveChangeTracking = localMarkingDisabled ? null : changeTracking;

  const emitCanonicalChange = React.useCallback((html: string): string => {
    const ownerId = user?.id;
    const canonicalHtml = canonicalizePatientImageHtml(html, ownerId, {
      // Existing versions stored canvas annotations inline. Preserve those
      // legacy values until they can be uploaded; all new annotations use keys.
      preserveLegacyDataImages: extractLegacyPatientImageDataUrls(html).length > 0,
    });

    isInternalUpdate.current = true;
    onChange(canonicalHtml);
    return canonicalHtml;
  }, [onChange, user?.id]);

  // Clinical phrase system
  const { folders } = useClinicalPhrases();

  // Insert phrase content handler
  const insertPhraseContent = React.useCallback((content: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;

    let contentHtml = content;
    if (effectiveChangeTracking?.enabled) {
      const safeContent = sanitizeHtml(content);
      contentHtml = effectiveChangeTracking.wrapHtmlWithMarkup?.(safeContent)
        ?? effectiveChangeTracking.wrapWithMarkup(content);
    }
    contentHtml = sanitizeHtml(contentHtml);

    if (range && editorRef.current.contains(range.startContainer)) {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml;
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      editorRef.current.innerHTML += contentHtml;
    }

    emitCanonicalChange(editorRef.current.innerHTML);
    editorRef.current.focus();
  }, [effectiveChangeTracking, emitCanonicalChange]);

  // Use phrase expansion hook
  const {
    phrases,
    selectedPhrase,
    phraseFields,
    showForm,
    handleFormInsert,
    handleLogUsage,
    closeForm,
    selectPhrase,
  } = usePhraseExpansion({
    patient,
    context: { section },
    onInsert: insertPhraseContent,
  });

  const legacyInlineImageCount = React.useMemo(
    () => extractLegacyPatientImageDataUrls(value).length,
    [value],
  );
  const canonicalValue = React.useMemo(
    () => canonicalizePatientImageHtml(value, user?.id, {
      preserveLegacyDataImages: legacyInlineImageCount > 0,
    }),
    [legacyInlineImageCount, user?.id, value],
  );
  const imageObjectKeys = React.useMemo(
    () => extractPatientImageObjectKeyList(canonicalValue, user?.id),
    [canonicalValue, user?.id],
  );
  const imageKeySignature = imageObjectKeys.join("\n");
  const [signedImageUrls, setSignedImageUrls] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!user || imageObjectKeys.length === 0) {
      setSignedImageUrls({});
      return;
    }

    let cancelled = false;
    const refreshSignedUrls = async () => {
      const uniqueKeys = Array.from(new Set(imageObjectKeys));
      const resolvedEntries = await Promise.all(
        uniqueKeys.map(async (objectKey) => {
          try {
            return [objectKey, await createPatientImageSignedUrl(objectKey, user.id)] as const;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setSignedImageUrls(Object.fromEntries(resolvedEntries.filter((entry) => entry !== null)));
      }
    };

    void refreshSignedUrls();
    const refreshTimer = window.setInterval(
      () => void refreshSignedUrls(),
      Math.floor(PATIENT_IMAGE_SIGNED_URL_TTL_SECONDS * 1000 * 0.75),
    );
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
    // imageKeySignature is the stable content identity for imageObjectKeys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKeySignature, user?.id]);

  const imageUrls = React.useMemo(
    () => imageObjectKeys.map((objectKey) => signedImageUrls[objectKey] ?? ""),
    [imageObjectKeys, signedImageUrls],
  );
  const hasImages = imageObjectKeys.length > 0;

  // Handle dictation transcript insertion
  const handleDictationTranscript = React.useCallback((text: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;

    // Create content with optional change tracking
    let contentHtml = text;
    if (effectiveChangeTracking?.enabled) {
      contentHtml = effectiveChangeTracking.wrapWithMarkup(text);
    }
    contentHtml = sanitizeHtml(contentHtml);

    if (range && editorRef.current.contains(range.startContainer)) {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml + ' ';
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      // Insert at end if no selection
      editorRef.current.innerHTML += ' ' + contentHtml + ' ';
    }

    emitCanonicalChange(editorRef.current.innerHTML);
    editorRef.current.focus();
  }, [effectiveChangeTracking, emitCanonicalChange]);

  const handleInsertPatientInfo = React.useCallback((text: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;

    let contentHtml = text;
    if (effectiveChangeTracking?.enabled) {
      contentHtml = effectiveChangeTracking.wrapWithMarkup(text);
    }
    contentHtml = sanitizeHtml(contentHtml);

    if (range && editorRef.current.contains(range.startContainer)) {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml + ' ';
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      editorRef.current.innerHTML += contentHtml + ' ';
    }

    emitCanonicalChange(editorRef.current.innerHTML);
    editorRef.current.focus();
  }, [effectiveChangeTracking, emitCanonicalChange]);

  const execCommand = React.useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      const sanitizedValue = sanitizeHtml(editorRef.current.innerHTML);
      if (sanitizedValue !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = sanitizedValue;
      }
      emitCanonicalChange(sanitizedValue);
    }
  }, [emitCanonicalChange]);

  // Insert link helper
  const handleInsertLink = React.useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection && !selection.isCollapsed ? selection.toString() : "";
    const url = window.prompt("Enter URL:", "https://");
    if (url) {
      const linkText = selectedText || window.prompt("Link text:", url) || url;
      const link = createSafeLinkHtml(url, linkText);
      if (link) {
        execCommand("insertHTML", link);
      }
    }
  }, [execCommand]);

  // Insert table helper
  const insertTable = React.useCallback((rows: number, cols: number) => {
    if (!editorRef.current) return;
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        if (r === 0) {
          html += '<th>&nbsp;</th>';
        } else {
          html += '<td>&nbsp;</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table><br>';
    execCommand("insertHTML", html);
    setShowTablePicker(false);
  }, [execCommand]);

  // Keyboard shortcut hook
  const { handleShortcut } = useEditorKeyboardShortcuts({
    execCommand,
    onFindReplace: (mode) => setFindReplaceMode(mode),
    onInsertLink: handleInsertLink,
  });

  // Use native event listener for beforeinput (more reliable than React's onBeforeInput)
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleBeforeInput = (e: InputEvent) => {
      if (!effectiveChangeTracking?.enabled || !e.data) return;

      // Handle insertText only - paste is handled separately
      if (e.inputType === 'insertText') {
        e.preventDefault();

        const markedHtml = sanitizeHtml(effectiveChangeTracking.wrapWithMarkup(e.data));
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const temp = document.createElement('div');
        temp.innerHTML = markedHtml;
        const fragment = document.createDocumentFragment();
        while (temp.firstChild) {
          fragment.appendChild(temp.firstChild);
        }
        range.insertNode(fragment);

        // Move cursor after inserted content
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);

        emitCanonicalChange(editor.innerHTML);
      }
    };

    editor.addEventListener('beforeinput', handleBeforeInput);
    return () => editor.removeEventListener('beforeinput', handleBeforeInput);
  }, [effectiveChangeTracking, emitCanonicalChange]);

  const handleInput = React.useCallback(() => {
    if (editorRef.current) {
      let html = sanitizeHtml(editorRef.current.innerHTML);
      if (html !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = html;
      }

      // Apply underline formatting for #text: pattern
      const formattedHtml = sanitizeHtml(applyUnderlineFormatting(html));
      if (formattedHtml !== html) {
        const selection = window.getSelection();

        editorRef.current.innerHTML = formattedHtml;
        html = formattedHtml;

        if (selection && editorRef.current.childNodes.length > 0) {
          const newRange = document.createRange();
          newRange.selectNodeContents(editorRef.current);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }

      emitCanonicalChange(html);
    }
  }, [emitCanonicalChange]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const requestOwnerId = user?.id;
    if (!requestOwnerId) {
      toast({
        title: "Not authenticated",
        description: "Please sign in to upload images.",
        variant: "destructive",
      });
      return null;
    }
    if (!isActiveImageOwner(requestOwnerId)) return null;

    try {
      setIsUploading(true);
      const objectKey = await uploadPatientImage(file, requestOwnerId);
      if (!isActiveImageOwner(requestOwnerId)) {
        await discardUncommittedImage(objectKey, requestOwnerId);
        return null;
      }
      return objectKey;
    } catch (error) {
      if (isActiveImageOwner(requestOwnerId)) {
        toast({
          title: "Upload failed",
          description: getUserFacingErrorMessage(error, "Failed to upload image. Please try again."),
          variant: "destructive",
        });
      }
      return null;
    } finally {
      if (isActiveImageOwner(requestOwnerId)) setIsUploading(false);
    }
  };

  const insertImage = (objectKey: string): boolean => {
    if (!editorRef.current || !user || !isOwnedPatientImageObjectKey(objectKey, user.id)) return false;

    const img = document.createElement('img');
    img.setAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE, objectKey);
    img.style.maxWidth = '100%';
    img.style.maxHeight = '200px';
    img.style.borderRadius = '4px';
    img.style.margin = '4px 0';
    img.className = 'inline-block';

    // Insert at cursor or at end
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editorRef.current.appendChild(img);
    }

    const canonicalHtml = emitCanonicalChange(editorRef.current.innerHTML);
    const inserted = extractPatientImageObjectKeyList(canonicalHtml, user.id).includes(objectKey);
    if (!inserted) img.remove();
    return inserted;
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const objectKey = await uploadImage(file);
        if (objectKey) {
          if (!insertImage(objectKey)) {
            await discardUncommittedImage(objectKey, objectKey.split("/", 1)[0]);
            continue;
          }
          toast({
            title: "Image uploaded",
            description: "Image has been added to the imaging field.",
          });
        }
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items || [];

    // Check for images first
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const objectKey = await uploadImage(file);
          if (objectKey) {
            if (!insertImage(objectKey)) {
              await discardUncommittedImage(objectKey, objectKey.split("/", 1)[0]);
              return;
            }
            toast({
              title: "Image uploaded",
              description: "Image has been added to the imaging field.",
            });
          }
        }
        return;
      }
    }

    // Intercept all text paste so rich clipboard markup is sanitized before it
    // reaches the contenteditable DOM.
    const html = e.clipboardData?.getData('text/html') || '';
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!html && !text) return;
    e.preventDefault();

    const safePastedHtml = sanitizePastedHtml(html, text);
    const contentHtml = effectiveChangeTracking?.enabled
      ? sanitizeHtml(effectiveChangeTracking.wrapHtmlWithMarkup?.(safePastedHtml)
        ?? effectiveChangeTracking.wrapWithMarkup(text))
      : safePastedHtml;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = contentHtml;
    const fragment = document.createDocumentFragment();
    while (temp.firstChild) {
      fragment.appendChild(temp.firstChild);
    }
    range.insertNode(fragment);

    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    if (editorRef.current) {
      emitCanonicalChange(sanitizeHtml(editorRef.current.innerHTML));
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;

    await handleUploadFiles(files);
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragActive(false);
  };

  const getCurrentWord = (): { word: string; range: Range | null } => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { word: "", range: null };

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return { word: "", range: null };

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return { word: "", range: null };

    const text = node.textContent || "";
    const offset = range.startOffset;

    let start = offset;
    while (start > 0 && /\S/.test(text[start - 1])) start--;

    const word = text.substring(start, offset);

    const wordRange = document.createRange();
    wordRange.setStart(node, start);
    wordRange.setEnd(node, offset);

    return { word, range: wordRange };
  };

  const replaceCurrentWord = (replacement: string) => {
    const { range } = getCurrentWord();
    if (!range) return;

    range.deleteContents();

    // Apply change tracking markup if enabled
    let content: Node;
    if (effectiveChangeTracking?.enabled) {
      const markedHtml = sanitizeHtml(effectiveChangeTracking.wrapWithMarkup(replacement));
      const temp = document.createElement('div');
      temp.innerHTML = markedHtml + " ";
      content = document.createDocumentFragment();
      while (temp.firstChild) {
        content.appendChild(temp.firstChild);
      }
    } else {
      content = document.createTextNode(replacement + " ");
    }

    range.insertNode(content);

    const selection = window.getSelection();
    if (selection) {
      const newRange = document.createRange();
      newRange.selectNodeContents(editorRef.current!);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    if (editorRef.current) {
      emitCanonicalChange(editorRef.current.innerHTML);
    }
  };



  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    // Check keyboard shortcuts first
    if (handleShortcut(e)) return;

    if (e.key === " " || e.key === "Tab") {
      const { word } = getCurrentWord();
      if (word) {
        const normalizedWord = word.toLowerCase();
        const autotext = autotexts.find(a => a.shortcut.toLowerCase() === normalizedWord);
        if (autotext) {
          e.preventDefault();
          replaceCurrentWord(autotext.expansion);
          return;
        }

        if (e.key === " ") {
          const corrected = medicalDictionary[word.toLowerCase()];
          if (corrected) {
            e.preventDefault();
            replaceCurrentWord(corrected);
            return;
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autotexts, handleShortcut]);

  const openLightbox = (index: number) => {
    if (!imageUrls[index]) return;
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const openAnnotator = (index: number) => {
    const currentHtml = editorRef.current?.innerHTML ?? canonicalValue;
    const target = user
      ? capturePatientImageReplacementTarget(currentHtml, index, user.id)
      : null;
    const targetUrl = target ? signedImageUrls[target.objectKey] : undefined;
    if (!target || !targetUrl) return;
    annotationSessionRef.current += 1;
    annotationTargetRef.current = target;
    annotationOpenRef.current = true;
    setAnnotationUrl(targetUrl);
    setAnnotationOpen(true);
  };

  const closeAnnotator = React.useCallback(() => {
    annotationSessionRef.current += 1;
    annotationTargetRef.current = null;
    annotationOpenRef.current = false;
    setAnnotationOpen(false);
  }, []);

  const handleRemoveImage = (index: number) => {
    const currentHtml = editorRef.current?.innerHTML ?? canonicalValue;
    const updated = removePatientImageAtIndex(currentHtml, index, user?.id);
    if (editorRef.current) editorRef.current.innerHTML = updated;
    emitCanonicalChange(updated);
    setLightboxOpen(false);
    toast({
      title: "Image removed",
      description: "The image was removed from the note.",
    });
  };

  const drawArrow = React.useCallback((context: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const headLength = Math.max(10, annotationWidth * 2);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.beginPath();
    context.moveTo(to.x, to.y);
    context.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
    context.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
    context.lineTo(to.x, to.y);
    context.fill();
  }, [annotationWidth]);

  const pushHistory = React.useCallback((context: CanvasRenderingContext2D) => {
    const snapshot = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    historyRef.current.push(snapshot);
    redoRef.current = [];
    setHistorySize(historyRef.current.length);
    setRedoSize(0);
  }, []);

  const loadAnnotationImage = React.useCallback((url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxWidth = 960;
      const maxHeight = 640;
      let width = img.naturalWidth || maxWidth;
      let height = img.naturalHeight || maxHeight;
      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(img, 0, 0, width, height);
      const snapshot = context.getImageData(0, 0, width, height);
      baseSnapshotRef.current = snapshot;
      historyRef.current = [snapshot];
      redoRef.current = [];
      setHistorySize(1);
      setRedoSize(0);
    };
    img.src = url;
  }, []);

  const restoreSnapshot = (snapshot: ImageData | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.putImageData(snapshot, 0, 0);
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    activePointersRef.current.set(event.pointerId, event.pointerType);

    const penDown = event.pointerType === "pen";
    if (penDown && !penActiveRef.current) {
      penActiveRef.current = true;
      setPenDetected(true);
      if (penIndicatorTimerRef.current) clearTimeout(penIndicatorTimerRef.current);
      penIndicatorTimerRef.current = setTimeout(() => setPenDetected(false), 2000);
    }

    if (event.pointerType === "touch" && penActiveRef.current) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);

    if (annotationTool === "text") {
      const text = window.prompt("Annotation text");
      if (text) {
        context.save();
        context.fillStyle = annotationColor;
        context.font = `${Math.max(14, annotationWidth * 4)}px ui-sans-serif`;
        context.fillText(text, point.x, point.y);
        context.restore();
        pushHistory(context);
      }
      return;
    }

    isDrawingRef.current = true;
    startPointRef.current = point;
    snapshotRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
    lastStrokePointRef.current = point;

    if (annotationTool === "pen" || annotationTool === "highlighter" || annotationTool === "eraser") {
      context.beginPath();
      context.moveTo(point.x, point.y);
    }
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    if (event.pointerType === "touch" && penActiveRef.current) {
      return;
    }

    const point = getCanvasPoint(event);
    const isPen = event.pointerType === "pen";
    const pressure = isPen ? Math.max(0.1, event.pressure) : 1;
    const tilt = isPen ? Math.sqrt(event.tiltX ** 2 + event.tiltY ** 2) : 0;

    if (annotationTool === "pen" || annotationTool === "highlighter" || annotationTool === "eraser") {
      context.save();
      if (annotationTool === "eraser") {
        context.globalCompositeOperation = "destination-out";
        context.strokeStyle = "rgba(0,0,0,1)";
        context.lineWidth = annotationWidth;
        context.globalAlpha = 1;
      } else if (annotationTool === "highlighter") {
        context.strokeStyle = annotationColor;
        context.lineWidth = annotationWidth;
        context.globalAlpha = 0.3;
      } else {
        context.strokeStyle = annotationColor;
        context.lineWidth = isPen ? annotationWidth * (0.3 + pressure * 0.7) : annotationWidth;
        context.globalAlpha = isPen && tilt > 0 ? Math.max(0.5, 1 - tilt / 45 * 0.5) : 1;
      }
      context.lineCap = "round";
      context.lineJoin = "round";

      const prev = lastStrokePointRef.current;
      if (prev) {
        const midX = (prev.x + point.x) / 2;
        const midY = (prev.y + point.y) / 2;
        context.moveTo(prev.x, prev.y);
        context.quadraticCurveTo(prev.x, prev.y, midX, midY);
      } else {
        context.moveTo(point.x, point.y);
        context.lineTo(point.x, point.y);
      }
      context.stroke();
      context.restore();

      lastStrokePointRef.current = point;
      return;
    }

    if (snapshotRef.current) {
      context.putImageData(snapshotRef.current, 0, 0);
    }
    context.save();
    context.strokeStyle = annotationColor;
    context.fillStyle = annotationColor;
    context.lineWidth = annotationWidth;
    context.globalAlpha = 1;
    const start = startPointRef.current;
    if (!start) return;

    if (annotationTool === "rect") {
      context.strokeRect(start.x, start.y, point.x - start.x, point.y - start.y);
    } else if (annotationTool === "ellipse") {
      const radiusX = Math.abs(point.x - start.x) / 2;
      const radiusY = Math.abs(point.y - start.y) / 2;
      const centerX = (point.x + start.x) / 2;
      const centerY = (point.y + start.y) / 2;
      context.beginPath();
      context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      context.stroke();
    } else if (annotationTool === "arrow") {
      drawArrow(context, start, point);
    }
    context.restore();
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const point = getCanvasPoint(event);
    const start = startPointRef.current;

    if (annotationTool === "rect" || annotationTool === "ellipse" || annotationTool === "arrow") {
      if (snapshotRef.current) {
        context.putImageData(snapshotRef.current, 0, 0);
      }
      context.save();
      context.strokeStyle = annotationColor;
      context.fillStyle = annotationColor;
      context.lineWidth = annotationWidth;
      if (start) {
        if (annotationTool === "rect") {
          context.strokeRect(start.x, start.y, point.x - start.x, point.y - start.y);
        } else if (annotationTool === "ellipse") {
          const radiusX = Math.abs(point.x - start.x) / 2;
          const radiusY = Math.abs(point.y - start.y) / 2;
          const centerX = (point.x + start.x) / 2;
          const centerY = (point.y + start.y) / 2;
          context.beginPath();
          context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          context.stroke();
        } else if (annotationTool === "arrow") {
          drawArrow(context, start, point);
        }
      }
      context.restore();
    }

    if (annotationTool !== "text") {
      pushHistory(context);
    }

    isDrawingRef.current = false;
    startPointRef.current = null;
    snapshotRef.current = null;
    lastStrokePointRef.current = null;

    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size === 0) {
      penActiveRef.current = false;
    }
  };

  const handleAnnotationUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context || historyRef.current.length <= 1) return;
    const last = historyRef.current.pop();
    if (last) {
      redoRef.current.push(last);
      const previous = historyRef.current[historyRef.current.length - 1];
      if (previous) {
        context.putImageData(previous, 0, 0);
      }
      setHistorySize(historyRef.current.length);
      setRedoSize(redoRef.current.length);
    }
  };

  const handleAnnotationRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context || redoRef.current.length === 0) return;
    const snapshot = redoRef.current.pop();
    if (snapshot) {
      context.putImageData(snapshot, 0, 0);
      historyRef.current.push(snapshot);
      setHistorySize(historyRef.current.length);
      setRedoSize(redoRef.current.length);
    }
  };

  const handleAnnotationClear = () => {
    if (!baseSnapshotRef.current) return;
    restoreSnapshot(baseSnapshotRef.current);
    historyRef.current = [baseSnapshotRef.current];
    redoRef.current = [];
    setHistorySize(1);
    setRedoSize(0);
  };

  const handleAnnotationSave = async () => {
    const canvas = canvasRef.current;
    const requestTarget = annotationTargetRef.current;
    if (!canvas || !requestTarget || !user || !editorRef.current) return;
    const requestOwnerId = user.id;
    const requestEditor = editorRef.current;
    const requestSession = annotationSessionRef.current;
    let uncommittedReplacementKey: string | null = null;
    const requestIsCurrent = () =>
      isActiveImageOwner(requestOwnerId) &&
      editorRef.current === requestEditor &&
      annotationOpenRef.current &&
      annotationSessionRef.current === requestSession;
    const discardReplacement = async () => {
      if (!uncommittedReplacementKey) return;
      const objectKey = uncommittedReplacementKey;
      uncommittedReplacementKey = null;
      await discardUncommittedImage(objectKey, requestOwnerId);
    };
    try {
      annotationUploadSessionRef.current = requestSession;
      setIsUploading(true);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("The annotation canvas could not be encoded."));
        }, "image/png");
      });
      if (!requestIsCurrent()) return;
      const currentHtml = canonicalizePatientImageHtml(
        requestEditor.innerHTML,
        requestOwnerId,
        {
          preserveLegacyDataImages:
            extractLegacyPatientImageDataUrls(requestEditor.innerHTML).length > 0,
        },
      );
      const currentIndex = resolvePatientImageReplacementIndex(
        currentHtml,
        requestTarget,
        requestOwnerId,
      );
      if (currentIndex === null) {
        throw new UserFacingError("The image changed before the annotation could be saved.");
      }
      const annotatedFile = new File([blob], "annotation.png", { type: "image/png" });
      const replacement = await prepareStoredPatientImageReplacement(
        currentHtml,
        currentIndex,
        annotatedFile,
        requestOwnerId,
      );
      uncommittedReplacementKey = replacement.replacementKey;
      if (!requestIsCurrent()) {
        await discardReplacement();
        return;
      }

      // Re-read editor content after upload. Text edits and remote updates made
      // while storage was pending must survive, and moved targets are resolved
      // by object identity instead of the stale thumbnail index.
      const latestHtml = canonicalizePatientImageHtml(
        requestEditor.innerHTML,
        requestOwnerId,
        {
          preserveLegacyDataImages:
            extractLegacyPatientImageDataUrls(requestEditor.innerHTML).length > 0,
        },
      );
      const latestIndex = resolvePatientImageReplacementIndex(
        latestHtml,
        requestTarget,
        requestOwnerId,
      );
      if (latestIndex === null) {
        await discardReplacement();
        throw new UserFacingError("The image changed before the annotation could be saved.");
      }
      const updatedHtml = replacePatientImageAtIndex(
        latestHtml,
        latestIndex,
        replacement.replacementKey,
        requestOwnerId,
      );
      if (
        extractPatientImageObjectKeyList(updatedHtml, requestOwnerId)[latestIndex] !==
          replacement.replacementKey
      ) {
        await discardReplacement();
        throw new UserFacingError("The annotated image could not be placed in the note.");
      }

      emitCanonicalChange(updatedHtml);
      requestEditor.innerHTML = updatedHtml;
      uncommittedReplacementKey = null;
      closeAnnotator();
      toast({
        title: "Annotation saved",
        description: "Image has been updated in the imaging section.",
      });
    } catch (error) {
      await discardReplacement();
      if (isActiveImageOwner(requestOwnerId)) {
        toast({
          title: "Annotation failed",
          description: getUserFacingErrorMessage(error, "Unable to save this annotation."),
          variant: "destructive",
        });
      }
    } finally {
      if (
        isActiveImageOwner(requestOwnerId) &&
        annotationUploadSessionRef.current === requestSession
      ) {
        annotationUploadSessionRef.current = null;
        setIsUploading(false);
      }
    }
  };

  React.useEffect(() => {
    if (annotationOpen && annotationUrl) {
      loadAnnotationImage(annotationUrl);
    }
  }, [annotationOpen, annotationUrl, loadAnnotationImage]);

  // Sync external value changes. The patient mutation layer owns object
  // deletion so storage cleanup happens only after the database update commits.
  React.useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    if (editorRef.current && editorRef.current.innerHTML !== canonicalValue) {
      const selection = window.getSelection();
      const hadFocus = document.activeElement === editorRef.current;

      editorRef.current.innerHTML = canonicalValue;

      if (hadFocus && selection && editorRef.current.childNodes.length > 0) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    // Transparently migrate legacy signed-URL references. The signed token is
    // removed before the next patient update reaches local or remote storage.
    const containsUnownedObjectKey = user
      ? extractPatientImageObjectKeyList(value).some(
        (objectKey) => !isOwnedPatientImageObjectKey(objectKey, user.id),
      )
      : true;
    if (!containsUnownedObjectKey && canonicalValue !== sanitizeHtml(value)) {
      isInternalUpdate.current = true;
      onChange(canonicalValue);
    }
  }, [canonicalValue, onChange, user, value]);

  // Refreshing a signed URL must not replace the contenteditable subtree or
  // disturb the user's selection. Mutate only the transient src attributes.
  React.useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current
      .querySelectorAll<HTMLImageElement>(`img[${PATIENT_IMAGE_KEY_ATTRIBUTE}]`)
      .forEach((image) => {
        const objectKey = image.getAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE);
        const signedUrl = objectKey ? signedImageUrls[objectKey] : undefined;
        if (signedUrl) image.setAttribute("src", signedUrl);
        else image.removeAttribute("src");
      });
  }, [canonicalValue, imageKeySignature, signedImageUrls]);

  return (
    <div
      className={cn(
        "border border-border/50 rounded-lg bg-card relative h-auto transition-colors shadow-card",
        isDragActive && "ring-2 ring-ring/40 bg-accent/20",
        className
      )}
    >
      <div className="border-b border-border/50 bg-muted/20">
        <PatientInfoToolbar
          onInsert={handleInsertPatientInfo}
          patient={patient}
        />
      </div>

      {/* Find & Replace Panel */}
      {findReplaceMode && (
        <EditorFindReplace
          editorRef={editorRef as React.RefObject<HTMLDivElement>}
          mode={findReplaceMode}
          onClose={() => setFindReplaceMode(null)}
          onChange={() => {
            if (editorRef.current) {
              emitCanonicalChange(editorRef.current.innerHTML);
            }
          }}
        />
      )}
      {/* Toolbar */}
      <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-1.5 p-2 border-b border-border/50 bg-muted/40 rounded-t-lg flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('undo')}
          title="Undo"
          className="h-7 w-7 p-0"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('redo')}
          title="Redo"
          className="h-7 w-7 p-0"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          title="Bold"
          className="h-7 w-7 p-0"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          title="Italic"
          className="h-7 w-7 p-0"
        >
          <Italic className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('strikeThrough')}
          title="Strikethrough"
          className="h-7 w-7 p-0"
        >
          <Strikethrough className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('superscript')}
          title="Superscript"
          className="h-7 w-7 p-0"
        >
          <Superscript className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('subscript')}
          title="Subscript"
          className="h-7 w-7 p-0"
        >
          <Subscript className="h-3 w-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />

        {/* Heading selector */}
        <select
          onChange={(e) => {
            const val = e.target.value;
            if (val === "p") {
              execCommand("formatBlock", "<p>");
            } else {
              execCommand("formatBlock", `<${val}>`);
            }
          }}
          defaultValue="p"
          className="h-7 px-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 w-20"
          title="Heading level"
        >
          <option value="p">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>
        <div className="w-px h-4 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          title="Bullet List"
          className="h-7 w-7 p-0"
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          title="Numbered List"
          className="h-7 w-7 p-0"
        >
          <ListOrdered className="h-3 w-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('outdent')}
          title="Decrease Indent"
          className="h-7 w-7 p-0"
        >
          <Outdent className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('indent')}
          title="Increase Indent"
          className="h-7 w-7 p-0"
        >
          <Indent className="h-3 w-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />

        {/* Alignment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyLeft')}
          title="Align Left"
          className="h-7 w-7 p-0"
        >
          <AlignLeft className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyCenter')}
          title="Align Center"
          className="h-7 w-7 p-0"
        >
          <AlignCenter className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyRight')}
          title="Align Right"
          className="h-7 w-7 p-0"
        >
          <AlignRight className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyFull')}
          title="Justify"
          className="h-7 w-7 p-0"
        >
          <AlignJustify className="h-3 w-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Text Color"
              className="h-7 w-7 p-0"
            >
              <Palette className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-3 gap-1">
              {textColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => {
                    if (color.value) {
                      execCommand('foreColor', color.value);
                    } else {
                      execCommand('removeFormat');
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors",
                    !color.value && "border border-dashed border-muted-foreground/30"
                  )}
                  title={color.name}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: color.value || 'transparent' }}
                  />
                  <span className="text-foreground">{color.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Highlight Color"
              className="h-7 w-7 p-0"
            >
              <Highlighter className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-4 gap-1">
              {highlightColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => {
                    if (color.value) {
                      execCommand('hiliteColor', color.value);
                    } else {
                      execCommand('hiliteColor', 'transparent');
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors",
                    !color.value && "border border-dashed border-muted-foreground/30"
                  )}
                  title={color.name}
                >
                  <span
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: color.value || 'transparent' }}
                  />
                  <span className="text-foreground">{color.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="w-px h-4 bg-border mx-1" />

        {/* Insert link */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleInsertLink}
          title="Insert Link (Ctrl+K)"
          className="h-7 w-7 p-0"
        >
          <Link2 className="h-3 w-3" />
        </Button>

        {/* Insert horizontal rule */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertHorizontalRule')}
          title="Horizontal Rule"
          className="h-7 w-7 p-0"
        >
          <Minus className="h-3 w-3" />
        </Button>

        {/* Insert table */}
        <Popover open={showTablePicker} onOpenChange={setShowTablePicker}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Insert Table"
              className="h-7 w-7 p-0"
            >
              <TableIcon className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="text-xs text-muted-foreground mb-1">
              {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : "Select size"}
            </div>
            <div className="grid grid-cols-6 gap-0.5">
              {Array.from({ length: 6 }, (_, r) =>
                Array.from({ length: 6 }, (_, c) => (
                  <button
                    key={`${r}-${c}`}
                    className={cn(
                      "w-4 h-4 border border-border rounded-[2px] transition-colors",
                      r < tableHover.rows && c < tableHover.cols
                        ? "bg-primary/30 border-primary/50"
                        : "bg-muted/30 hover:bg-muted/60"
                    )}
                    onMouseEnter={() => setTableHover({ rows: r + 1, cols: c + 1 })}
                    onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}
                    onClick={() => insertTable(r + 1, c + 1)}
                  />
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Find */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setFindReplaceMode(findReplaceMode ? null : "find")}
          title="Find & Replace (Ctrl+F)"
          className="h-7 w-7 p-0"
        >
          <Search className="h-3 w-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <div className="flex items-center gap-1 text-[10px] text-primary-foreground/70">
          <ImageIcon className="h-3 w-3" />
          <span>Paste or drop images</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-6 px-1.5 gap-1 text-[10px]"
          title="Upload images"
        >
          <ImagePlus className="h-3 w-3" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
        {hasImages && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openLightbox(0)}
            className="h-6 px-1.5 gap-1 text-[10px]"
            title="Open image gallery"
          >
            <Maximize2 className="h-3 w-3" />
            <span className="hidden sm:inline">Gallery</span>
          </Button>
        )}
        {section === 'imaging' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertPhraseContent('<div>• <strong>Study</strong>: </div>')}
            className="h-6 px-1.5 gap-1 text-[10px]"
            title="Insert imaging study template"
          >
            <ClipboardList className="h-3 w-3" />
            <span className="hidden sm:inline">Template</span>
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <UnifiedAIDropdown
            getSelectedText={() => {
              const selection = window.getSelection();
              if (!selection || selection.isCollapsed || !editorRef.current?.contains(selection.anchorNode)) {
                return null;
              }
              return selection.toString();
            }}
            replaceSelectedText={(newText) => {
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0 || !editorRef.current?.contains(selection.anchorNode)) {
                return;
              }
              const range = selection.getRangeAt(0);
              range.deleteContents();

              let content: Node;
              if (effectiveChangeTracking?.enabled) {
                const markedHtml = sanitizeHtml(effectiveChangeTracking.wrapWithMarkup(newText));
                const temp = document.createElement('div');
                temp.innerHTML = markedHtml;
                content = document.createDocumentFragment();
                while (temp.firstChild) {
                  content.appendChild(temp.firstChild);
                }
              } else {
                content = document.createTextNode(newText);
              }

              range.insertNode(content);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);

              emitCanonicalChange(editorRef.current!.innerHTML);
            }}
            getDocumentText={() => editorRef.current?.innerText ?? null}
            onDraftNoteGenerated={(draft) => {
              if (!editorRef.current) return;
              const isEmpty = editorRef.current.innerText.trim() === "";
              const separator = isEmpty ? "" : "<br/><br/>";
              const safeDraft = sanitizeHtml(draft);
              const sanitizedDraft = effectiveChangeTracking?.enabled
                ? sanitizeHtml(effectiveChangeTracking.wrapHtmlWithMarkup?.(safeDraft)
                  ?? effectiveChangeTracking.wrapWithMarkup(draft))
                : safeDraft;
              const newContent = sanitizeHtml(isEmpty
                ? sanitizedDraft
                : `${editorRef.current.innerHTML}${separator}${sanitizedDraft}`);
              editorRef.current.innerHTML = newContent;
              emitCanonicalChange(newContent);
            }}
            patient={patient}
            triggerClassName="h-7 w-7 p-0"
          />
          <DictationButton
            onTranscript={handleDictationTranscript}
            size="sm"
            className="h-6 w-6"
          />
          <PhrasePicker
            phrases={phrases}
            folders={folders}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Insert clinical phrase"
                className="h-6 px-1.5 gap-1"
              >
                <FileText className="h-3 w-3" />
                <span className="hidden sm:inline text-[10px]">Phrases</span>
              </Button>
            }
            onSelect={selectPhrase}
            context={{ section }}
          />
          {isUploading && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Uploading...</span>
              </div>
            </>
          )}
          {changeTracking?.enabled && !isUploading && (
            <Button
              type="button"
              variant={localMarkingDisabled ? "outline" : "ghost"}
              size="sm"
              onClick={() => setLocalMarkingDisabled(!localMarkingDisabled)}
              title={localMarkingDisabled ? "Enable marking" : "Disable marking"}
              className={cn(
                "h-6 px-1.5 gap-1",
                !localMarkingDisabled && "text-warning hover:text-warning/80",
                localMarkingDisabled && "text-muted-foreground"
              )}
            >
              <Highlighter className="h-3 w-3" />
              <span className="text-[10px]">{localMarkingDisabled ? "Off" : "On"}</span>
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleUploadFiles(event.target.files);
          if (event.target) {
            event.target.value = '';
          }
        }}
        aria-label="Upload images"
      />

      {/* Thumbnail Gallery */}
      {imageUrls.length > 0 && (
        <div className="p-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1 mb-1.5">
            <Maximize2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">
              {imageUrls.length} image{imageUrls.length > 1 ? 's' : ''} - Click to enlarge
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {imageUrls.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="relative group rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <button
                  type="button"
                  onClick={() => openLightbox(index)}
                  disabled={!url}
                  className="block w-16 h-16 disabled:cursor-wait"
                  aria-label={url ? `Open image ${index + 1}` : `Loading image ${index + 1}`}
                >
                  {url ? (
                    <img
                      src={url}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-16 h-16 object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                    <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
                {section === "imaging" && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openAnnotator(index);
                    }}
                    className="absolute left-1 top-1 rounded-full bg-white/90 p-1 text-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    title="Annotate image"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveImage(index);
                  }}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-destructive shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  title="Remove image"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <X className="h-3 w-3" />
                </button>
                <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-tl">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor with scroll container - relative positioning ensures proper document flow */}
      <div
        className="max-h-[300px] overflow-y-auto editor-scroll-container relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {isDragActive && (
          <div className="absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-accent/80 text-accent-foreground text-sm font-medium pointer-events-none">
            Drop images to upload
          </div>
        )}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={section ? `${section} notes` : placeholder}
          contentEditable
          className="p-3 rounded-b-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 prose prose-sm max-w-none min-h-[120px] relative text-foreground"
          style={{ fontSize: `${fontSize}px`, minHeight }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>

      <EditorStatusBar html={value} />

      {/* Lightbox */}
      <ImageLightbox
        images={imageUrls}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      <Dialog
        open={annotationOpen}
        onOpenChange={(open) => {
          if (!open) closeAnnotator();
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Annotate imaging</DialogTitle>
            <DialogDescription>
              Draw or type annotations on the selected image before inserting it into the note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: "pen", label: "Pen", icon: Pencil },
                  { id: "highlighter", label: "Highlighter", icon: Highlighter },
                  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
                  { id: "rect", label: "Rectangle", icon: Square },
                  { id: "ellipse", label: "Ellipse", icon: Circle },
                  { id: "text", label: "Text", icon: Type },
                  { id: "eraser", label: "Eraser", icon: Eraser },
                ].map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Button
                      key={tool.id}
                      type="button"
                      size="sm"
                      variant={annotationTool === tool.id ? "default" : "outline"}
                      className="h-8 px-2"
                      onClick={() => setAnnotationTool(tool.id as typeof annotationTool)}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">{tool.label}</span>
                    </Button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center gap-1">
                  {annotationColors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setAnnotationColor(color.value)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-shadow",
                        annotationColor === color.value ? "border-foreground shadow-sm" : "border-transparent"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 min-w-[200px]">
                <span className="text-xs text-muted-foreground">Stroke</span>
                <Slider
                  value={[annotationWidth]}
                  min={2}
                  max={16}
                  step={1}
                  className="w-32"
                  onValueChange={([value]) => setAnnotationWidth(value)}
                />
                <span className="text-xs font-medium w-6">{annotationWidth}px</span>
              </div>
              {penDetected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300 animate-in fade-in">
                  <Pencil className="h-3 w-3" />
                  Pen detected — touch rejected
                </span>
              )}
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleAnnotationUndo} disabled={historySize <= 1}>
                  Undo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleAnnotationRedo} disabled={redoSize === 0}>
                  Redo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleAnnotationClear}>
                  Reset
                </Button>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2 flex justify-center">
              <canvas
                ref={canvasRef}
                className="max-h-[65vh] w-full max-w-3xl rounded-lg border border-border bg-white touch-none"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerUp}
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={closeAnnotator}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAnnotationSave}>
              Save annotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phrase Form Dialog */}
      {selectedPhrase && (
        <PhraseFormDialog
          phrase={selectedPhrase}
          fields={phraseFields}
          patient={patient}
          open={showForm}
          onOpenChange={(open) => !open && closeForm()}
          onInsert={handleFormInsert}
          onLogUsage={handleLogUsage}
        />
      )}
    </div>
  );
};
