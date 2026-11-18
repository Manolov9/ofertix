import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getCatalog, getSyncState, hydrateCatalog, searchSourceCatalogs, startSync } from "../catalog";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/catalog", (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const period = typeof req.query.period === "string" ? req.query.period : "all";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "price-asc";
    void (async () => {
      const sourceMatches = query ? await searchSourceCatalogs(query) : [];
      const local = getCatalog(query, period, sort);
      const sourceOffers = sourceMatches.flatMap(match => {
        const hits = match.sourceHits?.length ? match.sourceHits : [{ id: `${match.id}-${match.page}`, page: match.page, text: match.sourceText || query, price: match.sourcePrice, priceLabel: match.sourcePriceLabel }];
        return hits.map(hit => ({
          id: `source-${match.id}-${hit.id}`,
          product: hit.text,
          searchText: hit.text,
          storeId: `source-${match.storeName}`,
          storeName: match.storeName,
          price: hit.price ?? Number.POSITIVE_INFINITY,
          priceLabel: hit.priceLabel || "Цена в каталога",
          unit: "бр.",
          period: match.period,
          validLabel: match.expirationDate ? `до ${match.expirationDate.slice(0, 10)}` : "актуална брошура",
          brochureUrl: match.url,
          pageUrl: `https://katalozi-bg.info/catalogs/${match.id}/${hit.page}.jpg`,
          source: "https://katalozi-bg.info/companies",
          imageUrl: `https://katalozi-bg.info/catalogs/${match.id}/small/${hit.page}.jpg`,
        }));
      }).filter(offer => period === "all" || offer.period === period).sort((a, b) => sort === "price-desc" ? b.price - a.price : a.price - b.price);
      const offers = getSyncState().status === "success" && local.offers.length ? local.offers : sourceOffers.length ? sourceOffers : local.offers;
      res.json({ ...local, offers, sourceMatches });
    })().catch(error => res.status(502).json({ error: error instanceof Error ? error.message : "Source search failed" }));
  });
  app.get("/api/sync/status", (_req, res) => res.json(getSyncState()));
  app.post("/api/sync", (_req, res) => {
    const state = getSyncState();
    if (state.status === "running") return res.status(409).json(state);
    void startSync();
    res.status(202).json(getSyncState());
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  await hydrateCatalog();

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
