import { describe, expect, it } from "vitest";
import { getActiveThemeV2, legacyLayoutToThemeV2, normalizeThemeV2 } from "@/lib/theme-editor";

describe("theme-editor", () => {
  it("normalizes invalid payload to safe defaults", () => {
    const theme = normalizeThemeV2({
      header: { announcementEnabled: "yes", navLinks: [{ label: "Shop", href: "/shop" }] },
      home: { sections: [{ type: "product_grid", settings: { itemsPerPage: 999 } }] },
    });

    expect(theme.schema_version).toBe(2);
    expect(theme.header.announcementEnabled).toBe(true);
    expect(theme.home.sections[0].type).toBe("product_grid");
    const sectionSettings = theme.home.sections[0].settings as { itemsPerPage?: number };
    expect(sectionSettings.itemsPerPage).toBe(24);
  });

  it("converts legacy layout into v2 structure", () => {
    const theme = legacyLayoutToThemeV2({
      header: { announcementText: "Legacy Banner" },
      hero: { title: "Legacy Hero Title" },
      productGrid: { sectionTitle: "Legacy Collection", itemsPerPage: 12 },
    });

    expect(theme.header.announcementText).toBe("Legacy Banner");
    const hero = theme.home.sections.find((section) => section.type === "hero");
    const productGrid = theme.home.sections.find((section) => section.type === "product_grid");
    expect((hero?.settings as { title?: string })?.title).toBe("Legacy Hero Title");
    expect((productGrid?.settings as { title?: string; itemsPerPage?: number })?.title).toBe(
      "Legacy Collection"
    );
    expect((productGrid?.settings as { title?: string; itemsPerPage?: number })?.itemsPerPage).toBe(12);
  });

  it("only activates published v2 theme when enabled", () => {
    const active = getActiveThemeV2({
      theme_editor_v2_enabled: 1,
      layout_config_v2: {
        home: { sections: [{ type: "rich_text", settings: { heading: "Hello" } }] },
      },
    });

    const inactive = getActiveThemeV2({
      theme_editor_v2_enabled: 0,
      layout_config_v2: {
        home: { sections: [{ type: "rich_text", settings: { heading: "Hello" } }] },
      },
    });

    expect(active).not.toBeNull();
    expect(inactive).toBeNull();
  });
});
