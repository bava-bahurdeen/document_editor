import { describe, it, expect } from "vitest";
import { resolveDocumentState } from "../lib/crdt/resolver";
import { Operation } from "@/types";

describe("CRDT State Resolver", () => {
  it("should reconstruct document text from basic insert operations", () => {
    const operations: Operation[] = [
      {
        id: "c1:1",
        documentId: "d1",
        userId: "u1",
        type: "INSERT",
        position: "a1",
        value: "H",
        createdAt: new Date("2026-07-07T12:00:00Z"),
      },
      {
        id: "c1:2",
        documentId: "d1",
        userId: "u1",
        type: "INSERT",
        position: "a3",
        value: "l",
        createdAt: new Date("2026-07-07T12:00:02Z"),
      },
      {
        id: "c1:3",
        documentId: "d1",
        userId: "u1",
        type: "INSERT",
        position: "a2",
        value: "e",
        createdAt: new Date("2026-07-07T12:00:01Z"),
      },
    ];

    const state = resolveDocumentState(operations);
    expect(state.content).toBe("Hel");
  });

  it("should break ties deterministically when concurrent inserts share the same position", () => {
    const operations: Operation[] = [
      {
        id: "clientB:10", // Lamport ID: alphabetical second
        documentId: "d1",
        userId: "u2",
        type: "INSERT",
        position: "a5",
        value: "B",
        createdAt: new Date("2026-07-07T12:00:00Z"),
      },
      {
        id: "clientA:10", // Lamport ID: alphabetical first
        documentId: "d1",
        userId: "u1",
        type: "INSERT",
        position: "a5",
        value: "A",
        createdAt: new Date("2026-07-07T12:00:00Z"),
      },
    ];

    // ClientA ID < ClientB ID, so 'A' should be ordered before 'B'
    const state = resolveDocumentState(operations);
    expect(state.content).toBe("AB");
  });

  it("should apply tombstone deletes targeting specific insert operations", () => {
    const operations: Operation[] = [
      {
        id: "c1:1",
        documentId: "d1",
        userId: "u1",
        type: "INSERT",
        position: "a1",
        value: "H",
        createdAt: new Date(),
      },
      {
        id: "c1:2",
        documentId: "d1",
        userId: "u1",
        type: "INSERT",
        position: "a2",
        value: "e",
        createdAt: new Date(),
      },
      {
        id: "c2:1",
        documentId: "d1",
        userId: "u2",
        type: "DELETE",
        position: "a2",
        value: "c1:2", // Target the insert id 'c1:2' (e)
        createdAt: new Date(),
      },
    ];

    const state = resolveDocumentState(operations);
    expect(state.content).toBe("H");
  });

  it("should deterministically resolve document titles using latest updates and Lamport tie-breakers", () => {
    const operations: Operation[] = [
      {
        id: "c1:1",
        documentId: "d1",
        userId: "u1",
        type: "UPDATE_TITLE",
        position: "title",
        value: "First Title",
        createdAt: new Date("2026-07-07T12:00:00Z"),
      },
      {
        id: "c2:1",
        documentId: "d1",
        userId: "u2",
        type: "UPDATE_TITLE",
        position: "title",
        value: "Second Title",
        createdAt: new Date("2026-07-07T12:01:00Z"),
      },
    ];

    const state = resolveDocumentState(operations);
    expect(state.title).toBe("Second Title");
  });
});
