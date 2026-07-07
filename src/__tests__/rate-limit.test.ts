import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimitCheck } from "../lib/rate-limit";

describe("Token Bucket Rate Limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("should permit initial requests and decrement remaining tokens", () => {
    const ip = "192.168.1.1";
    
    // First request should pass
    const res1 = rateLimitCheck(ip);
    expect(res1.success).toBe(true);
    expect(res1.limit).toBe(100);
    expect(res1.remaining).toBe(99);
    
    // Second request should decrement
    const res2 = rateLimitCheck(ip);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(98);
  });

  it("should block requests when bucket tokens are completely exhausted", () => {
    const ip = "10.0.0.1";

    // Consume all 100 tokens
    for (let i = 0; i < 100; i++) {
      rateLimitCheck(ip);
    }

    // 101st request should be blocked
    const blockRes = rateLimitCheck(ip);
    expect(blockRes.success).toBe(false);
    expect(blockRes.remaining).toBe(0);
    expect(blockRes.reset).toBeGreaterThan(0);
  });

  it("should replenish tokens over time and permit requests again", () => {
    const ip = "172.16.0.1";

    // Exhaust tokens
    for (let i = 0; i < 100; i++) {
      rateLimitCheck(ip);
    }
    
    expect(rateLimitCheck(ip).success).toBe(false);

    // Fast-forward time by 30 seconds (half of the window: replenishes 50 tokens)
    vi.advanceTimersByTime(30000);

    const replenishRes = rateLimitCheck(ip);
    expect(replenishRes.success).toBe(true);
    expect(replenishRes.remaining).toBeGreaterThan(0);
  });
});
