import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock global browser properties inside JSDOM environment
if (typeof window !== "undefined") {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
    writable: true,
  });
}
