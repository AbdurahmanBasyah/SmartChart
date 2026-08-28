import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { liquidIDXStocks } from './src/data/mockStocks';
import { fetchYahooStockData } from './src/services/yahooFinance';
import type { StockData, StockUniverseCoverage, StockUniverseItem } from './src/types';
import { normalizeUniverseTicker } from './shared/stockUniverse';
import {
  fetchBrokerDataAccumulation,
  fetchBrokerDataSummary,
  validateBrokerDataAccumulationRequest,
} from './api/_lib/brokerDataClient';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Cache initial stock data in memory
  let stockCache: Map<string, StockData> = new Map();
  const allowExplicitDevMocks = process.env.NODE_ENV !== 'production' && process.env.SMARTCHART_DEV_MOCKS === 'true';

  function cacheStock(stock: StockData): void {
    stockCache.set(stock.ticker.toUpperCase(), stock);
    stockCache.set(stock.symbol.toUpperCase(), stock);
    if (normalizeUniverseTicker(stock.ticker) === 'IHSG') {
      stockCache.set('IHSG', stock);
      stockCache.set('JKSE', stock);
      stockCache.set('^JKSE', stock);
    }
  }

  function compactStock(stock: StockData, source: 'YAHOO' | 'SYNTHETIC'): StockUniverseItem {
    const recommendation = stock.recommendation;
    return {
      symbol: stock.symbol,
      ticker: normalizeUniverseTicker(stock.ticker),
      name: stock.name,
      sector: stock.sector,
      conglomerate: stock.conglomerate,
      currentPrice: stock.currentPrice,
      change24h: stock.change24h,
      changePercent24h: stock.changePercent24h,
      recommendation: {
        structure: recommendation.structure,
        entryZone: recommendation.entryZone,
        stopLoss: recommendation.stopLoss,
        stopLossPercent: recommendation.stopLossPercent,
        takeProfit1: recommendation.takeProfit1,
        takeProfit1Percent: recommendation.takeProfit1Percent,
        takeProfit2: recommendation.takeProfit2,
        takeProfit2Percent: recommendation.takeProfit2Percent,
        riskRewardRatio: recommendation.riskRewardRatio,
        volumeConfirmation: recommendation.volumeConfirmation,
        volumeRatio: recommendation.volumeRatio,
        status: recommendation.status,
        primaryZoneType: recommendation.primaryZoneType,
        primaryZonePrice: recommendation.primaryZonePrice,
        isOnBuyArea: recommendation.isOnBuyArea,
      },
      source,
      isRealData: source === 'YAHOO',
      tradeDate: stock.tradeDate,
      fetchedAt: stock.fetchedAt,
      freshness: 'UNKNOWN',
    };
  }

  function compactCachedUniverse(): {
    items: StockUniverseItem[];
    coverage: StockUniverseCoverage;
    source: 'YAHOO' | 'SYNTHETIC' | 'MIXED' | 'UNKNOWN';
  } {
    const items: StockUniverseItem[] = [];
    for (const config of liquidIDXStocks) {
      const ticker = normalizeUniverseTicker(config.t);
      const stock = stockCache.get(ticker) || (ticker === 'IHSG' ? stockCache.get('^JKSE') : undefined);
      if (!stock || (!allowExplicitDevMocks && stock.isRealData !== true)) continue;
      items.push(compactStock(stock, stock.isRealData === true ? 'YAHOO' : 'SYNTHETIC'));
    }
    const availableTickers = new Set(items.map((item) => item.ticker));
    const expected = liquidIDXStocks.length;
    const sources = new Set(items.map((item) => item.source));
    const logicalDates = items
      .map((item) => item.tradeDate)
      .filter((date): date is string => Boolean(date));
    const source = items.length === 0
      ? 'UNKNOWN'
      : sources.size > 1
      ? 'MIXED'
      : Array.from(sources)[0] as 'YAHOO' | 'SYNTHETIC';
    return {
      items,
      coverage: {
        expected,
        available: items.length,
        missing: liquidIDXStocks
          .map((config) => normalizeUniverseTicker(config.t))
          .filter((ticker) => !availableTickers.has(ticker)),
        partial: items.length < expected,
        asOfDate: logicalDates.sort().at(-1),
        fetchedAt: new Date().toISOString(),
      },
      source,
    };
  }

  async function refreshLocalFallback() {
    if (!allowExplicitDevMocks) return;
    const { getMockStocks } = await import('./src/data/mockStocks');
    const stocks = getMockStocks();
    stocks.forEach((s) => {
      cacheStock(s);
    });
  }

  // Pre-fetch real Yahoo Finance market data in background for liquid IDX tickers
  async function preloadRealMarketData() {
    const allTickers = Array.from(new Set(
      liquidIDXStocks.map((stock) => stock.t === 'IHSG' ? '^JKSE' : stock.t),
    ));
    // Warm the first canonical slice immediately, then continue in bounded
    // batches. The source-of-truth list remains the only ticker population.
    const priorityTickers = allTickers.slice(0, Math.min(30, allTickers.length));
    const remainingTickers = allTickers.slice(priorityTickers.length);

    console.log(`Pre-loading real market data from Yahoo Finance for ${allTickers.length} stocks...`);
    // 1. Fetch primary tickers immediately in parallel
    await Promise.allSettled(
      priorityTickers.map(async (t) => {
        try {
          const realData = await fetchYahooStockData(t);
          if (realData && realData.candles && realData.candles.length > 0) cacheStock(realData);
        } catch (err) {
          console.warn(`Failed preloading priority data for ${t}:`, err);
        }
      })
    );

    // 2. Fetch remaining tickers in concurrent batches
    const batchSize = 8;
    for (let i = 0; i < remainingTickers.length; i += batchSize) {
      const batch = remainingTickers.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (t) => {
          try {
          const realData = await fetchYahooStockData(t);
            if (realData && realData.candles && realData.candles.length > 0) cacheStock(realData);
          } catch (err) {
            console.warn(`Failed preloading data for ${t}:`, err);
          }
        })
      );
    }
    console.log('Real market data pre-loading completed!');
  }

  console.log('Initializing Express app and routes...');
  
  // Populate local stock cache synchronously on boot
  void refreshLocalFallback();

  // No-cache middleware for dynamic API routes
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  const setSuccessfulGetCache = (res: express.Response, maxAge: number, staleWhileRevalidate: number) => {
    res.removeHeader('Pragma');
    res.removeHeader('Expires');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader(
      'Vercel-CDN-Cache-Control',
      `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    );
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get all stocks summary
  app.get('/api/stocks', async (req, res) => {
    const universe = compactCachedUniverse();
    if (universe.items.length === 0 && !allowExplicitDevMocks) {
      return res.status(503).json({
        success: false,
        error: 'REAL_STOCK_DATA_UNAVAILABLE',
        coverage: universe.coverage,
      });
    }
    setSuccessfulGetCache(res, 900, 86400);
    res.json({
      success: true,
      source: universe.source,
      data: universe.items,
      coverage: universe.coverage,
    });
  });

  // Force refresh real data route
  app.post('/api/stocks/refresh', async (req, res) => {
    preloadRealMarketData().catch((err) => console.error('Error refreshing market data:', err));
    const list = Array.from(new Set(Array.from(stockCache.values())));
    res.json({ success: true, count: list.length });
  });

  // Get specific stock data by ticker (supports both /api/stock/:symbol and /api/stock?symbol=...)
  const handleStockRequest = async (req: express.Request, res: express.Response) => {
    const rawSymbol = (req.params.symbol || req.query.symbol || req.query.ticker || 'IHSG') as string;
    let cleanTicker = rawSymbol.trim().toUpperCase().replace('.JK', '');
    if (cleanTicker === 'IHSG' || cleanTicker === 'JKSE' || cleanTicker === '^JKSE') {
      cleanTicker = '^JKSE';
    }
    const yahooSymbol = cleanTicker === '^JKSE' ? '^JKSE' : `${cleanTicker}.JK`;

    // 1. Always attempt to fetch live/delayed Yahoo Finance API data first
    try {
      const realData = await fetchYahooStockData(cleanTicker);
      if (realData && realData.candles && realData.candles.length > 0) {
        cacheStock(realData);
        if (cleanTicker === '^JKSE') {
          stockCache.set('IHSG', realData);
          stockCache.set('JKSE', realData);
          stockCache.set('^JKSE', realData);
        }
        setSuccessfulGetCache(res, 300, 3600);
        return res.json(realData);
      }
    } catch (e) {
      console.warn(`Yahoo finance fetch failed for ${yahooSymbol}, using cache or fallback:`, e);
    }

    // 2. Check local cache if Yahoo Finance call failed or rate limited
    const cachedDirect = stockCache.get(cleanTicker);
    if (cachedDirect && (cachedDirect.isRealData === true || allowExplicitDevMocks)) {
      setSuccessfulGetCache(res, 300, 3600);
      return res.json(cachedDirect);
    }
    if (cleanTicker === '^JKSE') {
      const cachedIndex = stockCache.get('^JKSE');
      if (cachedIndex && (cachedIndex.isRealData === true || allowExplicitDevMocks)) {
        setSuccessfulGetCache(res, 300, 3600);
        return res.json(cachedIndex);
      }
      const cachedIhsg = stockCache.get('IHSG');
      if (cachedIhsg && (cachedIhsg.isRealData === true || allowExplicitDevMocks)) {
        setSuccessfulGetCache(res, 300, 3600);
        return res.json(cachedIhsg);
      }
    }

    // Development mocks are only served when explicitly enabled. Production
    // never substitutes a generated ticker or BUMI for an unavailable symbol.
    return res.status(503).json({
        success: false,
        error: 'REAL_STOCK_DATA_UNAVAILABLE',
        ticker: normalizeUniverseTicker(cleanTicker),
      });
  };

  app.get('/api/stock', handleStockRequest);
  app.get('/api/stock/:symbol', handleStockRequest);

  // Screener route
  app.get('/api/screener', (req, res) => {
    const universe = compactCachedUniverse();
    if (universe.items.length === 0 && !allowExplicitDevMocks) {
      return res.status(503).json({
        success: false,
        error: 'REAL_STOCK_DATA_UNAVAILABLE',
        coverage: universe.coverage,
      });
    }

    const { structure, minRr, volumeOnly } = req.query;

    let filtered = universe.items;

    if (structure && structure !== 'ALL') {
      filtered = filtered.filter((s) => s.recommendation.structure === structure);
    }

    if (minRr) {
      const minVal = parseFloat(minRr as string);
      filtered = filtered.filter((s) => s.recommendation.riskRewardRatio >= minVal);
    }

    if (volumeOnly === 'true') {
      filtered = filtered.filter((s) => s.recommendation.volumeConfirmation);
    }

    setSuccessfulGetCache(res, 900, 86400);
    res.json({
      success: true,
      source: universe.source,
      data: filtered,
      filteredCount: filtered.length,
      coverage: universe.coverage,
    });
  });

  // Broker Inventory Data API
  app.get('/api/inventory/:ticker', (req, res) => {
    const rawTicker = req.params.ticker || 'BBCA';
    const ticker = rawTicker.toUpperCase().replace('.JK', '');
    const stock = stockCache.get(ticker) || Array.from(stockCache.values())[0];
    res.json({
      ticker,
      name: stock?.name || ticker,
      currentPrice: stock?.currentPrice || 1000,
    });
  });

  app.get('/api/broker-summary', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    const symbol = String(req.query.symbol || req.query.ticker || '').trim();
    const startDate = String(req.query.start_date || '').trim();
    const endDate = String(req.query.end_date || '').trim();

    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'symbol, start_date, and end_date are required',
      });
    }

    try {
      const data = await fetchBrokerDataSummary({
        symbol,
        startDate,
        endDate,
        brokerLimit: Number(req.query.broker_limit || 20),
        levelLimit: Number(req.query.level_limit || 25),
      });

      setSuccessfulGetCache(res, 300, 3600);
      return res.json({ success: true, source: 'EXTERNAL', data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error';
      console.error(`[broker-summary] ${message}`);
      return res.status(502).json({
        success: false,
        source: 'EXTERNAL',
        error: 'Broker summary is temporarily unavailable',
      });
    }
  });

  app.get('/api/broker-accumulation', async (req, res) => {
    const symbol = String(req.query.symbol || '').trim();
    const startDate = String(req.query.start_date || '').trim();
    const endDate = String(req.query.end_date || '').trim();

    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'symbol, start_date, and end_date are required',
      });
    }

    try {
      validateBrokerDataAccumulationRequest({ symbol, startDate, endDate });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid accumulation request',
      });
    }

    try {
      const data = await fetchBrokerDataAccumulation({ symbol, startDate, endDate });
      setSuccessfulGetCache(res, 300, 3600);
      return res.json({ success: true, source: 'EXTERNAL', data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error';
      console.error(`[broker-accumulation] ${message}`);
      return res.status(502).json({
        success: false,
        source: 'EXTERNAL',
        error: 'Broker accumulation is temporarily unavailable',
      });
    }
  });

  // Official IDX Exchange Member (Anggota Bursa) search API
  const IDX_BROKERS_LIST = [
    // Foreign Institutions
    { Code: 'BK', Name: 'J.P. Morgan Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AK', Name: 'UBS Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'ZP', Name: 'Maybank Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'CS', Name: 'Credit Suisse Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'RX', Name: 'Macquarie Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'KZ', Name: 'CLSA Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'MS', Name: 'Morgan Stanley Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'CG', Name: 'CGS International Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'BQ', Name: 'Korea Investment & Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AI', Name: 'UOB Kay Hian Sekuritas', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'YU', Name: 'CIMB Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'ML', Name: 'Merrill Lynch Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'DB', Name: 'Deutsche Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'DP', Name: 'DBS Vickers Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'GW', Name: 'HSBC Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE' },
    { Code: 'NH', Name: 'NH Korindo Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'NO', Name: 'Nomura Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE' },
    { Code: 'QA', Name: 'Shinhan Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'SW', Name: 'Yuanta Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AG', Name: 'Kiwoom Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AH', Name: 'Shinhan Sekuritas (AH)', Type: 'Foreign', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AL', Name: 'Chailease Sekuritas Indonesia', Type: 'Foreign', Status: 'A', License: 'PPE' },

    // Domestic Institutions
    { Code: 'CC', Name: 'Mandiri Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'NI', Name: 'BNI Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'OD', Name: 'BRI Danareksa Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'DX', Name: 'Bahana Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'SQ', Name: 'BCA Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AO', Name: 'Erdikha Elit Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'LG', Name: 'Trimegah Sekuritas Indonesia Tbk', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'CP', Name: 'KB Valbury Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AZ', Name: 'Sucor Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'GR', Name: 'Panin Sekuritas Tbk', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'DR', Name: 'RHB Sekuritas Indonesia', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'IF', Name: 'Samuel Sekuritas Indonesia', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'HP', Name: 'Henan Putihrai Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'DH', Name: 'Sinarmas Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'KI', Name: 'Ciptadana Sekuritas Asia', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'MI', Name: 'Victoria Sekuritas Indonesia', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'SH', Name: 'MNC Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'EP', Name: 'MNC Sekuritas (Online)', Type: 'Domestic Institution', Status: 'A', License: 'PPE' },
    { Code: 'LS', Name: 'Reliance Sekuritas Indonesia Tbk', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'TP', Name: 'OCBC Sekuritas Indonesia', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'GA', Name: 'IIF Sekuritas Indonesia', Type: 'Domestic Institution', Status: 'A', License: 'PPE' },
    { Code: 'PF', Name: 'Danamon Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE' },
    { Code: 'PP', Name: 'Aldiracita Sekuritas Indonesia', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'PI', Name: 'Pratama Capital Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE' },
    { Code: 'RF', Name: 'Buana Capital Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'RO', Name: 'NISP Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE' },
    { Code: 'SC', Name: 'Danatama Makmur Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'SM', Name: 'Sinar Mas Multifinance Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE' },
    { Code: 'ZR', Name: 'Bumiputera Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },
    { Code: 'BA', Name: 'Bapindo Bumi Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE' },
    { Code: 'BZ', Name: 'Batasa Capital', Type: 'Domestic Institution', Status: 'A', License: 'PPE' },
    { Code: 'DM', Name: 'Danareksa Sekuritas', Type: 'Domestic Institution', Status: 'A', License: 'PPE, PEE' },

    // Retail & Digital Platforms
    { Code: 'XC', Name: 'Ajaib Sekuritas Asia', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'XL', Name: 'Stockbit Sekuritas Digital', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'YP', Name: 'Mirae Asset Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'PD', Name: 'Indo Premier Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'KK', Name: 'Phillip Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'MG', Name: 'Semesta Indovest Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'XA', Name: 'Woori Korindo Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'HD', Name: 'KGI Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'YJ', Name: 'Lotus Andalan Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AN', Name: 'Wanteg Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'AP', Name: 'Pacific Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AR', Name: 'Binaartha Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AT', Name: 'Phintraco Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'AM', Name: 'Amantara Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'AS', Name: 'Asta Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'BB', Name: 'Berdikari Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'BF', Name: 'Inti Fikasa Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'BR', Name: 'Trust Sekuritas (BR)', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'CD', Name: 'Mega Capital Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'DD', Name: 'Indosurya Bersinar Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'DU', Name: 'KAF Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'EL', Name: 'Evergreen Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'ES', Name: 'Ekatoro Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'FO', Name: 'Forte Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'FS', Name: 'Waterfront Sekuritas Indonesia (FS)', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'ID', Name: 'Anugerah Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'IH', Name: 'Pacific 2000 Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'II', Name: 'Danpac Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'IN', Name: 'Investindo Nusantara Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'IP', Name: 'Trust Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'IT', Name: 'Surya Fajar Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'IU', Name: 'Indo Capital Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'JB', Name: 'Jasa Utama Capital Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'KS', Name: 'Kresna Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'KW', Name: 'KOSPIN Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'LH', Name: 'Royal Investium Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'MU', Name: 'Minna Padi Investama Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'PC', Name: 'Panca Global Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'PG', Name: 'Panca Global Kapital Tbk', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'PO', Name: 'Pilarmas Investindo Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'PS', Name: 'Paramitra Alfa Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'RB', Name: 'RHB Sekuritas Indonesia (Retail)', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'RG', Name: 'Profindo Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'RS', Name: 'Yulie Sekuritas Indonesia Tbk', Type: 'Retail', Status: 'A', License: 'PPE, PEE' },
    { Code: 'SA', Name: 'Binaartha Parama Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'SF', Name: 'Surya Fajar Capital Tbk', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'SS', Name: 'Sinarmas Sekuritas (Retail)', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'TF', Name: 'Universal Broker Indonesia Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'TS', Name: 'Dwidana Sakti Sekuritas', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'TX', Name: 'DBS Vickers (Retail)', Type: 'Foreign', Status: 'A', License: 'PPE' },
    { Code: 'US', Name: 'Waterfront Sekuritas Indonesia', Type: 'Retail', Status: 'A', License: 'PPE' },
    { Code: 'VO', Name: 'Victoria Sekuritas (Online)', Type: 'Retail', Status: 'A', License: 'PPE' },
  ];

  const handleBrokerSearch = (req: express.Request, res: express.Response) => {
    const codeQuery = ((req.query.code || req.query.q || '') as string).trim().toUpperCase();
    const nameQuery = ((req.query.name || '') as string).trim().toUpperCase();
    const statusQuery = ((req.query.status || 'A') as string).trim().toUpperCase();

    let filtered = IDX_BROKERS_LIST;
    if (statusQuery && statusQuery !== 'ALL') {
      filtered = filtered.filter((b) => b.Status === statusQuery);
    }
    if (codeQuery) {
      filtered = filtered.filter(
        (b) => b.Code.includes(codeQuery) || b.Name.toUpperCase().includes(codeQuery)
      );
    }
    if (nameQuery) {
      filtered = filtered.filter((b) => b.Name.toUpperCase().includes(nameQuery));
    }

    const start = parseInt((req.query.start as string) || '0', 10) || 0;
    const length = parseInt((req.query.length as string) || '100', 10) || 100;
    const paged = filtered.slice(start, start + length);

    res.json({
      draw: req.query.draw ? parseInt(req.query.draw as string, 10) : 1,
      recordsTotal: IDX_BROKERS_LIST.length,
      recordsFiltered: filtered.length,
      data: paged,
      status: 'success',
    });
  };

  app.get('/ExchangeMember/GetBrokerSearch', handleBrokerSearch);
  app.get('/api/ExchangeMember/GetBrokerSearch', handleBrokerSearch);

  // IDX TradingSummary /GetStockSummary
  const handleStockSummary = (req: express.Request, res: express.Response) => {
    const rawDate = (req.query.date || new Date().toISOString().split('T')[0]) as string;
    const stockCode = ((req.query.stockCode || req.query.code || '') as string).trim().toUpperCase();

    let stockList = Array.from(stockCache.values());
    if (stockCode) {
      stockList = stockList.filter((s) => s.ticker.toUpperCase() === stockCode);
    }

    const data = stockList.map((s) => {
      const candle = s.candles[s.candles.length - 1] || { open: s.currentPrice, high: s.currentPrice, low: s.currentPrice, close: s.currentPrice, volume: 100000 };
      return {
        Date: rawDate,
        StockCode: s.ticker,
        StockName: s.name,
        OpenPrice: candle.open,
        HighPrice: candle.high,
        LowPrice: candle.low,
        ClosingPrice: candle.close,
        Volume: candle.volume,
        Value: candle.volume * candle.close,
        Frequency: Math.round(candle.volume / 250),
      };
    });

    res.json({
      draw: 1,
      recordsTotal: data.length,
      recordsFiltered: data.length,
      data,
      status: 'success',
    });
  };

  app.get('/TradingSummary/GetStockSummary', handleStockSummary);
  app.get('/api/TradingSummary/GetStockSummary', handleStockSummary);

  // IDX TradingSummary /GetBrokerSummary
  const handleBrokerSummary = (req: express.Request, res: express.Response) => {
    const rawDate = (req.query.date || new Date().toISOString().split('T')[0]) as string;
    const brokerCode = ((req.query.brokerCode || req.query.code || '') as string).trim().toUpperCase();

    let brokers = IDX_BROKERS_LIST;
    if (brokerCode) {
      brokers = brokers.filter((b) => b.Code.toUpperCase() === brokerCode);
    }

    const data = brokers.map((b, idx) => {
      const isTopBuy = ['BK', 'AK', 'CC', 'ZP', 'NI', 'OD', 'SQ', 'DX'].includes(b.Code);
      const buyVal = Math.round((isTopBuy ? 80 : 25) * 1e9 + (idx * 3.7e8));
      const sellVal = Math.round((isTopBuy ? 15 : 65) * 1e9 + (idx * 2.1e8));
      const netVal = buyVal - sellVal;

      return {
        Date: rawDate,
        BrokerCode: b.Code,
        BrokerName: b.Name,
        BuyVolume: Math.round(buyVal / 10000),
        BuyValue: buyVal,
        SellVolume: Math.round(sellVal / 10000),
        SellValue: sellVal,
        NetVolume: Math.round(netVal / 10000),
        NetValue: netVal,
      };
    });

    res.json({
      draw: 1,
      recordsTotal: data.length,
      recordsFiltered: data.length,
      data,
      status: 'success',
    });
  };

  app.get('/TradingSummary/GetBrokerSummary', handleBrokerSummary);
  app.get('/api/TradingSummary/GetBrokerSummary', handleBrokerSummary);

  // Vite middleware for dev or Static serve for prod
  if (process.env.NODE_ENV !== 'production') {
    console.log('Creating Vite server middleware...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);

      // Explicit SPA HTML fallback for deep routes (e.g. /analysis/:ticker, /inventory/:ticker)
      app.use(async (req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
          try {
            const fs = await import('fs');
            const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
            let template = fs.readFileSync(indexHtmlPath, 'utf-8');
            template = await vite.transformIndexHtml(req.originalUrl, template);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
          } catch (e) {
            next(e);
          }
        } else {
          next();
        }
      });
      console.log('Vite middleware mounted successfully.');
    } catch (viteErr) {
      console.error('Error creating Vite server:', viteErr);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 1. First listen immediately so dev server is responsive right away
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Perform initial stock market data prefetching asynchronously in background
    setTimeout(() => {
      void refreshLocalFallback()
        .then(() => preloadRealMarketData())
        .catch((err) => console.error('Background preload error:', err));
    }, 200);
  });
}

startServer();
