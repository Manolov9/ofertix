import { describe, expect, it } from "vitest";
import { firstImageUrl, formatPriceLabel, getCatalog, matchesQuery } from "./catalog";

describe("Ofertix catalog helpers", () => {
  it("matches products case-insensitively and by substring", () => {
    expect(matchesQuery("Кока Кола 2 л", "кока кола")).toBe(true);
    expect(matchesQuery("Кока Кола 2 л", "КОКА КОЛА")).toBe(true);
    expect(matchesQuery("Кока Кола 2 л", "кола")).toBe(true);
    expect(matchesQuery("Кока Кола 2 л", "лимон")).toBe(false);
  });

  it("keeps one or two catalog prices in a readable label", () => {
    expect(formatPriceLabel(3.49)).toBe("3,49 лв.");
    expect(formatPriceLabel(3.49, 4.19)).toBe("3,49 лв. / 4,19 лв.");
  });

  it("selects a small catalog page image from the same brochure page", () => {
    const html = `
      <img src="https://katalozi-bg.info/img/logos/7.jpg">
      <img src="/img/available-on-the-app-store.svg">
      <img src="/catalogs/34848/small/1.jpg">
      <img src="/catalogs/34848/small/2.jpg">
    `;
    expect(firstImageUrl(html, "https://katalozi-bg.info/catalogs/promo/34848")).toBe("https://katalozi-bg.info/catalogs/34848/small/1.jpg");
  });

  it("returns a real product result after manual catalog data is loaded", () => {
    const result = getCatalog("КОКА КОЛА");
    expect(result.offers[0]?.product).toContain("Кока Кола");
    expect(result.offers[0]?.priceLabel).toContain("лв.");
  });
});
