import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, ExternalLink, Search, Store as StoreIcon, Trophy, X, Zap } from "lucide-react";
import { CategoryFilter } from "@/components/CategoryFilter";
import { isCatalogCategoryId, type CatalogCategoryFilter } from "@shared/catalog-categories";

type Offer = {
  id: string;
  product: string;
  searchText: string;
  storeId: string;
  storeName: string;
  price: number;
  priceLabel: string;
  period: string;
  brochureUrl: string;
  pageUrl: string;
};
type SourceMatch = {
  id: string;
  url: string;
  query: string;
  page: number;
  imageUrl: string;
  coverImageUrl: string;
  pageUrl: string;
  storeName: string;
  catalogTitle: string;
  hits: number;
  expirationDate: string;
  statusLabel: string;
  period: string;
};
type Store = { order: number; id: string; name: string; url: string; logo: string; active: boolean };

const periodLabels: Record<string, string> = {
  all: "Всички периоди",
  "this-week": "Тази седмица",
  "next-week": "Другата седмица",
  ended: "Приключили",
};

const quickSearches = ["кафе", "dolce gusto", "кока кола", "кисело мляко"];

export default function Home() {
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || params.get("query") || "";
  });
  const [period, setPeriod] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [category, setCategory] = useState<CatalogCategoryFilter>(() => {
    const value = new URLSearchParams(window.location.search).get("category");
    return isCatalogCategoryId(value) ? value : "all";
  });
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sourceMatches, setSourceMatches] = useState<SourceMatch[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeCatalog, setActiveCatalog] = useState<SourceMatch | null>(null);
  const loadTimerRef = useRef<number | undefined>(undefined);
  const requestSequenceRef = useRef(0);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q: query, period, sort: "price-asc" });
    if (category !== "all") params.set("category", category);
    const requestId = ++requestSequenceRef.current;
    setLoadingResults(Boolean(query.trim()));
    setSearchError("");
    try {
      const response = await fetch(`/api/catalog?${params}`);
      const data = await response.json();
      if (requestId !== requestSequenceRef.current) return;
      if (!response.ok) throw new Error(data.error || "Каталозите не могат да бъдат заредени.");
      setOffers(data.offers || []);
      setSourceMatches(data.sourceMatches || []);
      setStores(data.stores || []);
    } catch {
      if (requestId === requestSequenceRef.current) {
        setOffers([]);
        setSourceMatches([]);
        setSearchError("Каталозите временно не отговарят. Опитай отново след малко.");
      }
    } finally {
      if (requestId === requestSequenceRef.current) setLoadingResults(false);
    }
  }, [query, period, category]);

  useEffect(() => {
    requestSequenceRef.current += 1;
    if (query.trim()) setLoadingResults(true);
    loadTimerRef.current = window.setTimeout(() => void load(), query.trim() ? 300 : 0);
    return () => {
      if (loadTimerRef.current !== undefined) window.clearTimeout(loadTimerRef.current);
    };
  }, [load, query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("q");
    if (query.trim()) params.set("query", query.trim());
    else params.delete("query");
    if (category === "all") params.delete("category");
    else params.set("category", category);
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
  }, [query, category]);

  useEffect(() => {
    if (!activeCatalog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveCatalog(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeCatalog]);

  const visibleSourceMatches = useMemo(() => sourceMatches.filter(match =>
    (period === "all" || match.period === period) &&
    (storeFilter === "all" || match.storeName === storeFilter)
  ), [sourceMatches, period, storeFilter]);

  // The live source price drives both the summary and the existing „НАЙ-ЕВТИНО“ badge.
  const visiblePriceOffers = useMemo(() => offers
    .filter(offer => Number.isFinite(offer.price) && Boolean(offer.priceLabel) && offer.priceLabel !== "Цена в каталога")
    .filter(offer => (period === "all" || offer.period === period) && (storeFilter === "all" || offer.storeName === storeFilter))
    .sort((a, b) => a.price - b.price), [offers, period, storeFilter]);
  const lowestPriceOffer = visiblePriceOffers[0];
  const cheapestCatalogIds = useMemo(() => new Set(lowestPriceOffer
    ? visiblePriceOffers
        .filter(offer => offer.price === lowestPriceOffer.price)
        .map(offer => offer.pageUrl.match(/\/catalogs\/(\d+)\//)?.[1])
        .filter((id): id is string => Boolean(id))
    : []), [visiblePriceOffers, lowestPriceOffer]);

  const sourceStores = useMemo(() => [...new Set(sourceMatches.map(match => match.storeName))], [sourceMatches]);
  const shownStores = stores.slice(0, 14);

  const submitSearch = () => {
    if (loadTimerRef.current !== undefined) window.clearTimeout(loadTimerRef.current);
    void load();
  };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">≋</span><span>ОФЕРТИКС</span><small>намери офертата</small></div>
      <div className="source-chip"><span className="live-dot" /> Източник: katalozi-bg.info <a href="https://katalozi-bg.info/companies" target="_blank" rel="noreferrer" aria-label="Отвори източника"><ExternalLink size={13} /></a></div>
    </header>

    <main className="dashboard">
      <section className="search-zone">
        <div className="eyebrow"><Zap size={14} /> АКТУАЛНИ ДАННИ ОТ КАТАЛОЗИТЕ</div>
        <h1>Търси веднъж.<br /><em>Виж навсякъде.</em></h1>
        <p className="lede">Намери продукта в активните брошури и отвори оригиналната страница в прозорец тук.</p>
        <div className="search-box">
          <Search size={22} />
          <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submitSearch(); }} placeholder="Напр. кафе, dolce gusto, кока кола…" />
          <kbd>⌘ K</kbd>
          <button onClick={submitSearch} aria-label="Търси"><ChevronRight size={22} /></button>
        </div>
        <div className="quick-searches"><span>Бързо търсене:</span>{quickSearches.map(item => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
        <details className="usage-guide">
          <summary>Как се използва сайтът?</summary>
          <div>
            <p><b>1. Търси директно в каталозите.</b> Заявката отива към katalozi-bg.info и връща актуалните брошури.</p>
            <p><b>2. Филтрирай резултатите.</b> Избери магазин, категория или период, за да стесниш брошурите.</p>
            <p><b>3. Виж брошурата тук.</b> Натисни картата за преглед на страницата с попадението в прозорец; можеш да го затвориш или отделно да отвориш оригиналния резултат.</p>
          </div>
        </details>
      </section>

      <section className="metrics">
        <div><span>КАТАЛОЖНИ ИЗТОЧНИЦИ</span><strong>{stores.length || 66}</strong><small>в каталожния сайт</small></div>
        <div><span>НАМЕРЕНИ БРОШУРИ</span><strong>{query.trim() && !loadingResults ? visibleSourceMatches.length : "—"}</strong><small>текущо търсене</small></div>
        <div className="best-price-metric"><span>НАЙ-НИСКА ЦЕНА</span><strong>{query.trim() && !loadingResults ? lowestPriceOffer?.priceLabel || "—" : "—"}</strong><small>{query.trim() && !loadingResults ? lowestPriceOffer ? `от ${lowestPriceOffer.storeName}` : "няма разпозната цена" : "задай търсене"}</small></div>
      </section>

      <div className="content-grid">
        <section className="results-panel">
          <div className="section-head">
            <div><p className="eyebrow">РЕЗУЛТАТИ {query && <span className="query-pill">„{query}“</span>}</p><h2>Брошури <span className="result-count">{query && !loadingResults ? visibleSourceMatches.length : ""}</span></h2></div>
            <div className="controls">
              <select value={storeFilter} onChange={event => setStoreFilter(event.target.value)}><option value="all">По магазин</option>{sourceStores.map(store => <option value={store} key={store}>{store}</option>)}</select>
              <CategoryFilter value={category} onChange={setCategory} />
              <select value={period} onChange={event => setPeriod(event.target.value)}>{Object.entries(periodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
            </div>
          </div>

          {loadingResults ? <div className="empty"><Search size={30} /><h3>Търся в каталозите…</h3><p>Зареждам директните съвпадения от избраната категория.</p></div>
            : searchError ? <div className="empty search-error"><Search size={30} /><h3>Външният каталог временно не отговаря</h3><p>{searchError}</p><button className="retry-search" onClick={submitSearch}>Опитай отново</button></div>
            : visibleSourceMatches.length > 0 ? <div className="source-card-grid">{visibleSourceMatches.map(match => {
              const isCheapest = cheapestCatalogIds.has(match.id);
              const expirationDate = match.expirationDate.replace(" ", "T");
              const expirationTime = Date.parse(expirationDate.endsWith("Z") ? expirationDate : `${expirationDate}Z`);
              const daysRemaining = Number.isFinite(expirationTime) ? Math.ceil((expirationTime - Date.now()) / 86_400_000) : 0;
              return <button type="button" className={`source-card ${isCheapest ? "is-cheapest" : ""}`} onClick={() => setActiveCatalog(match)} aria-label={`Преглед на ${match.storeName}, страница ${match.page}`} key={match.id}>
                <div className="source-card-image">
                  <img src={match.imageUrl} alt={`${match.storeName} — страница ${match.page}`} loading="lazy" />
                  <img className="source-cover-thumb" src={match.coverImageUrl} alt="" loading="lazy" />
                  <span className="page-tag">Стр. {match.page}</span>
                  {match.hits > 1 && <span className="more-hits">Още {match.hits - 1} резултата</span>}
                  {daysRemaining > 1 && <span className="source-days">още {daysRemaining} дни</span>}
                  <span className={`source-status ${match.period}`}>{match.statusLabel}</span>
                  {isCheapest && <span className="cheapest-card-badge"><Trophy size={12} /> НАЙ-ЕВТИНО</span>}
                </div>
                <div className="source-card-body"><strong>{match.storeName}</strong><span>{match.catalogTitle}</span><small>{match.expirationDate ? `до ${match.expirationDate.slice(0, 10)}` : "Актуален каталог"} <ChevronRight size={13} /></small></div>
              </button>;
            })}</div>
            : <div className="empty"><Search size={30} /><h3>{query ? "Няма намерени каталози" : "Въведи продукт за търсене"}</h3><p>{query ? "Няма съвпадение за избраните категория, период и магазин." : "Например „кафе“ или „dolce gusto“ — резултатите ще се заредят директно от каталозите."}</p></div>}
        </section>

        <aside className="side-rail">
          <section className="source-info-card"><p className="eyebrow"><span className="live-dot" /> ДИРЕКТЕН ИЗТОЧНИК</p><h3>katalozi-bg.info</h3><p>Търсенето и брошурите се зареждат при заявка. Не е нужен локален OCR индекс или ръчна синхронизация.</p><a href="https://katalozi-bg.info/companies" target="_blank" rel="noreferrer">Отвори каталозите <ExternalLink size={14} /></a></section>
          <section className="stores-card"><div className="rail-title"><div><p className="eyebrow">ИЗТОЧНИК</p><h3>Магазини <span>{stores.length}</span></h3></div><StoreIcon size={18} /></div><div className="store-list">{shownStores.map(store => <a href={store.url} target="_blank" rel="noreferrer" key={store.id}><span className="store-index">{String(store.order).padStart(2, "0")}</span><img src={store.logo} alt="" /><span>{store.name}</span>{store.active && <Check size={14} />}</a>)}</div><a className="all-stores" href="https://katalozi-bg.info/companies" target="_blank" rel="noreferrer">Виж всички {stores.length || 66} магазина <ChevronRight size={15} /></a></section>
        </aside>
      </div>
    </main>

    {activeCatalog && <div className="catalog-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setActiveCatalog(null); }}>
      <section className="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title">
        <header className="catalog-modal-header">
          <div className="catalog-modal-heading"><p className="eyebrow">БРОШУРА · СТР. {activeCatalog.page}</p><h2 id="catalog-modal-title">{activeCatalog.storeName}</h2><span>{activeCatalog.catalogTitle}</span></div>
          <button className="catalog-modal-close" type="button" onClick={() => setActiveCatalog(null)} aria-label="Затвори прегледа"><X size={22} /></button>
        </header>
        <div className="catalog-modal-image-wrap"><img className="catalog-modal-image" src={activeCatalog.pageUrl || activeCatalog.imageUrl} onError={event => { const image = event.currentTarget; if (image.src !== activeCatalog.imageUrl) image.src = activeCatalog.imageUrl; }} alt={`${activeCatalog.storeName}, страница ${activeCatalog.page}`} /></div>
        <footer className="catalog-modal-footer"><span>{activeCatalog.expirationDate ? `Валидност до ${activeCatalog.expirationDate.slice(0, 10)}` : activeCatalog.statusLabel}</span><a href={activeCatalog.url} target="_blank" rel="noreferrer">Отвори оригинала <ExternalLink size={14} /></a></footer>
      </section>
    </div>}

    <footer><span>ОФЕРТИКС / 2026</span><span>Данните се зареждат динамично от katalozi-bg.info</span><span>API: /api/catalog</span></footer>
  </div>;
}
