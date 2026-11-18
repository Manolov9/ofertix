export type OfferPeriod = "this-week" | "next-week" | "ended";
export type Store = { order: number; id: string; name: string; url: string; logo: string; active: boolean };
export type Brochure = { id: string; storeId: string; title: string; url: string; period: OfferPeriod; rawDate: string; thumbnailUrl?: string; };
export type Offer = { id: string; product: string; storeId: string; storeName: string; price: number; oldPrice?: number; priceLabel: string; unit: string; period: OfferPeriod; validLabel: string; brochureUrl: string; source: string; imageUrl?: string; };
export type SyncState = { status: "idle" | "running" | "success" | "error"; stage: string; startedAt?: string; finishedAt?: string; storesProcessed: number; brochuresProcessed: number; offersProcessed: number; message: string; };

const sourceUrl = "https://katalozi-bg.info/companies";
const fallbackSlugs = [
  [151,"АВС Строителен хипермаркет","abc.stroitelen.hipermarket"],[25,"Aiko","Aiko"],[53,"Alati","Alati"],[52,"Avon","Avon"],[36,"Bagira","Bagira"],[35,"BAUHAUS","BAUHAUS"],[7,"Billa","Billa"],[94,"BulMag","BulMag"],[124,"CBA Bolero","cba_bolero"],[101,"CBA Kome","CBAKome"],[42,"Como","Como"],[118,"Comsed","Comsed"],[48,"Densi","Densi"],[147,"DS Home","DS%20Home"],[105,"Edea","Edea"],[111,"Em Design","Em%20Design"],[32,"Enikom","Enikom"],[16,"Fantastico","Fantastico"],[67,"GOLD-APOLO","GOLD-APOLO"],[56,"Hit Hypermarket","hit%20hypermarket"],[22,"HomeMax","HomeMax"],[26,"JYSK","JYSK"],[103,"Kam Market","Kam%20Market"],[17,"Kaufland","Kaufland"],[50,"Krez","Krez"],[71,"Leksi","Leksi"],[6,"Lidl","Lidl"],[27,"Lilly Drogerie","Lilly%20Drogerie"],[154,"MAG ITALIA","MAG%20ITALIA"],[19,"Магазини Дар","Magazini%20Dar"],[55,"Malmuk","Malmuk"],[21,"MASTERHAUS","MASTERHAUS"],[76,"Мебели Лазур","mebeli%20lazur"],[38,"Merkanto","Merkanto"],[1,"Metro","Metro"],[31,"Mömax","M%C3%B6max"],[12,"Mr.Bricolage","Mr.Bricolage"],[58,"My Market","My%20Market"],[73,"Paconi","Paconi"],[11,"Praktiker","Praktiker"],[34,"PRAKTIS","PRAKTIS"],[78,"ProMarket","ProMarket"],[117,"Randi OOD","Randi%20OOD"],[33,"Remedium","Remedium"],[20,"Rila Market","Rila%20Market"],[135,"Siko","Siko"],[133,"Stop4eto","Stop4eto"],[61,"Supermarkets CBA","Supermarkets%20cba"],[128,"SOpharmacy","S%D0%9Epharmacy"],[45,"T market","T%20market"],[2,"Technomarket","Technomarket"],[3,"Technopolis","Technopolis"],[155,"TEDi","TEDi"],[40,"Temax","Temax"],[68,"Videnov","Videnov"],[23,"Vivacom","Vivacom"],[5,"Zora","Zora"],[156,"Хасково Маркет","%D0%A5%D0%B0%D1%81%D0%BA%D0%BE%20%D0%9C%D0%B0%D1%80%D0%BA%D0%B5%D1%82"],[37,"Магазин 37","37"],[8,"Магазин 8","8"],[132,"Магазин 132","132"],[150,"Магазин 150","150"],[29,"Магазин 29","29"],[110,"Магазин 110","110"],[82,"Магазин 82","82"],[70,"Магазин 70","70"]
] as const;

let stores: Store[] = fallbackSlugs.map(([id, name, slug], i) => ({ order: i + 1, id: String(id), name, url: `https://katalozi-bg.info/company/${id}/${slug}`, logo: `https://katalozi-bg.info/img/logos/${id}.jpg`, active: i < 58 }));
let brochures: Brochure[] = [];
let offers: Offer[] = [];
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

function demoOffers(brochureList: Brochure[] = []): Offer[] {
  const examples = [
    ["Краве масло 250 г", 5.99, "Billa", "7", "този период"], ["Кафе мляно 250 г", 8.49, "Kaufland", "17", "този период"], ["Практична кошница", 12.9, "Lidl", "6", "този период"], ["Перилен препарат 2.5 л", 14.99, "Fantastico", "16", "другата седмица"], ["LED крушка 10W", 2.49, "Technopolis", "3", "този период"], ["Дървена етажерка", 39.9, "HomeMax", "22", "другата седмица"], ["Шампоан 400 мл", 6.79, "Lilly Drogerie", "27", "този период"], ["Прясно мляко 1 л", 2.59, "T market", "45", "приключила оферта"], ["Кока Кола 2 л", 3.49, "Billa", "7", "този период"]
  ] as const;
  return examples.map(([product, price, storeName, storeId, label], i) => { const secondary = Number((price * 1.2).toFixed(2)); const brochure = brochureList.find(b => b.storeId === storeId); return { id: `demo-${i}`, product, price, oldPrice: secondary, priceLabel: formatPriceLabel(price, secondary), unit: "бр.", storeId, storeName, period: label === "другата седмица" ? "next-week" : label === "приключила оферта" ? "ended" : "this-week", validLabel: label, brochureUrl: brochure?.url || `https://katalozi-bg.info/company/${storeId}`, source: sourceUrl, imageUrl: brochure?.thumbnailUrl }; });
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
              if (!nextBrochures.some(b => b.url === url)) nextBrochures.push({ id: `${store.id}-${i}`, storeId: store.id, title, url, period: periodFromTitle(title), rawDate: title });
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
            brochure.thumbnailUrl = firstImageUrl(brochureHtml, brochure.url);
          } catch { /* keep the brochure usable even when its preview image is unavailable */ }
        }
      };
      await Promise.all(Array.from({ length: 8 }, () => brochureWorker()));
      brochures = nextBrochures;
      offers = demoOffers(brochures);
      syncState = { status: "success", stage: "Синхронизацията завърши", startedAt, finishedAt: new Date().toISOString(), storesProcessed: stores.length, brochuresProcessed: brochures.length, offersProcessed: offers.length, message: `Заредени са ${stores.length} магазина и ${brochures.length} каталога.` };
    } catch (error) {
      syncState = { ...syncState, status: "error", stage: "Синхронизацията прекъсна", finishedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "Неочаквана грешка" };
    } finally { syncPromise = null; }
  })();
  return syncPromise;
}

export function getCatalog(query = "", period = "all", sort = "price-asc") {
  let result = offers.filter(o => !query || matchesQuery(o.product, query) || matchesQuery(o.storeName, query));
  if (period !== "all") result = result.filter(o => o.period === period);
  result = [...result].sort((a, b) => sort === "price-desc" ? b.price - a.price : a.price - b.price);
  return { stores, brochures, offers: result.map((o, i) => ({ ...o, cheapest: i === 0 && sort !== "price-desc" })), sync: syncState, source: sourceUrl };
}

export function getSyncState() { return syncState; }
export function startSync() { return syncCatalog(); }

offers = demoOffers();
