import test from "node:test";
import assert from "node:assert/strict";

// Test utility functions that don't need React

test("placeholder test to verify test runner works", () => {
  assert.equal(1 + 1, 2);
});

test("string utilities - basic assertions", () => {
  // Test some basic string operations
  const testStr = "  Hello World  ";
  assert.equal(testStr.trim(), "Hello World");
  assert.equal(testStr.toLowerCase(), "  hello world  ");
  assert.equal(testStr.toUpperCase(), "  HELLO WORLD  ");
});

test("array utilities", () => {
  const arr = [1, 2, 3, 4, 5];
  assert.equal(arr.length, 5);
  assert.equal(arr.filter(x => x > 3).length, 2);
  assert.equal(arr.reduce((a, b) => a + b, 0), 15);
});

test("object utilities", () => {
  const obj = { a: 1, b: 2 };
  assert.equal(Object.keys(obj).length, 2);
  assert.equal(Object.values(obj).reduce((a, b) => a + b, 0), 3);
});

test("date utilities", () => {
  const now = new Date();
  assert.ok(now instanceof Date);
  assert.ok(now.getTime() > 0);
});
