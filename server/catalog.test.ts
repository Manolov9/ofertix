import { describe, expect, it } from "vitest";
import { extractPageOffers, firstImageUrl, formatPriceLabel, getCatalog, matchesQuery, parseCatalogPrice } from "./catalog";

describe("Ofertix OCR catalog index", () => {
  it("matches products, descriptions and case-insensitive substrings", () => {
    expect(matchesQuery("Кафе мляно 250 г", "кафе")).toBe(true);
    expect(matchesQuery("Промоция: КАФЕ арабика", "КАФЕ")).toBe(true);
    expect(matchesQuery("Мляко", "кафе")).toBe(false);
  });

  it("keeps euro-only and euro/lev prices distinct", () => {
    expect(parseCatalogPrice("Кафе 4,99 €")?.priceLabel).toBe("4,99 €");
    expect(parseCatalogPrice("Кафе 4,99 € 9,76 лв.")?.priceLabel).toBe("4,99 € / 9,76 лв.");
    expect(formatPriceLabel(3.49)).toBe("3,49 лв.");
    expect(parseCatalogPrice("ОТ ЧЕТВЪРТЪК 19.11. ДО СРЯДА 25.11.2026 Г.")).toBeUndefined();
  });

  it("selects a small catalog page image", () => {
    const html = `<img src="https://katalozi-bg.info/img/logos/7.jpg"><img src="/catalogs/34848/small/1.jpg"><img src="/catalogs/34848/small/2.jpg">`;
    expect(firstImageUrl(html, "https://katalozi-bg.info/catalogs/promo/34848")).toBe("https://katalozi-bg.info/catalogs/34848/small/1.jpg");
  });

  it("creates one searchable offer per priced OCR line with the exact page URL", () => {
    const brochure = { id: "billa-34848", storeId: "7", title: "Billa", url: "https://katalozi-bg.info/catalogs/promo-katalog-Billa/34848", period: "this-week" as const, rawDate: "този период", pageUrls: [] };
    const pageUrl = "https://katalozi-bg.info/catalogs/34848/3.jpg";
    const offers = extractPageOffers("Кафе арабика\n4,99 € 9,76 лв.\nШоколад", brochure, "Billa", pageUrl);
    expect(offers).toHaveLength(1);
    expect(offers[0].product).toContain("Кафе");
    expect(offers[0].priceLabel).toBe("4,99 € / 9,76 лв.");
    expect(offers[0].pageUrl).toBe(pageUrl);
    expect(offers[0].imageUrl).toBe("https://katalozi-bg.info/catalogs/34848/small/3.jpg");
  });

  it("keeps every matching product line instead of collapsing variants", () => {
    const brochure = { id: "store-1", storeId: "1", title: "Каталог", url: "https://example.test/catalog/1", period: "this-week" as const, rawDate: "този период", pageUrls: [] };
    const offers = extractPageOffers("Кисело мляко 2% 1,29 € 2,52 лв.\nКисело мляко 3,6% 1,49 € 2,92 лв.\nКисело мляко без лактоза 1,79 €", brochure, "Магазин", "https://example.test/catalogs/1/4.jpg");
    expect(offers).toHaveLength(3);
    expect(offers.every(offer => offer.product.includes("Кисело мляко"))).toBe(true);
  });

  it("keeps different Coca-Cola variants as separate searchable records", () => {
    const brochure = { id: "store-2", storeId: "2", title: "Каталог", url: "https://example.test/catalog/2", period: "this-week" as const, rawDate: "този период", pageUrls: [] };
    const offers = extractPageOffers("Coca-Cola Original 2 л 3,49 €\nCoca-Cola Zero 1,5 л 2,99 €\nCoca-Cola Cherry 330 мл 0,99 €", brochure, "Магазин", "https://example.test/catalogs/2/7.jpg");
    expect(offers).toHaveLength(3);
    expect(offers.map(offer => offer.product)).toEqual(expect.arrayContaining(["Coca-Cola Original 2 л", "Coca-Cola Zero 1,5 л", "Coca-Cola Cherry 330 мл"]));
  });

  it("does not show fake demo offers before a real sync", () => {
    expect(getCatalog("кафе").offers).toHaveLength(0);
  });
});
