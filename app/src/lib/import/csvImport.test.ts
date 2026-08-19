import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoMapColumns,
  mapValidRowsToPatients,
  parseCSV,
  validateRow,
  type CSVParseResult,
  type FieldMapping,
} from './csvImport';

const mapping: FieldMapping[] = [
  { csvColumn: 'Name', targetField: 'name' },
  { csvColumn: 'DOB', targetField: 'dob', transform: 'date' },
  { csvColumn: 'Gender', targetField: 'gender' },
  { csvColumn: 'Room', targetField: 'room' },
];

test('CSV validation permits blank optional fields and common gender labels', () => {
  assert.deepEqual(
    validateRow(['Jane Doe', '1980-01-02', 'Female', ''], ['Name', 'DOB', 'Gender', 'Room'], mapping),
    [],
  );
});

test('CSV import maps only valid rows', () => {
  const csvData: CSVParseResult = {
    headers: ['Name', 'DOB', 'Gender', 'Room'],
    rows: [
      ['Jane Doe', '1980-01-02', 'F', '12'],
      ['', '1990-02-03', 'M', '13'],
      ['Future Patient', '2999-01-01', 'Other', '14'],
    ],
    rowCount: 3,
    errors: [],
  };

  const result = mapValidRowsToPatients(csvData, mapping);

  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Jane Doe');
  assert.match(result[0].dob, /^1980-01-02T/);
});

test('CSV parsing preserves quoted multiline clinical fields as one patient row', () => {
  const parsed = parseCSV([
    'Name,Diagnosis,Room',
    '"Doe, Jane","Sepsis',
    'on norepinephrine",12A',
    '"Smith, John","ARDS, improving",12B',
  ].join('\r\n'));

  assert.deepEqual(parsed.headers, ['Name', 'Diagnosis', 'Room']);
  assert.deepEqual(parsed.rows, [
    ['Doe, Jane', 'Sepsis\non norepinephrine', '12A'],
    ['Smith, John', 'ARDS, improving', '12B'],
  ]);
  assert.equal(parsed.rowCount, 2);

  const patients = mapValidRowsToPatients(parsed, autoMapColumns(parsed.headers));
  assert.equal(patients.length, 2);
  assert.equal(patients[0].name, 'Doe, Jane');
  assert.equal(patients[0].diagnosis, 'Sepsis\non norepinephrine');
});

test('CSV parsing preserves escaped quotes and ignores physically blank records', () => {
  const parsed = parseCSV('Name,Diagnosis\n\nJane Doe,"Said ""better"" today"\n');

  assert.deepEqual(parsed.rows, [['Jane Doe', 'Said "better" today']]);
  assert.equal(parsed.rowCount, 1);
  assert.deepEqual(parsed.errors, []);
});

test('CSV parsing rejects an unclosed quoted field instead of merging patients', () => {
  const parsed = parseCSV('Name,Diagnosis\n"Jane Doe,Sepsis\nSmith,DKA');

  assert.equal(parsed.rowCount, 0);
  assert.deepEqual(parsed.rows, []);
  assert.deepEqual(parsed.errors, [
    {
      line: 2,
      message: 'Unclosed quoted field. Add the missing closing quote before importing.',
    },
  ]);
  assert.deepEqual(mapValidRowsToPatients(parsed, autoMapColumns(parsed.headers)), []);
});

test('CSV parsing rejects records whose column count does not match the header', () => {
  const parsed = parseCSV('Name,Diagnosis\nJane Doe,Sepsis,Unexpected\nJohn Smith,DKA');

  assert.deepEqual(parsed.rows, [['John Smith', 'DKA']]);
  assert.deepEqual(parsed.errors, [
    {
      line: 2,
      message: 'Expected 2 columns but found 3. Check commas and quoted fields.',
    },
  ]);
});

test('CSV parsing reports content outside a quoted field as ambiguous', () => {
  const parsed = parseCSV('Name,Diagnosis\n"Jane Doe" extra,Sepsis');

  assert.equal(parsed.rowCount, 1);
  assert.deepEqual(parsed.errors, [
    {
      line: 2,
      message: 'Unexpected content after a closing quote. Separate fields with a comma.',
    },
  ]);
  assert.deepEqual(mapValidRowsToPatients(parsed, autoMapColumns(parsed.headers)), []);
});

test('CSV parsing rejects duplicate and unnamed headers before mapping', () => {
  const duplicate = parseCSV('Name,name,Diagnosis\nJane Doe,Alias,Sepsis');
  const unnamed = parseCSV('Name,,Diagnosis\nJane Doe,Alias,Sepsis');

  assert.match(duplicate.errors[0].message, /Duplicate column headers/);
  assert.equal(duplicate.errors[0].line, 1);
  assert.deepEqual(mapValidRowsToPatients(duplicate, autoMapColumns(duplicate.headers)), []);
  assert.match(unnamed.errors[0].message, /Column 2 has no header/);
  assert.equal(unnamed.errors[0].line, 1);
});
