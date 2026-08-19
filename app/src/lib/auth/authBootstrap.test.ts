import assert from "node:assert/strict";
import test from "node:test";
import { readUnexpiredCachedSession } from "./authBootstrap";
import type { StorageLike } from "@/utils/safeStorage";

const storageWith = (value: string | null): StorageLike => ({
  getItem: () => value,
  setItem: () => undefined,
  removeItem: () => undefined,
});

test("auth bootstrap accepts only a structurally valid unexpired session", () => {
  const now = 1_800_000_000_000;
  const session = {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_at: Math.floor(now / 1_000) + 600,
    token_type: "bearer",
    user: { id: "user-a" },
  };

  assert.equal(
    readUnexpiredCachedSession(storageWith(JSON.stringify(session)), "auth", now)?.user.id,
    "user-a",
  );
});

test("auth bootstrap rejects corrupt, incomplete, and expired persisted sessions", () => {
  const now = 1_800_000_000_000;
  assert.equal(readUnexpiredCachedSession(storageWith("{bad"), "auth", now), null);
  assert.equal(
    readUnexpiredCachedSession(
      storageWith(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: Math.floor(now / 1_000) - 1,
        user: { id: "user-a" },
      })),
      "auth",
      now,
    ),
    null,
  );
  assert.equal(
    readUnexpiredCachedSession(
      storageWith(JSON.stringify({ expires_at: Math.floor(now / 1_000) + 600, user: {} })),
      "auth",
      now,
    ),
    null,
  );
});
