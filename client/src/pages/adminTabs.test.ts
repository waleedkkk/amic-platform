import { describe, expect, it } from "vitest";
import { ADMIN_TABS } from "./adminTabs";

describe("admin tab structure", () => {
  it("يحافظ على الأقسام الإدارية الأربعة بعناوين ووصف واضحين", () => {
    expect(ADMIN_TABS.map(tab => tab.value)).toEqual(["overview", "users", "ai", "maintenance"]);
    expect(new Set(ADMIN_TABS.map(tab => tab.value)).size).toBe(ADMIN_TABS.length);
    expect(ADMIN_TABS.every(tab => tab.label.length > 0 && tab.description.length > 0)).toBe(true);
  });
});
