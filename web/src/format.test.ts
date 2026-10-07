import { describe, expect, it } from "vitest";
import { deltaText, safeHttpUrl, scoreFromTap, unacknowledgedCount, unreadCount } from "./format";

describe("scoreFromTap", () => {
  it("keeps the first dot at the minimum valid rating", () => {
    expect(scoreFromTap(1, true)).toBe(1);
    expect(scoreFromTap(1, false)).toBe(1);
  });

  it("uses the left half of later dots for a half point", () => {
    expect(scoreFromTap(3, true)).toBe(2.5);
    expect(scoreFromTap(3, false)).toBe(3);
    expect(scoreFromTap(5, true)).toBe(4.5);
    expect(scoreFromTap(5, false)).toBe(5);
  });
});

describe("safeHttpUrl", () => {
  it("accepts http and https", () => {
    expect(safeHttpUrl("https://example.com/drill")).toBe("https://example.com/drill");
    expect(safeHttpUrl("http://example.com/d")).toBe("http://example.com/d");
  });

  it("rejects other protocols and junk", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl("notaurl")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
  });
});

describe("deltaText", () => {
  it("describes change from the first rating", () => {
    expect(deltaText(null)).toBe("No change yet");
    expect(deltaText(0)).toBe("No change yet");
    expect(deltaText(1.5)).toBe("+1.5 from first rating");
    expect(deltaText(-1)).toBe("-1 from first rating");
  });
});

describe("unreadCount", () => {
  it("counts only explicit unread items", () => {
    expect(unreadCount([{ read: false }, { read: true }, {}])).toBe(1);
  });
});

describe("unacknowledgedCount", () => {
  it("counts alarms that are not acknowledged, ignoring the read flag", () => {
    const items: { acknowledged?: boolean; read?: boolean }[] = [
      { acknowledged: false, read: true },
      { acknowledged: true, read: false },
      { read: false },
      {},
    ];
    expect(unacknowledgedCount(items)).toBe(3);
  });

  it("is zero when every alarm is acknowledged", () => {
    expect(unacknowledgedCount([{ acknowledged: true }, { acknowledged: true }])).toBe(0);
    expect(unacknowledgedCount([])).toBe(0);
  });
});
