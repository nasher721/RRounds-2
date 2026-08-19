/** PDF extraction interfaces retained for a future reviewed same-origin build. */

type PdfJsTextItem = { str?: string };

type PdfJsTextContent = {
    items: PdfJsTextItem[];
};

type PdfJsPage = {
    getTextContent: () => Promise<PdfJsTextContent>;
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

type PdfJsDocument = {
    numPages: number;
    getPage: (pageNum: number) => Promise<PdfJsPage>;
};

type PdfJsLib = {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PdfJsDocument> };
};

// Clinical documents must never be handed to third-party executable CDN code.
// Re-enable only after a reviewed PDF.js build and worker are bundled same-origin.
export const loadPdfJs = async (): Promise<PdfJsLib> => {
    throw new Error(
        'PDF import is unavailable until the PDF processor is bundled securely. Use a text or Word document instead.'
    );
};

export const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map((item) => item.str ?? '')
            .join(" ");

        fullText += pageText + "\n\n--- Page Break ---\n\n";
    }

    return fullText;
};

export const OCR_HARD_PAGE_LIMIT = 20;

// Convert PDF pages to base64 images for OCR
export const extractPdfAsImages = async (
    file: File,
    scale: number = 2.0,
    maxPages: number = 10
): Promise<string[]> => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const images: string[] = [];

    const safePageLimit = Math.max(1, Math.min(maxPages, OCR_HARD_PAGE_LIMIT));

    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, safePageLimit); pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Convert to base64 JPEG (smaller than PNG)
        const imageData = canvas.toDataURL('image/jpeg', 0.85);
        images.push(imageData);
    }

    return images;
};
