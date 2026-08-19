import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PATIENT_IMAGE_KEY_ATTRIBUTE,
  capturePatientImageReplacementTarget,
  canonicalizePatientImageHtml,
  cleanupPatientImagesForPatient,
  createPatientImageSignedUrl,
  deletePatientImageObjects,
  diffPatientImageObjectKeys,
  extractLegacyPatientImageDataUrls,
  extractPatientImageObjectKeyList,
  extractPatientImageObjectKeys,
  hydratePatientImageHtml,
  loadPatientImageSignedUrls,
  patientImageFileFromDataUrl,
  prepareStoredPatientImageReplacement,
  resolveOwnedPatientImageSignedUrl,
  removePatientImageAtIndex,
  resolvePatientImageReplacementIndex,
  replacePatientImageAtIndex,
  replaceLegacyPatientImageDataUrl,
  uploadPatientImage,
} from "@/lib/patientImages";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER_ID = "22222222-2222-4222-8222-222222222222";
const OBJECT_KEY = `${OWNER_ID}/scan.png`;

type StorageCall =
  | { operation: "upload"; path: string; contentType?: string }
  | { operation: "sign"; path: string; expiresIn: number }
  | { operation: "remove"; paths: string[] };

const createStorage = (calls: StorageCall[]) => ({
  from(bucket: string) {
    assert.equal(bucket, "patient-images");
    return {
      async upload(path: string, file: Blob, options?: { contentType?: string }) {
        calls.push({ operation: "upload", path, contentType: options?.contentType });
        return { data: { path }, error: null };
      },
      async createSignedUrl(path: string, expiresIn: number) {
        calls.push({ operation: "sign", path, expiresIn });
        return {
          data: { signedUrl: `https://project.supabase.co/storage/v1/object/sign/patient-images/${path}?token=secret` },
          error: null,
        };
      },
      async remove(paths: string[]) {
        calls.push({ operation: "remove", paths });
        return { data: paths.map((name) => ({ name })), error: null };
      },
    };
  },
});

describe("patient image canonical references", () => {
  it("converts expiring signed URLs to owner-scoped object keys without persisting tokens", () => {
    const signedUrl =
      `https://project.supabase.co/storage/v1/object/sign/patient-images/${OBJECT_KEY}` +
      "?token=top-secret&expires=123";

    const canonical = canonicalizePatientImageHtml(
      `<p>CT head</p><img src="${signedUrl}" alt="CT head">`,
      OWNER_ID,
    );

    assert.match(canonical, new RegExp(`${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}"`));
    assert.doesNotMatch(canonical, /token=|top-secret|storage\/v1\/object\/sign/i);
    assert.doesNotMatch(canonical, /<img[^>]+\ssrc=/i);
    assert.deepEqual(extractPatientImageObjectKeys(canonical, OWNER_ID), [OBJECT_KEY]);
  });

  it("hydrates a canonical key only for display and strips the signed URL again before persistence", () => {
    const canonical = `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}" alt="CT">`;
    const signedUrl = `https://project.supabase.co/storage/v1/object/sign/patient-images/${OBJECT_KEY}?token=short-lived`;
    const hydrated = hydratePatientImageHtml(canonical, new Map([[OBJECT_KEY, signedUrl]]), OWNER_ID);

    assert.match(hydrated, /src="https:\/\/project\.supabase\.co\//);
    assert.match(hydrated, new RegExp(`${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}"`));
    assert.equal(canonicalizePatientImageHtml(hydrated, OWNER_ID), canonical);
  });

  it("drops external, malformed, and cross-owner image references", () => {
    const canonical = canonicalizePatientImageHtml(
      [
        '<img src="https://tracker.example/pixel.png">',
        `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="../escape.png">`,
        `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OTHER_OWNER_ID}/scan.png">`,
      ].join(""),
      OWNER_ID,
    );

    assert.doesNotMatch(canonical, /<img/i);
  });

  it("replaces an image key without retaining the superseded signed URL", () => {
    const nextKey = `${OWNER_ID}/annotation.png`;
    const current = canonicalizePatientImageHtml(
      `<img src="https://project.supabase.co/storage/v1/object/sign/patient-images/${OBJECT_KEY}?token=old">`,
      OWNER_ID,
    );

    const replaced = replacePatientImageAtIndex(current, 0, nextKey, OWNER_ID);

    assert.deepEqual(extractPatientImageObjectKeys(replaced, OWNER_ID), [nextKey]);
    assert.doesNotMatch(replaced, /token=|\ssrc=/i);
  });

  it("resolves an annotation against latest content without trusting a stale index", () => {
    const secondKey = `${OWNER_ID}/second.png`;
    const replacementKey = `${OWNER_ID}/annotated.png`;
    const openedHtml =
      `<p>Original text</p><img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">` +
      `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${secondKey}">`;
    const target = capturePatientImageReplacementTarget(openedHtml, 0, OWNER_ID);
    assert.ok(target);

    const latestHtml =
      `<p>New remote text</p><img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${secondKey}">` +
      `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">`;
    const latestIndex = resolvePatientImageReplacementIndex(latestHtml, target, OWNER_ID);
    assert.equal(latestIndex, 1);

    const replaced = replacePatientImageAtIndex(
      latestHtml,
      latestIndex,
      replacementKey,
      OWNER_ID,
    );
    assert.match(replaced, /New remote text/);
    assert.deepEqual(extractPatientImageObjectKeyList(replaced, OWNER_ID), [
      secondKey,
      replacementKey,
    ]);
  });

  it("abandons an annotation when target identity becomes ambiguous", () => {
    const openedHtml = `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">`;
    const target = capturePatientImageReplacementTarget(openedHtml, 0, OWNER_ID);
    assert.ok(target);

    assert.equal(
      resolvePatientImageReplacementIndex("<p>Image removed</p>", target, OWNER_ID),
      null,
    );
    assert.equal(
      resolvePatientImageReplacementIndex(
        `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">` +
          `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">`,
        target,
        OWNER_ID,
      ),
      null,
    );
  });

  it("computes mutation cleanup deltas without deleting a still-referenced duplicate", () => {
    const retainedKey = `${OWNER_ID}/retained.jpg`;
    const addedKey = `${OWNER_ID}/added.webp`;
    const previous =
      `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">` +
      `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">` +
      `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${retainedKey}">`;
    const next =
      `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${retainedKey}">` +
      `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${addedKey}">`;

    assert.deepEqual(diffPatientImageObjectKeys(previous, next, OWNER_ID), {
      added: [addedKey],
      removed: [OBJECT_KEY],
    });
  });

  it("can migrate a legacy inline annotation without dropping it before upload", () => {
    const dataUrl = "data:image/png;base64,AQID";
    const legacyHtml = `<p>Annotated scan</p><img src="${dataUrl}" alt="annotation">`;

    assert.deepEqual(extractLegacyPatientImageDataUrls(legacyHtml), [dataUrl]);
    assert.match(
      canonicalizePatientImageHtml(legacyHtml, OWNER_ID, { preserveLegacyDataImages: true }),
      /data:image\/png;base64,AQID/,
    );
    assert.doesNotMatch(canonicalizePatientImageHtml(legacyHtml, OWNER_ID), /<img/i);
    const file = patientImageFileFromDataUrl(dataUrl);
    assert.equal(file.type, "image/png");
    assert.equal(file.size, 3);

    const migrated = replaceLegacyPatientImageDataUrl(legacyHtml, dataUrl, OBJECT_KEY, OWNER_ID);
    assert.deepEqual(extractPatientImageObjectKeys(migrated, OWNER_ID), [OBJECT_KEY]);
    assert.doesNotMatch(migrated, /data:image|base64|\ssrc=/i);

    const mixed = `${legacyHtml}<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">`;
    const replacementKey = `${OWNER_ID}/replacement.png`;
    const replacedObject = replacePatientImageAtIndex(mixed, 0, replacementKey, OWNER_ID);
    assert.match(replacedObject, /data:image\/png;base64,AQID/);
    assert.deepEqual(extractPatientImageObjectKeys(replacedObject, OWNER_ID), [replacementKey]);
    const removedObject = removePatientImageAtIndex(mixed, 0, OWNER_ID);
    assert.match(removedObject, /data:image\/png;base64,AQID/);
    assert.deepEqual(extractPatientImageObjectKeys(removedObject, OWNER_ID), []);
  });
});

describe("patient image storage lifecycle", () => {
  it("uploads an allowed image to a generated owner path and returns only the object key", async () => {
    const calls: StorageCall[] = [];
    const storage = createStorage(calls);
    const file = new File([new Uint8Array([1, 2, 3])], "scan.png", { type: "image/png" });

    const objectKey = await uploadPatientImage(file, OWNER_ID, storage);

    assert.match(objectKey, new RegExp(`^${OWNER_ID}/[0-9a-f-]+\\.png$`, "i"));
    assert.deepEqual(calls, [{ operation: "upload", path: objectKey, contentType: "image/png" }]);
    assert.doesNotMatch(objectKey, /https?:|token=/i);
  });

  it("rejects executable image formats and oversized files before storage", async () => {
    const calls: StorageCall[] = [];
    const storage = createStorage(calls);

    await assert.rejects(
      uploadPatientImage(new File(["<svg/>"] , "scan.svg", { type: "image/svg+xml" }), OWNER_ID, storage),
      /PNG, JPEG, WebP, or GIF/i,
    );
    await assert.rejects(
      uploadPatientImage(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
        OWNER_ID,
        storage,
      ),
      /10 MB/i,
    );
    assert.deepEqual(calls, []);
  });

  it("re-signs owned keys and never signs a cross-owner key", async () => {
    const calls: StorageCall[] = [];
    const storage = createStorage(calls);

    const url = await createPatientImageSignedUrl(OBJECT_KEY, OWNER_ID, storage);
    assert.match(url, /token=secret/);
    await assert.rejects(
      createPatientImageSignedUrl(`${OTHER_OWNER_ID}/scan.png`, OWNER_ID, storage),
      /owned patient image/i,
    );
    assert.equal(calls.filter((call) => call.operation === "sign").length, 1);
  });

  it("loads only owner-scoped print URLs without mutating canonical patient HTML", async () => {
    const calls: StorageCall[] = [];
    const storage = createStorage(calls);
    const canonical =
      `<p>CT head</p><img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}" alt="CT">` +
      `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OTHER_OWNER_ID}/other.png">` +
      '<img src="https://tracker.example/pixel.png" onerror="alert(1)">';
    const patient = { imaging: canonical };

    const result = await loadPatientImageSignedUrls([patient], OWNER_ID, storage);

    assert.deepEqual(
      calls.filter((call) => call.operation === "sign"),
      [{ operation: "sign", path: OBJECT_KEY, expiresIn: 3600 }],
    );
    assert.equal(result.unavailableCount, 0);
    assert.equal(result.signedUrls.size, 1);
    assert.match(result.signedUrls.get(OBJECT_KEY) ?? "", /token=secret/);
    assert.equal(patient.imaging, canonical);
    assert.doesNotMatch(patient.imaging, /token=secret/);
    assert.equal(
      resolveOwnedPatientImageSignedUrl(OBJECT_KEY, result.signedUrls, OWNER_ID),
      result.signedUrls.get(OBJECT_KEY),
    );
    assert.equal(
      resolveOwnedPatientImageSignedUrl(`${OTHER_OWNER_ID}/other.png`, result.signedUrls, OWNER_ID),
      null,
    );
  });

  it("refuses mismatched signed URLs instead of attaching a token to another image key", () => {
    const otherKey = `${OWNER_ID}/other.png`;
    const mismatchedUrl =
      `https://project.supabase.co/storage/v1/object/sign/patient-images/${otherKey}?token=secret`;
    const canonical = `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">`;

    const hydrated = hydratePatientImageHtml(
      canonical,
      new Map([[OBJECT_KEY, mismatchedUrl]]),
      OWNER_ID,
    );

    assert.doesNotMatch(hydrated, /token=|\ssrc=/i);
    assert.equal(
      resolveOwnedPatientImageSignedUrl(
        OBJECT_KEY,
        new Map([[OBJECT_KEY, mismatchedUrl]]),
        OWNER_ID,
      ),
      null,
    );
  });

  it("deduplicates cleanup and refuses to remove another user's object", async () => {
    const calls: StorageCall[] = [];
    const storage = createStorage(calls);

    const removed = await deletePatientImageObjects(
      [OBJECT_KEY, OBJECT_KEY, `${OTHER_OWNER_ID}/scan.png`, "../escape.png"],
      OWNER_ID,
      storage,
    );

    assert.deepEqual(removed, [OBJECT_KEY]);
    assert.deepEqual(calls, [{ operation: "remove", paths: [OBJECT_KEY] }]);
  });

  it("cleans up deleted-patient images only when no remaining patient references them", async () => {
    const calls: StorageCall[] = [];
    const storage = createStorage(calls);
    const secondKey = `${OWNER_ID}/second.webp`;
    const patient = {
      imaging:
        `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">` +
        `<img src="https://project.supabase.co/storage/v1/object/sign/patient-images/${secondKey}?token=legacy">`,
    };

    const removed = await cleanupPatientImagesForPatient(
      patient,
      [{ imaging: `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">` }],
      OWNER_ID,
      storage,
    );

    assert.deepEqual(removed, [secondKey]);
    assert.deepEqual(calls, [{ operation: "remove", paths: [secondKey] }]);
  });

  it("prepares annotation markup without deleting the superseded object before persistence", async () => {
    const events: string[] = [];
    const storage = {
      from() {
        return {
          async upload(path: string) {
            events.push(`upload:${path}`);
            return { data: { path }, error: null };
          },
          async createSignedUrl() {
            throw new Error("not used");
          },
          async remove(paths: string[]) {
            events.push(`remove:${paths.join(",")}`);
            return { data: [], error: null };
          },
        };
      },
    };
    const current = `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OBJECT_KEY}">`;
    const annotation = new File([new Uint8Array([1])], "annotation.png", { type: "image/png" });

    const result = await prepareStoredPatientImageReplacement(
      current,
      0,
      annotation,
      OWNER_ID,
      storage,
    );

    assert.deepEqual(events.map((event) => event.split(":", 1)[0]), ["upload"]);
    assert.equal(result.supersededKey, OBJECT_KEY);
    assert.deepEqual(extractPatientImageObjectKeys(result.html, OWNER_ID), [result.replacementKey]);
  });
});
