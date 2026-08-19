import { supabase } from "@/integrations/supabase/client";
import { sanitizePatientImageHtml } from "@/lib/sanitize";
import type { Patient } from "@/types/patient";

export const PATIENT_IMAGE_BUCKET = "patient-images";
export const PATIENT_IMAGE_KEY_ATTRIBUTE = "data-patient-image-key";
export const PATIENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PATIENT_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

const IMAGE_MIME_TO_EXTENSION = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const SAFE_OBJECT_KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const PATIENT_IMAGE_URL_PATTERN =
  /\/storage\/v1\/object\/(?:sign|public|authenticated)\/patient-images\/(.+)$/i;
const INLINE_IMAGE_DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i;

export interface CanonicalizePatientImageOptions {
  preserveLegacyDataImages?: boolean;
}

interface StorageError {
  message?: string;
}

interface PatientImageBucketClient {
  upload(
    path: string,
    file: Blob,
    options?: { cacheControl?: string; contentType?: string; upsert?: boolean },
  ): Promise<{ data: { path: string } | null; error: StorageError | null }>;
  createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<{ data: { signedUrl: string } | null; error: StorageError | null }>;
  remove(paths: string[]): Promise<{ data: unknown; error: StorageError | null }>;
}

export interface PatientImageStorageClient {
  from(bucket: string): PatientImageBucketClient;
}

export class PatientImageStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatientImageStorageError";
  }
}

const defaultStorage = (): PatientImageStorageClient =>
  supabase.storage as unknown as PatientImageStorageClient;

/**
 * Patient image keys are deliberately narrower than arbitrary Supabase object
 * names. This prevents traversal-like or ambiguous keys from reaching the
 * private bucket and keeps the owner id as the first path segment.
 */
export const normalizePatientImageObjectKey = (candidate: string): string | null => {
  const key = candidate.trim();
  if (!key || key.length > 1024 || key.includes("\\") || key.includes("\0")) return null;

  const segments = key.split("/");
  if (segments.length < 2 || segments.some((segment) => !SAFE_OBJECT_KEY_SEGMENT.test(segment))) {
    return null;
  }

  return segments.join("/");
};

export const isOwnedPatientImageObjectKey = (candidate: string, ownerId: string): boolean => {
  const key = normalizePatientImageObjectKey(candidate);
  return Boolean(key && ownerId && key.split("/", 1)[0] === ownerId);
};

export const patientImageObjectKeyFromUrl = (candidate: string): string | null => {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const match = url.pathname.match(PATIENT_IMAGE_URL_PATTERN);
  if (!match?.[1]) return null;

  try {
    return normalizePatientImageObjectKey(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
};

export const isPatientImageSignedUrlForObjectKey = (
  candidate: string,
  objectKey: string,
): boolean => {
  const normalizedKey = normalizePatientImageObjectKey(objectKey);
  if (!normalizedKey) return false;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  } catch {
    return false;
  }

  return patientImageObjectKeyFromUrl(candidate) === normalizedKey;
};

const objectKeyForImage = (image: HTMLImageElement): string | null => {
  const attributeKey = image.getAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE);
  const normalizedAttributeKey = attributeKey
    ? normalizePatientImageObjectKey(attributeKey)
    : null;
  if (normalizedAttributeKey) return normalizedAttributeKey;

  const source = image.getAttribute("src");
  return source ? patientImageObjectKeyFromUrl(source) : null;
};

const keyIsUsable = (key: string, ownerId?: string): boolean =>
  ownerId ? isOwnedPatientImageObjectKey(key, ownerId) : Boolean(normalizePatientImageObjectKey(key));

/**
 * Convert patient image markup to its persistence representation. Signed URLs,
 * their bearer tokens, and external images are never kept in the returned
 * HTML. The explicit legacy option is limited to preventing data loss while
 * older inline annotations await migration.
 */
export const canonicalizePatientImageHtml = (
  html: string,
  ownerId?: string,
  options: CanonicalizePatientImageOptions = {},
): string => {
  const template = document.createElement("template");
  template.innerHTML = sanitizePatientImageHtml(html);

  template.content.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const key = objectKeyForImage(image);
    if (!key || !keyIsUsable(key, ownerId)) {
      const source = image.getAttribute("src") ?? "";
      if (options.preserveLegacyDataImages && INLINE_IMAGE_DATA_URL_PATTERN.test(source)) return;
      image.remove();
      return;
    }

    image.setAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE, key);
    image.removeAttribute("src");
  });

  return sanitizePatientImageHtml(template.innerHTML);
};

export const extractLegacyPatientImageDataUrls = (html: string): string[] => {
  const template = document.createElement("template");
  template.innerHTML = sanitizePatientImageHtml(html);
  const sources = new Set<string>();
  template.content.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    const source = image.getAttribute("src") ?? "";
    if (INLINE_IMAGE_DATA_URL_PATTERN.test(source)) sources.add(source);
  });
  return Array.from(sources);
};

export const patientImageFileFromDataUrl = (dataUrl: string): File => {
  const match = dataUrl.match(INLINE_IMAGE_DATA_URL_PATTERN);
  if (!match?.[1] || !match[2]) {
    throw new PatientImageStorageError("The legacy inline image is not a supported image format.");
  }

  const encoded = match[2].replace(/\s/g, "");
  const estimatedBytes = Math.floor((encoded.length * 3) / 4);
  if (estimatedBytes > PATIENT_IMAGE_MAX_BYTES) {
    throw new PatientImageStorageError("Patient images must be 10 MB or smaller.");
  }

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    throw new PatientImageStorageError("The legacy inline image is corrupted.");
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  const mimeType = match[1].toLowerCase();
  const extension = IMAGE_MIME_TO_EXTENSION.get(mimeType);
  if (!extension) {
    throw new PatientImageStorageError("The legacy inline image is not a supported image format.");
  }
  return new File([bytes], `legacy-image.${extension}`, { type: mimeType });
};

export const replaceLegacyPatientImageDataUrl = (
  html: string,
  dataUrl: string,
  replacementKey: string,
  ownerId: string,
): string => {
  if (!isOwnedPatientImageObjectKey(replacementKey, ownerId)) {
    throw new PatientImageStorageError("Cannot migrate an inline image to an unowned object key.");
  }

  const template = document.createElement("template");
  template.innerHTML = sanitizePatientImageHtml(html);
  let replacementCount = 0;
  template.content.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    if (image.getAttribute("src") !== dataUrl) return;
    image.setAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE, replacementKey);
    image.removeAttribute("src");
    replacementCount += 1;
  });
  if (replacementCount === 0) {
    throw new PatientImageStorageError("The inline image being migrated is no longer available.");
  }

  return canonicalizePatientImageHtml(template.innerHTML, ownerId, {
    preserveLegacyDataImages: true,
  });
};

/**
 * Add short-lived URLs to a disposable HTML copy for rendering. Call
 * canonicalizePatientImageHtml before sending edited content back to storage.
 */
export const hydratePatientImageHtml = (
  html: string,
  signedUrls: ReadonlyMap<string, string>,
  ownerId?: string,
): string => {
  const template = document.createElement("template");
  template.innerHTML = canonicalizePatientImageHtml(html, ownerId, {
    preserveLegacyDataImages: extractLegacyPatientImageDataUrls(html).length > 0,
  });

  template.content.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const key = image.getAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE);
    const signedUrl = key ? signedUrls.get(key) : undefined;
    if (key && signedUrl && isPatientImageSignedUrlForObjectKey(signedUrl, key)) {
      image.setAttribute("src", signedUrl);
    }
  });

  return sanitizePatientImageHtml(template.innerHTML);
};

export const extractPatientImageObjectKeyList = (html: string, ownerId?: string): string[] => {
  const template = document.createElement("template");
  template.innerHTML = sanitizePatientImageHtml(html);
  const keys: string[] = [];

  template.content.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const key = objectKeyForImage(image);
    if (key && keyIsUsable(key, ownerId)) keys.push(key);
  });

  return keys;
};

export const extractPatientImageObjectKeys = (html: string, ownerId?: string): string[] =>
  Array.from(new Set(extractPatientImageObjectKeyList(html, ownerId)));

export interface PatientImageReplacementTarget {
  objectKey: string;
  originalIndex: number;
  originalMatchCount: number;
}

/**
 * Capture image identity before an asynchronous replacement starts. Unique
 * object keys can safely follow a reorder; duplicate keys stay index-bound
 * because identical references have no durable per-node identity.
 */
export const capturePatientImageReplacementTarget = (
  html: string,
  index: number,
  ownerId: string,
): PatientImageReplacementTarget | null => {
  const keys = extractPatientImageObjectKeyList(html, ownerId);
  const objectKey = keys[index];
  if (!objectKey) return null;
  return {
    objectKey,
    originalIndex: index,
    originalMatchCount: keys.filter((key) => key === objectKey).length,
  };
};

export const resolvePatientImageReplacementIndex = (
  html: string,
  target: PatientImageReplacementTarget,
  ownerId: string,
): number | null => {
  const keys = extractPatientImageObjectKeyList(html, ownerId);
  const matchingIndexes = keys.flatMap((key, index) =>
    key === target.objectKey ? [index] : []
  );
  if (matchingIndexes.length === 1 && target.originalMatchCount === 1) {
    return matchingIndexes[0];
  }
  if (
    matchingIndexes.length === target.originalMatchCount &&
    keys[target.originalIndex] === target.objectKey
  ) {
    return target.originalIndex;
  }
  return null;
};

export interface PatientImageObjectKeyDelta {
  added: string[];
  removed: string[];
}

export const diffPatientImageObjectKeys = (
  previousHtml: string,
  nextHtml: string,
  ownerId: string,
): PatientImageObjectKeyDelta => {
  const previousKeys = new Set(extractPatientImageObjectKeys(previousHtml, ownerId));
  const nextKeys = new Set(extractPatientImageObjectKeys(nextHtml, ownerId));
  return {
    added: Array.from(nextKeys).filter((key) => !previousKeys.has(key)),
    removed: Array.from(previousKeys).filter((key) => !nextKeys.has(key)),
  };
};

export const replacePatientImageAtIndex = (
  html: string,
  index: number,
  replacementKey: string,
  ownerId?: string,
): string => {
  const normalizedReplacement = normalizePatientImageObjectKey(replacementKey);
  if (!normalizedReplacement || !keyIsUsable(normalizedReplacement, ownerId)) {
    throw new PatientImageStorageError("Cannot replace an image with an invalid or unowned object key.");
  }

  const preserveLegacyDataImages = extractLegacyPatientImageDataUrls(html).length > 0;
  const template = document.createElement("template");
  template.innerHTML = canonicalizePatientImageHtml(html, ownerId, { preserveLegacyDataImages });
  const target = Array.from(template.content.querySelectorAll<HTMLImageElement>("img"))
    .filter((image) => objectKeyForImage(image))[index];
  if (!target) return template.innerHTML;

  target.setAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE, normalizedReplacement);
  target.removeAttribute("src");
  return canonicalizePatientImageHtml(template.innerHTML, ownerId, { preserveLegacyDataImages });
};

export const removePatientImageAtIndex = (
  html: string,
  index: number,
  ownerId?: string,
): string => {
  const preserveLegacyDataImages = extractLegacyPatientImageDataUrls(html).length > 0;
  const template = document.createElement("template");
  template.innerHTML = canonicalizePatientImageHtml(html, ownerId, { preserveLegacyDataImages });
  Array.from(template.content.querySelectorAll<HTMLImageElement>("img"))
    .filter((image) => objectKeyForImage(image))[index]
    ?.remove();
  return canonicalizePatientImageHtml(template.innerHTML, ownerId, { preserveLegacyDataImages });
};

export const validatePatientImageFile = (file: File): string => {
  const extension = IMAGE_MIME_TO_EXTENSION.get(file.type.toLowerCase());
  if (!extension) {
    throw new PatientImageStorageError("Patient images must be PNG, JPEG, WebP, or GIF files.");
  }
  if (file.size <= 0) {
    throw new PatientImageStorageError("Patient image files cannot be empty.");
  }
  if (file.size > PATIENT_IMAGE_MAX_BYTES) {
    throw new PatientImageStorageError("Patient images must be 10 MB or smaller.");
  }
  return extension;
};

export const uploadPatientImage = async (
  file: File,
  ownerId: string,
  storage: PatientImageStorageClient = defaultStorage(),
): Promise<string> => {
  if (!SAFE_OBJECT_KEY_SEGMENT.test(ownerId)) {
    throw new PatientImageStorageError("A signed-in owner is required to upload patient images.");
  }
  const extension = validatePatientImageFile(file);
  const objectKey = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await storage.from(PATIENT_IMAGE_BUCKET).upload(objectKey, file, {
    cacheControl: "3600",
    contentType: file.type.toLowerCase(),
    upsert: false,
  });

  if (error || data?.path !== objectKey) {
    throw new PatientImageStorageError("Unable to upload the patient image.");
  }
  return objectKey;
};

export const createPatientImageSignedUrl = async (
  objectKey: string,
  ownerId: string,
  storage: PatientImageStorageClient = defaultStorage(),
): Promise<string> => {
  if (!isOwnedPatientImageObjectKey(objectKey, ownerId)) {
    throw new PatientImageStorageError("Cannot sign an unowned patient image object.");
  }

  const { data, error } = await storage
    .from(PATIENT_IMAGE_BUCKET)
    .createSignedUrl(objectKey, PATIENT_IMAGE_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new PatientImageStorageError("Unable to display the patient image.");
  }
  if (!isPatientImageSignedUrlForObjectKey(data.signedUrl, objectKey)) {
    throw new PatientImageStorageError("The patient image URL did not match the requested object.");
  }
  return data.signedUrl;
};

export interface PatientImageSignedUrlLoadResult {
  signedUrls: Map<string, string>;
  unavailableCount: number;
}

/**
 * Re-sign the canonical image keys referenced by a disposable patient view.
 * The returned URLs stay separate from patient HTML so callers cannot
 * accidentally persist bearer tokens when saving or exporting patient data.
 */
export const loadPatientImageSignedUrls = async (
  patients: Iterable<Pick<Patient, "imaging">>,
  ownerId: string,
  storage: PatientImageStorageClient = defaultStorage(),
): Promise<PatientImageSignedUrlLoadResult> => {
  const keys = new Set<string>();
  for (const patient of patients) {
    extractPatientImageObjectKeys(patient.imaging, ownerId).forEach((key) => keys.add(key));
  }

  const signedUrls = new Map<string, string>();
  let unavailableCount = 0;
  await Promise.all(
    Array.from(keys).map(async (key) => {
      try {
        signedUrls.set(key, await createPatientImageSignedUrl(key, ownerId, storage));
      } catch {
        unavailableCount += 1;
      }
    }),
  );

  return { signedUrls, unavailableCount };
};

export const resolveOwnedPatientImageSignedUrl = (
  objectKey: string | null,
  signedUrls: ReadonlyMap<string, string> | undefined,
  ownerId: string | undefined,
): string | null => {
  if (!objectKey || !ownerId || !isOwnedPatientImageObjectKey(objectKey, ownerId)) return null;
  const signedUrl = signedUrls?.get(objectKey);
  return signedUrl && isPatientImageSignedUrlForObjectKey(signedUrl, objectKey)
    ? signedUrl
    : null;
};

export const deletePatientImageObjects = async (
  objectKeys: Iterable<string>,
  ownerId: string,
  storage: PatientImageStorageClient = defaultStorage(),
): Promise<string[]> => {
  const ownedKeys = Array.from(
    new Set(Array.from(objectKeys).filter((key) => isOwnedPatientImageObjectKey(key, ownerId))),
  );
  if (ownedKeys.length === 0) return [];

  const { error } = await storage.from(PATIENT_IMAGE_BUCKET).remove(ownedKeys);
  if (error) throw new PatientImageStorageError("Unable to remove one or more patient images.");
  return ownedKeys;
};

export interface PatientImageReplacementResult {
  html: string;
  replacementKey: string;
  supersededKey: string;
}

/**
 * Prepare an annotation replacement without deleting the superseded object.
 * The patient mutation layer owns deletion and must do it only after the
 * canonical HTML update commits successfully.
 */
export const prepareStoredPatientImageReplacement = async (
  html: string,
  index: number,
  replacementFile: File,
  ownerId: string,
  storage: PatientImageStorageClient = defaultStorage(),
): Promise<PatientImageReplacementResult> => {
  const canonicalHtml = canonicalizePatientImageHtml(html, ownerId, {
    preserveLegacyDataImages: extractLegacyPatientImageDataUrls(html).length > 0,
  });
  const previousKey = extractPatientImageObjectKeyList(canonicalHtml, ownerId)[index];
  if (!previousKey) {
    throw new PatientImageStorageError("The image being replaced is no longer available.");
  }

  const replacementKey = await uploadPatientImage(replacementFile, ownerId, storage);
  try {
    const updatedHtml = replacePatientImageAtIndex(canonicalHtml, index, replacementKey, ownerId);
    if (extractPatientImageObjectKeyList(updatedHtml, ownerId)[index] !== replacementKey) {
      throw new PatientImageStorageError("The replacement image could not be placed in the note.");
    }
    return {
      html: updatedHtml,
      replacementKey,
      supersededKey: previousKey,
    };
  } catch (error) {
    try {
      await deletePatientImageObjects([replacementKey], ownerId, storage);
    } catch {
      // Preserve the original replacement failure. Bucket lifecycle monitoring
      // can identify this unreferenced upload for later cleanup.
    }
    throw error;
  }
};

/**
 * Integration point for patient deletion. The mutation owner must call this
 * only after the database row is deleted successfully and pass the remaining
 * patient snapshots. Shared image objects (for example, from a duplicated
 * patient) are retained while any remaining patient still references them.
 */
export const cleanupPatientImagesForPatient = (
  patient: Pick<Patient, "imaging">,
  remainingPatients: Iterable<Pick<Patient, "imaging">>,
  ownerId: string,
  storage: PatientImageStorageClient = defaultStorage(),
): Promise<string[]> => {
  const stillReferenced = new Set<string>();
  for (const remainingPatient of remainingPatients) {
    extractPatientImageObjectKeys(remainingPatient.imaging, ownerId).forEach((key) => {
      stillReferenced.add(key);
    });
  }
  const unreferencedKeys = extractPatientImageObjectKeys(patient.imaging, ownerId)
    .filter((key) => !stillReferenced.has(key));
  return deletePatientImageObjects(unreferencedKeys, ownerId, storage);
};
