import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, CalendarDays, Check, ChevronRight, ExternalLink, Loader2, RefreshCw, Search, Store as StoreIcon, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type Offer = { id: string; product: string; searchText: string; storeId: string; storeName: string; price: number; currency?: string; priceLabel: string; unit: string; period: string; validLabel: string; brochureUrl: string; pageUrl: string; imageUrl?: string; cheapest?: boolean };
type Store = { order: number; id: string; name: string; url: string; logo: string; active: boolean };
type Sync = { status: string; stage: string; startedAt?: string; finishedAt?: string; storesProcessed: number; brochuresProcessed: number; offersProcessed: number; message: string };
const periodLabels: Record<string, string> = { all: "Всички периоди", "this-week": "Тази седмица", "next-week": "Другата седмица", ended: "Приключили" };
const periodTone: Record<string, string> = { "this-week": "bg-lime-300/15 text-lime-300", "next-week": "bg-sky-300/15 text-sky-300", ended: "bg-slate-700 text-slate-300" };
const formatEta = (sync: Sync) => {
  if (sync.status !== "running" || !sync.startedAt) return "";
  const match = sync.stage.match(/страница (\d+)\/(\d+)/i);
  if (!match) return "Изчислявам ориентировъчно време…";
  const done = Number(match[1]); const total = Number(match[2]); const elapsed = (Date.now() - new Date(sync.startedAt).getTime()) / 1000;
  if (done < 2 || elapsed <= 0) return "Изчислявам ориентировъчно време…";
  const remaining = Math.max(0, Math.round((total - done) * (elapsed / done)));
  if (remaining < 90) return "Остават приблизително под 2 минути";
  const minutes = Math.ceil(remaining / 60);
  return minutes < 60 ? `Остават приблизително ${minutes} мин.` : `Остават приблизително ${Math.ceil(minutes / 60)} ч. ${minutes % 60} мин.`;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("price-asc");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [sync, setSync] = useState<Sync>({ status: "idle", stage: "Готово за синхронизация", storesProcessed: 0, brochuresProcessed: 0, offersProcessed: 0, message: "" });
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const params = new URLSearchParams({ q: query, period, sort });
    const data = await fetch(`/api/catalog?${params}`).then(r => r.json());
    setOffers(data.offers); setStores(data.stores); setSync(data.sync);
  };
  useEffect(() => { void load(); }, [query, period, sort]);
  useEffect(() => {
    if (!syncing) return;
    const timer = window.setInterval(async () => {
      const state = await fetch("/api/sync/status").then(r => r.json());
      setSync(state);
      if (state.status !== "running") { setSyncing(false); void load(); }
    }, 900);
    return () => window.clearInterval(timer);
  }, [syncing]);

  const runSync = async () => { setSyncing(true); const response = await fetch("/api/sync", { method: "POST" }); if (!response.ok) { setSyncing(false); void load(); } };
  const cheapest = useMemo(() => { const priced = offers.map(o => o.price).filter(Number.isFinite); return priced.length ? Math.min(...priced) : 0; }, [offers]);
  const shownStores = stores.slice(0, 14);

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">≋</span><span>ОФЕРТИКС</span><small>сравни цената</small></div><div className="source-chip"><span className="live-dot" /> Източник: katalozi-bg.info <a href="https://katalozi-bg.info/companies" target="_blank" rel="noreferrer"><ExternalLink size={13} /></a></div></header>
    <main className="dashboard">
      <section className="search-zone"><div className="eyebrow"><Zap size={14} /> ЦЕНИТЕ НА ЕДНО МЯСТО</div><h1>Търси веднъж.<br /><em>Сравни навсякъде.</em></h1><p className="lede">Въведи продукт и виж къде е най-изгоден в актуалните брошури.</p><div className="search-box"><Search size={22} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Напр. кафе, масло, шампоан…" /><kbd>⌘ K</kbd><button onClick={() => void load()} aria-label="Търси"><ChevronRight size={22} /></button></div><div className="quick-searches"><span>Бързо търсене:</span>{["кафе", "мляко", "перилен препарат"].map(item => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div></section>
      <section className="metrics"><div><span>МАГАЗИНИ</span><strong>{stores.length || 66}</strong><small>в изходен ред</small></div><div><span>КАТАЛОЗИ</span><strong>{sync.brochuresProcessed || "—"}</strong><small>последно зареждане</small></div><div><span>НАЙ-ДОБРА ЦЕНА</span><strong>{cheapest ? `${cheapest.toFixed(2)} лв.` : "—"}</strong><small>в текущите резултати</small></div></section>
      <div className="content-grid"><section className="results-panel"><div className="section-head"><div><p className="eyebrow">РЕЗУЛТАТИ {query && <span className="query-pill">„{query}“</span>}</p><h2>Оферти от всички магазини <span className="result-count">{query ? offers.length : ""}</span></h2></div><div className="controls"><select value={period} onChange={e => setPeriod(e.target.value)}>{Object.entries(periodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="sort-btn" onClick={() => setSort(sort === "price-asc" ? "price-desc" : "price-asc")}><ArrowDownUp size={15} /> Цена {sort === "price-asc" ? "↑" : "↓"}</button></div></div>{offers.length === 0 ? <div className="empty"><Search size={30} /><h3>{sync.status === "idle" ? "Няма зареден продуктов индекс" : "Няма намерени оферти"}</h3><p>{sync.status === "idle" ? "Натисни „Синхронизирай“, за да се разчетат всички страници на брошурите." : "Първите резултати ще се появят след завършването на първите OCR партиди."}</p></div> : <div className="offer-list">{offers.map((offer, index) => <article className={`offer-card ${Number.isFinite(offer.price) && offer.price === cheapest && sort === "price-asc" ? "winner" : ""}`} key={offer.id}><div className="rank">{String(index + 1).padStart(2, "0")}</div><div className="offer-thumb">{offer.imageUrl ? <img src={offer.imageUrl} alt={`Преглед на ${offer.product}`} loading="lazy" /> : <span>без<br />снимка</span>}</div><div className="offer-main"><div className="offer-title-row"><h3>{offer.product}</h3>{Number.isFinite(offer.price) && offer.price === cheapest && sort === "price-asc" && <span className="best-badge"><Trophy size={13} /> НАЙ-ЕВТИНО</span>}</div><div className="offer-meta"><span className="store-name"><StoreIcon size={14} /> {offer.storeName}</span><span className={`period-badge ${periodTone[offer.period]}`}><CalendarDays size={13} /> {offer.validLabel}</span></div></div><div className="price"><strong>{offer.priceLabel}</strong></div><a className="view-link" href={offer.pageUrl} target="_blank" rel="noreferrer">Виж <ExternalLink size={14} /></a></article>)}</div>}</section>
        <aside className="side-rail"><section className="sync-card"><div className="rail-title"><div><p className="eyebrow">РЪЧНО ОБНОВЯВАНЕ</p><h3>Дневни брошури</h3></div><RefreshCw className={syncing ? "spin" : ""} size={18} /></div><div className={`sync-status ${sync.status}`}><span className="status-pip" />{sync.stage}</div><div className="sync-progress"><div><span>Магазини</span><b>{sync.storesProcessed}/66</b></div><div className="progress-bar"><i style={{ width: `${Math.min(100, (sync.storesProcessed / 66) * 100)}%` }} /></div></div><p className="sync-message">{sync.status === "running" && sync.offersProcessed ? `Показани са ${sync.offersProcessed} реални оферти от завършените OCR партиди. Търсенето работи веднага и ще се допълва.` : sync.message || "Натисни бутона, за да заредиш актуалните брошури."}</p>{sync.status === "running" && <small className="last-sync">{formatEta(sync)}</small>}<Button className={`sync-button ${syncing ? "syncing" : "ready"}`} onClick={() => void runSync()} disabled={syncing}><RefreshCw size={16} className={syncing ? "spin" : ""} /> {syncing ? "Синхронизиране…" : "Синхронизирай"}</Button>{sync.finishedAt && <small className="last-sync">Последно: {new Date(sync.finishedAt).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}</small>}</section><section className="stores-card"><div className="rail-title"><div><p className="eyebrow">ИЗТОЧНИК</p><h3>Магазини <span>{stores.length}</span></h3></div><StoreIcon size={18} /></div><div className="store-list">{shownStores.map(store => <a href={store.url} target="_blank" rel="noreferrer" key={store.id}><span className="store-index">{String(store.order).padStart(2, "0")}</span><img src={store.logo} alt="" /><span>{store.name}</span>{store.active && <Check size={14} />}</a>)}</div><a className="all-stores" href="https://katalozi-bg.info/companies" target="_blank" rel="noreferrer">Виж всички {stores.length} магазина <ChevronRight size={15} /></a></section></aside>
      </div>
    </main><footer><span>ОФЕРТИКС / 2026</span><span>Данните се зареждат от публичния каталог на katalozi-bg.info</span><span>API: /api/catalog · /api/sync</span></footer>
  </div>;
}
