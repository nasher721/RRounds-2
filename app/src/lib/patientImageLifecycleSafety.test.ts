import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path: string) => readFileSync(path, "utf8");

test("the image editor persists canonical keys and cleans up only uncommitted uploads", () => {
  const source = readSource("src/components/ImagePasteEditor.tsx");

  assert.match(source, /PATIENT_IMAGE_KEY_ATTRIBUTE/);
  assert.match(source, /prepareStoredPatientImageReplacement/);
  assert.match(source, /preserveLegacyDataImages:\s*legacyInlineImageCount\s*>\s*0/);
  assert.doesNotMatch(source, /canvas\.toDataURL/);
  assert.doesNotMatch(source, /removed from the note and private storage/i);
  assert.match(source, /isActiveImageOwner\(requestOwnerId\)/);
  assert.match(source, /discardUncommittedImage\(objectKey, requestOwnerId\)/);
  assert.match(source, /discardUncommittedImage\(objectKey, requestOwnerId\)/);
  assert.match(source, /editorRef\.current === requestEditor/);
  assert.match(source, /annotationSessionRef\.current === requestSession/);
  assert.match(source, /resolvePatientImageReplacementIndex\(\s*latestHtml/);
  assert.match(source, /replacePatientImageAtIndex\(\s*latestHtml/);
  assert.doesNotMatch(
    source,
    /prepareStoredPatientImageReplacement\(\s*canonicalValue/,
  );
});

test("the patient image bucket remains private and owner-scoped with upload limits", () => {
  const source = readSource(
    "supabase/migrations/20260711190000_harden_patient_image_storage.sql",
  );

  assert.match(source, /public\s*=\s*false/i);
  assert.match(source, /file_size_limit\s*=\s*EXCLUDED\.file_size_limit/i);
  assert.match(source, /TO authenticated/i);
  assert.match(source, /auth\.uid\(\)::text\s*=\s*\(storage\.foldername\(name\)\)\[1\]/i);
  assert.doesNotMatch(source, /CREATE POLICY\s+"Public can view patient images"/i);
});
