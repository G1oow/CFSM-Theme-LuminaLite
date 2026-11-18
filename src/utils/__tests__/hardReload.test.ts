import { describe, expect, it } from "vitest";
import { buildReloadUrl } from "@/utils/hardReload";

describe("buildReloadUrl", () => {
  it("appends a timestamp query so the document request bypasses the cached index.html", () => {
    expect(buildReloadUrl("https://monitor.example.com/", 1234)).toBe(
      "https://monitor.example.com/?cfsm_reload=1234",
    );
  });

  it("keeps the hash route and existing query, and replaces an older stamp", () => {
    expect(
      buildReloadUrl("https://monitor.example.com/?mock=1&cfsm_reload=1#/server/abc", 99),
    ).toBe("https://monitor.example.com/?mock=1&cfsm_reload=99#/server/abc");
  });
});
