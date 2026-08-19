import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import * as React from "react";
import { cleanup, render } from "@testing-library/react";
import { PrintDocument } from "@/components/print/PrintDocument";
import {
  containsPrintablePatientImages,
  sanitizeClinicalHtmlForDocumentExport,
} from "@/components/print/ExportHandlers";
import {
  defaultColumns,
  defaultColumnWidths,
  defaultCombinedColumnWidths,
} from "@/components/print/constants";
import type { PrintSettings } from "@/lib/print/types";
import {
  PATIENT_IMAGE_KEY_ATTRIBUTE,
} from "@/lib/patientImages";
import {
  defaultMedications,
  defaultSystems,
  type Patient,
} from "@/types/patient";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER_ID = "22222222-2222-4222-8222-222222222222";
const OWN_KEY = `${OWNER_ID}/scan.png`;
const OTHER_KEY = `${OTHER_OWNER_ID}/scan.png`;
const OWN_SIGNED_URL =
  `https://project.supabase.co/storage/v1/object/sign/patient-images/${OWN_KEY}` +
  "?token=short-lived";

const settings: PrintSettings = {
  columns: defaultColumns.map((column) => ({
    ...column,
    enabled: column.key === "patient" || column.key === "imaging",
  })),
  combinedColumns: [],
  printOrientation: "portrait",
  printFontSize: 9,
  printFontFamily: "system",
  onePatientPerPage: false,
  autoFitFontSize: false,
  columnWidths: defaultColumnWidths,
  combinedColumnWidths: defaultCombinedColumnWidths,
  margins: "normal",
  headerStyle: "standard",
  borderStyle: "light",
  showPageNumbers: true,
  showTimestamp: false,
  alternateRowColors: false,
  compactMode: false,
  activeTab: "table",
  showNotesColumn: false,
  showTodosColumn: false,
};

const patient: Patient = {
  id: "patient-1",
  patientNumber: 1,
  name: "Test patient",
  mrn: "",
  bed: "1",
  clinicalSummary: "",
  intervalEvents: "",
  imaging:
    `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OWN_KEY}" alt="Owned scan" ` +
    'src="javascript:alert(1)" onerror="alert(2)">' +
    `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OTHER_KEY}" alt="Other scan">` +
    '<script>globalThis.attackerRan=true</script>',
  labs: "",
  systems: defaultSystems,
  medications: defaultMedications,
  fieldTimestamps: {},
  collapsed: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastModified: "2026-01-01T00:00:00.000Z",
};

afterEach(cleanup);

describe("patient image print rendering", () => {
  it("renders only the active owner's transient signed image and ignores stored src/XSS", () => {
    const { container } = render(
      <PrintDocument
        patients={[patient]}
        settings={settings}
        patientImageOwnerId={OWNER_ID}
        patientImageSignedUrls={new Map([
          [OWN_KEY, OWN_SIGNED_URL],
          [
            OTHER_KEY,
            `https://project.supabase.co/storage/v1/object/sign/patient-images/${OTHER_KEY}?token=other`,
          ],
        ])}
      />,
    );

    const images = Array.from(container.querySelectorAll("img"));
    assert.equal(images.length, 1);
    assert.equal(images[0].getAttribute(PATIENT_IMAGE_KEY_ATTRIBUTE), OWN_KEY);
    assert.equal(images[0].getAttribute("src"), OWN_SIGNED_URL);
    assert.doesNotMatch(container.innerHTML, /javascript:|onerror=|<script|attackerRan/i);
    assert.doesNotMatch(container.innerHTML, /token=other/);
  });

  it("does not render a canonical image when no matching transient URL exists", () => {
    const { container } = render(
      <PrintDocument
        patients={[patient]}
        settings={settings}
        patientImageOwnerId={OWNER_ID}
        patientImageSignedUrls={new Map()}
      />,
    );

    assert.equal(container.querySelectorAll("img").length, 0);
    assert.doesNotMatch(container.innerHTML, /javascript:|onerror=|token=/i);
  });

  it("embeds image bytes in document HTML without persisting signed tokens or unsafe markup", () => {
    const documentHtml = sanitizeClinicalHtmlForDocumentExport(
      patient.imaging,
      OWNER_ID,
      new Map([[OWN_KEY, "data:image/png;base64,AQID"]]),
    );

    assert.match(documentHtml, /src="data:image\/png;base64,AQID"/);
    assert.doesNotMatch(
      documentHtml,
      /data-patient-image-key|javascript:|onerror=|<script|attackerRan|token=/i,
    );
    assert.equal((documentHtml.match(/<img/g) ?? []).length, 1);
  });

  it("selects the visual PDF path only after a safely rendered image has a source", () => {
    const element = document.createElement("div");
    element.innerHTML = `<img ${PATIENT_IMAGE_KEY_ATTRIBUTE}="${OWN_KEY}">`;
    assert.equal(containsPrintablePatientImages(element), false);

    element.querySelector("img")?.setAttribute("src", OWN_SIGNED_URL);
    assert.equal(containsPrintablePatientImages(element), true);
  });
});
