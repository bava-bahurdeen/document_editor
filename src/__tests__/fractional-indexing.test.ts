import { describe, it, expect } from "vitest";
import { generatePositionBetween } from "../lib/crdt/fractional-indexing";

describe("Fractional Indexing CRDT coordinates", () => {
  it("should generate a midpoint between empty boundaries", () => {
    const pos = generatePositionBetween("", "");
    expect(pos).toBe("O");
  });

  it("should generate a midpoint between left boundary and empty right", () => {
    const pos1 = generatePositionBetween("O", "");
    expect(pos1).toBe("g");
    
    const pos2 = generatePositionBetween("g", "");
    expect(pos2).toBe("s");
  });

  it("should generate a midpoint between empty left and right boundary", () => {
    const pos1 = generatePositionBetween("", "O");
    expect(pos1).toBe("7"); // Midpoint between Space (32) and O (79)
  });

  it("should generate a midpoint between two coordinates", () => {
    const pos = generatePositionBetween("O", "g");
    expect(pos).toBe("["); // Midpoint between O (79) and g (103) is [ (91)
    expect("O" < pos).toBe(true);
    expect(pos < "g").toBe(true);
  });

  it("should handle consecutive character insertions by increasing character depth", () => {
    const pos = generatePositionBetween("O", "P");
    expect(pos).toBe("OO");
    expect("O" < pos).toBe(true);
    expect(pos < "P").toBe(true);
  });

  it("should handle deep consecutive coordinates nested levels", () => {
    const pos1 = generatePositionBetween("A", "B");
    expect(pos1).toBe("AO");
    
    const pos2 = generatePositionBetween("AO", "B");
    expect(pos2).toBe("Ag");
    
    const pos3 = generatePositionBetween("AO", "Ag");
    expect(pos3).toBe("A[");
  });

  it("should safely resolve invalid coordinate ordering where left >= right", () => {
    const pos = generatePositionBetween("Z", "A");
    expect(pos.startsWith("Z")).toBe(true);
    expect(pos.length).toBeGreaterThan(1);
  });
});
