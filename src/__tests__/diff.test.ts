import { describe, it, expect } from "vitest";
import { computeWordDiff } from "../lib/crdt/diff";

describe("Word-Level LCS Diff Algorithm", () => {
  it("should return equal token for identical strings", () => {
    const original = "Hello collaborative world";
    const modified = "Hello collaborative world";
    const diff = computeWordDiff(original, modified);
    
    expect(diff.length).toBe(1);
    expect(diff[0]).toEqual({ type: "equal", value: "Hello collaborative world" });
  });

  it("should detect simple word additions", () => {
    const original = "Hello world";
    const modified = "Hello collaborative world";
    const diff = computeWordDiff(original, modified);

    expect(diff).toEqual([
      { type: "equal", value: "Hello" },
      { type: "added", value: " collaborative" },
      { type: "equal", value: " world" },
    ]);
  });

  it("should detect simple word deletions", () => {
    const original = "Hello collaborative world";
    const modified = "Hello world";
    const diff = computeWordDiff(original, modified);

    expect(diff).toEqual([
      { type: "equal", value: "Hello" },
      { type: "removed", value: " collaborative" },
      { type: "equal", value: " world" },
    ]);
  });

  it("should handle mixed replacements additions and deletions", () => {
    const original = "The quick brown fox";
    const modified = "The fast brown fox jumps";
    const diff = computeWordDiff(original, modified);

    expect(diff).toEqual([
      { type: "equal", value: "The " },
      { type: "removed", value: "quick" },
      { type: "added", value: "fast" },
      { type: "equal", value: " brown fox" },
      { type: "added", value: " jumps" },
    ]);
  });
});
