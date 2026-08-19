export const MAX_TEXT_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_DOCX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCX_EXPANDED_BYTES = 50 * 1024 * 1024;
export const MAX_DOCX_ARCHIVE_ENTRIES = 2_000;
export const MAX_IMPORTED_DOCUMENT_BYTES = 4 * 1024 * 1024;

const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;
const MIN_CENTRAL_DIRECTORY_ENTRY_BYTES = 46;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const MAX_ZIP_COMMENT_BYTES = 0xffff;
const textEncoder = new TextEncoder();

function findEndOfCentralDirectory(view: DataView): number {
  const earliestOffset = Math.max(
    0,
    view.byteLength - END_OF_CENTRAL_DIRECTORY_BYTES - MAX_ZIP_COMMENT_BYTES,
  );

  for (
    let offset = view.byteLength - END_OF_CENTRAL_DIRECTORY_BYTES;
    offset >= earliestOffset;
    offset -= 1
  ) {
    if (
      view.getUint32(offset, true) ===
        ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return offset;
    }
  }

  return -1;
}

export function validateDocumentImportFile(
  fileName: string,
  fileBytes: number,
): string | null {
  const normalizedName = fileName.toLowerCase();
  const maxBytes = normalizedName.endsWith(".txt")
    ? MAX_TEXT_IMPORT_BYTES
    : normalizedName.endsWith(".docx")
    ? MAX_DOCX_FILE_BYTES
    : null;

  if (maxBytes === null) {
    return "Unsupported file type. Please use .txt or .docx";
  }
  if (!Number.isSafeInteger(fileBytes) || fileBytes < 0) {
    return "The selected document has an invalid size";
  }
  if (fileBytes > maxBytes) {
    return "The selected document is too large to import safely";
  }
  return null;
}

/**
 * Inspect DOCX ZIP metadata before decompression so a tiny compressed file
 * cannot expand past the application's memory budget.
 */
export function validateDocxArchive(arrayBuffer: ArrayBuffer): string | null {
  if (arrayBuffer.byteLength < END_OF_CENTRAL_DIRECTORY_BYTES) {
    return "The selected Word document is invalid";
  }

  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    return "The selected Word document is invalid";
  }

  const commentBytes = view.getUint16(eocdOffset + 20, true);
  if (
    eocdOffset + END_OF_CENTRAL_DIRECTORY_BYTES + commentBytes !==
      view.byteLength
  ) {
    return "The selected Word document is invalid";
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const diskEntryCount = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryBytes = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    diskEntryCount !== entryCount ||
    entryCount === 0 ||
    entryCount === ZIP64_SENTINEL_16 ||
    centralDirectoryBytes === ZIP64_SENTINEL_32 ||
    centralDirectoryOffset === ZIP64_SENTINEL_32
  ) {
    return "The selected Word document uses an unsupported archive format";
  }
  if (entryCount > MAX_DOCX_ARCHIVE_ENTRIES) {
    return "The selected Word document contains too many archive entries";
  }

  const centralDirectoryEnd =
    centralDirectoryOffset + centralDirectoryBytes;
  if (
    centralDirectoryEnd > eocdOffset ||
    centralDirectoryOffset > view.byteLength
  ) {
    return "The selected Word document is invalid";
  }

  let entryOffset = centralDirectoryOffset;
  let totalExpandedBytes = 0;
  let totalCompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      entryOffset + MIN_CENTRAL_DIRECTORY_ENTRY_BYTES > centralDirectoryEnd ||
      view.getUint32(entryOffset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return "The selected Word document is invalid";
    }

    const flags = view.getUint16(entryOffset + 8, true);
    const compressionMethod = view.getUint16(entryOffset + 10, true);
    const compressedBytes = view.getUint32(entryOffset + 20, true);
    const expandedBytes = view.getUint32(entryOffset + 24, true);
    const fileNameBytes = view.getUint16(entryOffset + 28, true);
    const extraFieldBytes = view.getUint16(entryOffset + 30, true);
    const entryCommentBytes = view.getUint16(entryOffset + 32, true);
    const entryDisk = view.getUint16(entryOffset + 34, true);

    if (
      (flags & 0x1) !== 0 ||
      (compressionMethod !== 0 && compressionMethod !== 8) ||
      compressedBytes === ZIP64_SENTINEL_32 ||
      expandedBytes === ZIP64_SENTINEL_32 ||
      entryDisk !== 0
    ) {
      return "The selected Word document uses an unsupported archive format";
    }

    totalCompressedBytes += compressedBytes;
    totalExpandedBytes += expandedBytes;
    if (totalCompressedBytes > arrayBuffer.byteLength) {
      return "The selected Word document is invalid";
    }
    if (totalExpandedBytes > MAX_DOCX_EXPANDED_BYTES) {
      return "The selected Word document exceeds the expanded size limit";
    }

    entryOffset +=
      MIN_CENTRAL_DIRECTORY_ENTRY_BYTES +
      fileNameBytes +
      extraFieldBytes +
      entryCommentBytes;
  }

  if (entryOffset !== centralDirectoryEnd) {
    return "The selected Word document is invalid";
  }

  return null;
}

export function validateImportedDocumentContent(content: string): string | null {
  if (textEncoder.encode(content).byteLength > MAX_IMPORTED_DOCUMENT_BYTES) {
    return "The document contains too much content to import safely";
  }
  return null;
}
