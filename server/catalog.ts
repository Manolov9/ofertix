export type OfferPeriod = "this-week" | "next-week" | "ended";
export type Store = { order: number; id: string; name: string; url: string; logo: string; active: boolean };
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export type Brochure = { id: string; storeId: string; title: string; url: string; period: OfferPeriod; rawDate: string; thumbnailUrl?: string; pageUrls: string[]; };
export type Offer = { id: string; product: string; searchText: string; storeId: string; storeName: string; price: number; currency?: "BGN" | "EUR"; priceLabel: string; unit: string; period: OfferPeriod; validLabel: string; brochureUrl: string; pageUrl: string; source: string; imageUrl?: string; };
export type SyncState = { status: "idle" | "running" | "success" | "error"; stage: string; startedAt?: string; finishedAt?: string; storesProcessed: number; brochuresProcessed: number; offersProcessed: number; message: string; };

const sourceUrl = "https://katalozi-bg.info/companies";
const fallbackSlugs = [
  [151,"АВС Строителен хипермаркет","abc.stroitelen.hipermarket"],[25,"Aiko","Aiko"],[53,"Alati","Alati"],[52,"Avon","Avon"],[36,"Bagira","Bagira"],[35,"BAUHAUS","BAUHAUS"],[7,"Billa","Billa"],[94,"BulMag","BulMag"],[124,"CBA Bolero","cba_bolero"],[101,"CBA Kome","CBAKome"],[42,"Como","Como"],[118,"Comsed","Comsed"],[48,"Densi","Densi"],[147,"DS Home","DS%20Home"],[105,"Edea","Edea"],[111,"Em Design","Em%20Design"],[32,"Enikom","Enikom"],[16,"Fantastico","Fantastico"],[67,"GOLD-APOLO","GOLD-APOLO"],[56,"Hit Hypermarket","hit%20hypermarket"],[22,"HomeMax","HomeMax"],[26,"JYSK","JYSK"],[103,"Kam Market","Kam%20Market"],[17,"Kaufland","Kaufland"],[50,"Krez","Krez"],[71,"Leksi","Leksi"],[6,"Lidl","Lidl"],[27,"Lilly Drogerie","Lilly%20Drogerie"],[154,"MAG ITALIA","MAG%20ITALIA"],[19,"Магазини Дар","Magazini%20Dar"],[55,"Malmuk","Malmuk"],[21,"MASTERHAUS","MASTERHAUS"],[76,"Мебели Лазур","mebeli%20lazur"],[38,"Merkanto","Merkanto"],[1,"Metro","Metro"],[31,"Mömax","M%C3%B6max"],[12,"Mr.Bricolage","Mr.Bricolage"],[58,"My Market","My%20Market"],[73,"Paconi","Paconi"],[11,"Praktiker","Praktiker"],[34,"PRAKTIS","PRAKTIS"],[78,"ProMarket","ProMarket"],[117,"Randi OOD","Randi%20OOD"],[33,"Remedium","Remedium"],[20,"Rila Market","Rila%20Market"],[135,"Siko","Siko"],[133,"Stop4eto","Stop4eto"],[61,"Supermarkets CBA","Supermarkets%20cba"],[128,"SOpharmacy","S%D0%9Epharmacy"],[45,"T market","T%20market"],[2,"Technomarket","Technomarket"],[3,"Technopolis","Technopolis"],[155,"TEDi","TEDi"],[40,"Temax","Temax"],[68,"Videnov","Videnov"],[23,"Vivacom","Vivacom"],[5,"Zora","Zora"],[156,"Хасково Маркет","%D0%A5%D0%B0%D1%81%D0%BA%D0%BE%20%D0%9C%D0%B0%D1%80%D0%BA%D0%B5%D1%82"],[37,"Магазин 37","37"],[8,"Магазин 8","8"],[132,"Магазин 132","132"],[150,"Магазин 150","150"],[29,"Магазин 29","29"],[110,"Магазин 110","110"],[82,"Магазин 82","82"],[70,"Магазин 70","70"]
] as const;

let stores: Store[] = fallbackSlugs.map(([id, name, slug], i) => ({ order: i + 1, id: String(id), name, url: `https://katalozi-bg.info/company/${id}/${slug}`, logo: `https://katalozi-bg.info/img/logos/${id}.jpg`, active: i < 58 }));
let brochures: Brochure[] = [];
let offers: Offer[] = [];
const pageOcrCache = new Map<string, Offer[]>();
let syncState: SyncState = { status: "idle", stage: "Готово за синхронизация", storesProcessed: 0, brochuresProcessed: 0, offersProcessed: 0, message: "Все още няма стартирано обновяване." };
let syncPromise: Promise<void> | null = null;

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
export const matchesQuery = (value: string, query: string) => normalize(value).toLocaleLowerCase("bg-BG").includes(normalize(query).toLocaleLowerCase("bg-BG"));
export const formatPrice = (value: number) => value.toFixed(2).replace(".", ",");
export const formatPriceLabel = (primary: number, secondary?: number) => secondary === undefined ? `${formatPrice(primary)} лв.` : `${formatPrice(primary)} лв. / ${formatPrice(secondary)} лв.`;
const periodFromTitle = (title: string): OfferPeriod => {
  const now = new Date();
  if (/до|изтек|минал|expired/i.test(title)) return "ended";
  const match = title.match(/(\d{1,2})\s*(?:ноем|окт|дек|яну|фев|март|апр|май|юни|юли|авг|септ)/i);
  if (match && Number(match[1]) > now.getDate()) return "next-week";
  return "this-week";
};

function extractPageUrls(html: string, baseUrl: string) {
  const urls = [...html.matchAll(/<(?:img|source)[^>]+(?:src|data-src|srcset)=["']([^"']+)["']/gi)]
    .map(match => match[1].split(",")[0].trim().split(" ")[0])
    .filter(value => /\/catalogs\/\d+\/small\/\d+\.(?:jpg|jpeg|png)/i.test(value));
  return [...new Set(urls.map(value => new URL(value, baseUrl).href.replace(/\/small\/(\d+)\.(jpg|jpeg|png)$/i, "/$1.$2")))];
}

export const thumbnailForPage = (pageUrl: string) => /\/small\/\d+\.(?:jpg|jpeg|png)$/i.test(pageUrl) ? pageUrl : pageUrl.replace(/\/(\d+)\.(jpg|jpeg|png)$/i, "/small/$1.$2");

export function parseCatalogPrice(line: string) {
  const hasCurrency = /лв\.?|лева?|€|eur(?:o)?|евро/i.test(line);
  const hasDecimal = /\d{1,4}[.,]\d{2}/.test(line);
  if (!hasCurrency && (!hasDecimal || /\d{1,2}[./]\d{1,2}|20\d{2}/.test(line))) return undefined;
  const matches = [...line.matchAll(/(\d{1,4}(?:[.,]\d{1,2})?)(?!\s*%)\s*(лв\.?|лева?|€|eur(?:o)?|евро)?/gi)]
    .map(match => ({ value: Number(match[1].replace(",", ".")), currency: /€|eur|евро/i.test(match[2] || "") ? "EUR" as const : /лв|лев/i.test(match[2] || "") ? "BGN" as const : undefined }));
  const values = matches.filter(value => value.value > 0 && value.value < 100000);
  if (!values.length) return undefined;
  const pricedValues = values.some(value => value.currency) ? values.filter(value => value.currency) : values;
  const primary = pricedValues[0];
  const secondary = pricedValues.length > 1 ? pricedValues[1] : undefined;
  const label = [primary, secondary].filter(Boolean).map(value => `${formatPrice(value!.value)}${value!.currency === "EUR" ? " €" : value!.currency === "BGN" ? " лв." : ""}`).join(" / ");
  const price = secondary?.currency === "BGN" ? secondary.value : primary.currency === "EUR" ? Number((primary.value * 1.95583).toFixed(4)) : primary.value;
  return { price, currency: primary.currency, priceLabel: label };
}

export function extractPageOffers(text: string, brochure: Brochure, storeName: string, pageUrl: string) {
  const lines = text.split(/\r?\n/).map(normalize).filter(line => line.length >= 2);
  return lines.flatMap((line, index) => {
    const price = parseCatalogPrice(line);
    if (!price) return [];
    const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ");
    const hasCurrency = /лв\.?|лева?|€|eur(?:o)?|евро/i.test(line);
    const product = normalize(line.replace(hasCurrency ? /\d{1,4}(?:[.,]\d{1,2})?\s*(?:лв\.?|лева?|€|eur(?:o)?|евро)/gi : /\d{1,4}[.,]\d{2}/gi, " ")) || normalize(lines[index - 1] || `Продукт от страница ${pageUrl.split("/").pop()}`);
    if (!/[А-Яа-яA-Za-z]{3}/.test(product)) return [];
    return [{ id: `${brochure.id}-${pageUrl.split("/").pop()}-${index}`, product, searchText: context, storeId: brochure.storeId, storeName, price: price.price, currency: price.currency, priceLabel: price.priceLabel, unit: "бр.", period: brochure.period, validLabel: brochure.rawDate || "актуална брошура", brochureUrl: brochure.url, pageUrl, source: sourceUrl, imageUrl: thumbnailForPage(pageUrl) }];
  });
}

async function ocrImage(imageUrl: string) {
  const dir = await mkdtemp(join(tmpdir(), "ofertix-ocr-"));
  const imagePath = join(dir, "page.jpg");
  try {
    const response = await fetch(imageUrl);
    await writeFile(imagePath, Buffer.from(await response.arrayBuffer()));
    const result = await execFileAsync("tesseract", [imagePath, "stdout", "-l", "bul+eng", "--psm", "11"], { maxBuffer: 4_000_000, timeout: 45_000 });
    return result.stdout;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

export function firstImageUrl(html: string, baseUrl: string) {
  const candidates = [...html.matchAll(/<(?:img|source)[^>]+(?:src|data-src|srcset)=["']([^"']+)["']/gi)]
    .map(match => match[1].split(",")[0].trim().split(" ")[0])
    .filter(value => value && !value.startsWith("data:") && !/logo|app-logo|icon|avatar|available-on|en_generic|store-badge/i.test(value));
  const catalogPage = candidates.find(value => /\/catalogs\/\d+\/small\/\d+\.(?:jpg|jpeg|png)/i.test(value));
  return catalogPage ? new URL(catalogPage, baseUrl).href : candidates[0] ? new URL(candidates[0], baseUrl).href : undefined;
}

export async function syncCatalog() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const startedAt = new Date().toISOString();
    syncState = { status: "running", stage: "Чета списъка с магазини…", startedAt, storesProcessed: 0, brochuresProcessed: 0, offersProcessed: 0, message: "" };
    try {
      const html = await fetch(sourceUrl).then(r => r.text());
      const parsed: Store[] = [];
      const links = [...html.matchAll(/<a[^>]+href=["']([^"']*\/company\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      links.forEach((match) => {
        const href = match[1];
        if (!href || parsed.some(s => s.url === href)) return;
        const companyMatch = href.match(/\/company\/(\d+)(?:\/([^?#]+))?/i);
        if (!companyMatch) return;
        const id = companyMatch[1];
        const fallback = fallbackSlugs.find(item => String(item[0]) === id);
        const slug = companyMatch[2] ? decodeURIComponent(companyMatch[2]) : "";
        const name = normalize(slug.replace(/[._-]+/g, " ")) || fallback?.[1] || `Магазин ${id}`;
        parsed.push({ order: parsed.length + 1, id, name: name.replace(/\b\w/g, c => c.toUpperCase()), url: new URL(href, sourceUrl).href, logo: `https://katalozi-bg.info/img/logos/${id}.jpg`, active: true });
      });
      if (parsed.length >= 10) {
        const parsedById = new Map(parsed.map(store => [store.id, store]));
        stores = fallbackSlugs.map(([id, name, slug], i) => parsedById.get(String(id)) || { order: i + 1, id: String(id), name, url: `https://katalozi-bg.info/company/${id}/${slug}`, logo: `https://katalozi-bg.info/img/logos/${id}.jpg`, active: true });
      }
      const nextBrochures: Brochure[] = [];
      let cursor = 0;
      const worker = async () => {
        while (cursor < stores.length) {
          const store = stores[cursor++];
          syncState = { ...syncState, stage: `Чета каталозите на ${store.name}…`, storesProcessed: Math.min(stores.length, cursor) };
          try {
            const page = await fetch(store.url).then(r => r.text());
            const catalogLinks = [...page.matchAll(/<a[^>]+href=["']([^"']*\/catalogs\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
            catalogLinks.forEach((match, i) => {
              const url = new URL(match[1], store.url).href;
              const title = normalize(match[2].replace(/<[^>]+>/g, " ")) || `Каталог ${i + 1}`;
              if (!nextBrochures.some(b => b.url === url)) nextBrochures.push({ id: `${store.id}-${i}`, storeId: store.id, title, url, period: periodFromTitle(title), rawDate: title, pageUrls: [] });
            });
          } catch { /* one unavailable store should not cancel the full sync */ }
        }
      };
      await Promise.all(Array.from({ length: 8 }, () => worker()));
      let brochureCursor = 0;
      const brochureWorker = async () => {
        while (brochureCursor < nextBrochures.length) {
          const brochure = nextBrochures[brochureCursor++];
          try {
            const brochureHtml = await fetch(brochure.url).then(r => r.text());
            brochure.pageUrls = extractPageUrls(brochureHtml, brochure.url);
            brochure.thumbnailUrl = brochure.pageUrls[0] ? thumbnailForPage(brochure.pageUrls[0]) : firstImageUrl(brochureHtml, brochure.url);
          } catch { /* keep the brochure usable even when its preview image is unavailable */ }
        }
      };
      await Promise.all(Array.from({ length: 8 }, () => brochureWorker()));
      brochures = nextBrochures;
      syncState = { ...syncState, brochuresProcessed: brochures.length };
      const pages = brochures.flatMap(brochure => brochure.pageUrls.map(pageUrl => ({ brochure, pageUrl })));
      const extractedOffers: Offer[] = [];
      let pageCursor = 0;
      const ocrWorker = async () => {
        while (pageCursor < pages.length) {
          const current = pages[pageCursor++];
          syncState = { ...syncState, stage: `Разчитам продуктите от страница ${pageCursor}/${pages.length}…` };
          try {
            const storeName = stores.find(store => store.id === current.brochure.storeId)?.name || `Магазин ${current.brochure.storeId}`;
            const cached = pageOcrCache.get(current.pageUrl);
            const pageOffers = cached || extractPageOffers(await ocrImage(current.pageUrl), current.brochure, storeName, current.pageUrl);
            pageOcrCache.set(current.pageUrl, pageOffers);
            extractedOffers.push(...pageOffers);
            syncState = { ...syncState, offersProcessed: extractedOffers.length };
          } catch { /* keep the page available even if OCR fails for one image */ }
        }
      };
      const ocrWorkers = Math.min(3, Math.max(1, Number(process.env.OCR_WORKERS || 3)));
      await Promise.all(Array.from({ length: ocrWorkers }, () => ocrWorker()));
      offers = extractedOffers;
      syncState = { status: "success", stage: "Синхронизацията завърши", startedAt, finishedAt: new Date().toISOString(), storesProcessed: stores.length, brochuresProcessed: brochures.length, offersProcessed: offers.length, message: `Заредени са ${stores.length} магазина и ${brochures.length} каталога.` };
    } catch (error) {
      syncState = { ...syncState, status: "error", stage: "Синхронизацията прекъсна", finishedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "Неочаквана грешка" };
    } finally { syncPromise = null; }
  })();
  return syncPromise;
}

export function getCatalog(query = "", period = "all", sort = "price-asc") {
  let result = offers.filter(o => !query || matchesQuery(o.product, query) || matchesQuery(o.searchText, query) || matchesQuery(o.storeName, query));
  if (period !== "all") result = result.filter(o => o.period === period);
  result = [...result].sort((a, b) => sort === "price-desc" ? b.price - a.price : a.price - b.price);
  return { stores, brochures, offers: result.map((o, i) => ({ ...o, cheapest: i === 0 && sort !== "price-desc" })), sync: syncState, source: sourceUrl };
}

export function getSyncState() { return syncState; }
export function startSync() { return syncCatalog(); }

offers = [];
