import * as React from "react";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  RoundSessionProvider,
  type RoundSessionContextValue,
  useRoundSession,
} from "@/contexts/RoundSessionContext";
import { createContinuityMeta, roundSyncEngine } from "@/lib/round/sync";
import { roundOutbox } from "@/lib/round/sync/roundOutbox";
import { createRound } from "@/lib/round/roundSessionStore";
import type { Round } from "@/types/round";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

let latestSession: RoundSessionContextValue | null = null;

const SessionProbe = () => {
  latestSession = useRoundSession();
  return <span>{latestSession.round.userId}</span>;
};

const originalBindOwner = roundSyncEngine.bindOwner.bind(roundSyncEngine);
const originalEnsureNetworkListeners = roundSyncEngine.ensureNetworkListeners.bind(roundSyncEngine);
const originalHydrate = roundSyncEngine.hydrateRoundSession.bind(roundSyncEngine);
const originalPersist = roundSyncEngine.persistRoundSession.bind(roundSyncEngine);
const originalReconcileGeneration = roundSyncEngine.reconcileRoundGeneration.bind(roundSyncEngine);

afterEach(async () => {
  cleanup();
  latestSession = null;
  roundSyncEngine.bindOwner = originalBindOwner;
  roundSyncEngine.ensureNetworkListeners = originalEnsureNetworkListeners;
  roundSyncEngine.hydrateRoundSession = originalHydrate;
  roundSyncEngine.persistRoundSession = originalPersist;
  roundSyncEngine.reconcileRoundGeneration = originalReconcileGeneration;
  roundOutbox.setOwner(null);
  await roundOutbox.clear();
});

describe("RoundSessionProvider persistence owner boundary", () => {
  it("does not expose an interactive Round before continuity hydration completes", async () => {
    let finishHydration: (() => void) | null = null;
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = ({ fallbackRound }) => new Promise((resolve) => {
      finishHydration = () => resolve({
        round: fallbackRound,
        continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
      });
    });

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    assert.equal(latestSession?.isHydrated, false);
    act(() => finishHydration?.());
    await waitFor(() => assert.equal(latestSession?.isHydrated, true));
  });

  it("cancels a delayed save when the authenticated owner changes", async () => {
    const persistedOwners: string[] = [];
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async ({ round }) => {
      persistedOwners.push(round.userId);
    };

    const view = render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.continuity?.deviceId, "test-device"));
    act(() => latestSession?.nextPatient());
    await wait(25);

    view.rerender(
      <RoundSessionProvider userId="user-b" patientIds={["patient-c", "patient-d"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.round.userId, "user-b"));
    await wait(300);
    assert.deepEqual(persistedOwners, []);
  });

  it("still persists a current owner's round change", async () => {
    const persistedRounds: Round[] = [];
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async ({ round }) => {
      persistedRounds.push(round);
    };

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.continuity?.deviceId, "test-device"));
    act(() => latestSession?.nextPatient());
    await wait(300);

    assert.equal(persistedRounds.length, 1);
    assert.equal(persistedRounds[0]?.userId, "user-a");
  });

  it("persists an explicit new active Round after completion", async () => {
    const persistedRounds: Round[] = [];
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async ({ round }) => {
      persistedRounds.push(round);
    };

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.isHydrated, true));
    const completedRoundId = latestSession?.round.id;

    act(() => latestSession?.completeRound());
    await waitFor(() => assert.equal(latestSession?.round.status, "completed"));
    await wait(300);

    act(() => latestSession?.startNewRound());
    await waitFor(() => assert.equal(latestSession?.round.status, "active"));
    await wait(300);

    assert.notEqual(latestSession?.round.id, completedRoundId);
    assert.equal(latestSession?.round.currentIndex, 0);
    assert.ok(latestSession?.round.patients.every((patient) => patient.status === "pending"));
    assert.equal(persistedRounds.at(-1)?.status, "active");
    assert.equal(persistedRounds.at(-1)?.id, latestSession?.round.id);
  });

  it("persists terminal completion before an immediately started new Round", async () => {
    const persistedRounds: Round[] = [];
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async ({ round }) => {
      persistedRounds.push(round);
    };

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.isHydrated, true));
    act(() => latestSession?.completeRound());
    await waitFor(() => assert.equal(latestSession?.round.status, "completed"));
    act(() => latestSession?.startNewRound());

    await waitFor(() => assert.equal(persistedRounds.at(-1)?.status, "active"));
    assert.deepEqual(
      persistedRounds.map((item) => item.status),
      ["completed", "active"],
    );
  });

  it("still persists the new active Round when terminal persistence rejects", async () => {
    const attemptedStatuses: Round["status"][] = [];
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("test-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async ({ round }) => {
      attemptedStatuses.push(round.status);
      if (round.status === "completed") throw new Error("simulated terminal write failure");
    };

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );

    await waitFor(() => assert.equal(latestSession?.isHydrated, true));
    act(() => latestSession?.completeRound());
    await waitFor(() => assert.equal(latestSession?.round.status, "completed"));
    act(() => latestSession?.startNewRound());

    await waitFor(() => assert.deepEqual(attemptedStatuses, ["completed", "active"]));
    assert.equal(latestSession?.round.status, "active");
  });

  it("adopts an authoritative Round completed before generation-conflict resolution", async () => {
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("local-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async () => undefined;

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );
    await waitFor(() => assert.equal(latestSession?.isHydrated, true));

    const localRound = latestSession!.round;
    const outboxId = await roundOutbox.enqueueRoundState({
      roundId: localRound.id,
      payload: {
        round: localRound,
        continuity: latestSession!.continuity,
      },
      updatedAt: localRound.updatedAt,
      deviceId: "local-device",
      ownerId: "user-a",
    });
    await roundOutbox.markSoftFail(outboxId, "round_generation_conflict", 0);
    await waitFor(() => assert.equal(latestSession?.generationConflictCount, 1));

    const remoteRound = {
      ...createRound({
        userId: "user-a",
        patientIds: ["patient-a", "patient-b"],
        id: "authoritative-round",
        now: "2026-08-13T14:00:00.000Z",
      }),
      status: "completed" as const,
    };
    const remoteContinuity = createContinuityMeta("remote-device", remoteRound.updatedAt);
    roundSyncEngine.reconcileRoundGeneration = async () => {
      await roundOutbox.remove(outboxId);
      return { round: remoteRound, continuity: remoteContinuity };
    };

    await act(async () => latestSession?.adoptRemoteRoundGeneration());
    await waitFor(() => assert.equal(latestSession?.round.id, "authoritative-round"));
    assert.equal(latestSession?.round.status, "completed");
    assert.equal(latestSession?.generationConflictCount, 0);
    assert.match(latestSession?.retryResult ?? "", /another device/i);
  });

  it("keeps generation conflict blocked when authoritative adoption cannot persist", async () => {
    roundSyncEngine.bindOwner = (ownerId) => roundOutbox.setOwner(ownerId);
    roundSyncEngine.ensureNetworkListeners = () => undefined;
    roundSyncEngine.hydrateRoundSession = async ({ fallbackRound }) => ({
      round: fallbackRound,
      continuity: createContinuityMeta("local-device", fallbackRound.updatedAt),
    });
    roundSyncEngine.persistRoundSession = async () => undefined;

    render(
      <RoundSessionProvider userId="user-a" patientIds={["patient-a", "patient-b"]}>
        <SessionProbe />
      </RoundSessionProvider>,
    );
    await waitFor(() => assert.equal(latestSession?.isHydrated, true));

    const localRound = latestSession!.round;
    const outboxId = await roundOutbox.enqueueRoundState({
      roundId: localRound.id,
      payload: { round: localRound, continuity: latestSession!.continuity },
      updatedAt: localRound.updatedAt,
      deviceId: "local-device",
      ownerId: "user-a",
    });
    await roundOutbox.markSoftFail(outboxId, "round_generation_conflict", 0);
    await waitFor(() => assert.equal(latestSession?.generationConflictCount, 1));

    roundSyncEngine.reconcileRoundGeneration = async () => {
      throw new Error("simulated cache quota failure");
    };
    await act(async () => latestSession?.adoptRemoteRoundGeneration());

    assert.equal(latestSession?.round.id, localRound.id);
    assert.equal(latestSession?.generationConflictCount, 1);
    assert.match(latestSession?.retryResult ?? "", /conflict remains blocked/i);
  });
});
