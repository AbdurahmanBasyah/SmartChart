import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getMockStocks, buildStockData, generateCandles, liquidIDXStocks } from './src/data/mockStocks';
import { fetchYahooStockData } from './src/services/yahooFinance';
import { StockData } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Cache initial stock data in memory
  let stockCache: Map<string, StockData> = new Map();

  function refreshLocalFallback() {
    const stocks = getMockStocks();
    stocks.forEach((s) => {
      stockCache.set(s.ticker.toUpperCase(), s);
      stockCache.set(s.symbol.toUpperCase(), s);
      if (s.ticker === '^JKSE' || s.ticker === 'IHSG') {
        stockCache.set('IHSG', s);
        stockCache.set('JKSE', s);
        stockCache.set('^JKSE', s);
      }
    });
  }

  // Pre-fetch real Yahoo Finance market data in background for liquid IDX tickers
  async function preloadRealMarketData() {
    const tickers = liquidIDXStocks.map((s) => s.t);

    console.log(`Pre-loading real market data from Yahoo Finance for ${tickers.length} liquid IDX stocks...`);
    const batchSize = 5;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (t) => {
          try {
            const realData = await fetchYahooStockData(t);
            if (realData && realData.candles && realData.candles.length > 0) {
              stockCache.set(realData.ticker.toUpperCase(), realData);
              stockCache.set(realData.symbol.toUpperCase(), realData);
            }
          } catch (err) {
            console.warn(`Failed preloading real data for ${t}:`, err);
          }
        })
      );
    }
    console.log('Real market data pre-loading completed!');
  }

  console.log('Initializing Express app and routes...');
  
  // Populate liquid stocks in cache synchronously on boot
  refreshLocalFallback();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get all stocks summary
  app.get('/api/stocks', async (req, res) => {
    const stockMap = new Map<string, StockData>();
    stockCache.forEach((stock) => {
      if (stock && stock.ticker) {
        const isIhsg = stock.ticker === '^JKSE' || stock.ticker === 'JKSE' || stock.ticker === 'IHSG';
        const displayTicker = isIhsg ? 'IHSG' : stock.ticker;
        const formatted = { ...stock, ticker: displayTicker };
        stockMap.set(displayTicker.toUpperCase(), formatted);
      }
    });
    res.json(Array.from(stockMap.values()));
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
    const yahooSymbol = cleanTicker.startsWith('^') ? cleanTicker : `${cleanTicker}.JK`;

    // 1. Always attempt to fetch live/delayed Yahoo Finance API data first
    try {
      const realData = await fetchYahooStockData(cleanTicker);
      if (realData && realData.candles && realData.candles.length > 0) {
        stockCache.set(cleanTicker, realData);
        stockCache.set(yahooSymbol, realData);
        if (cleanTicker === '^JKSE') {
          stockCache.set('IHSG', realData);
          stockCache.set('JKSE', realData);
          stockCache.set('^JKSE', realData);
        }
        return res.json(realData);
      }
    } catch (e) {
      console.warn(`Yahoo finance fetch failed for ${yahooSymbol}, using cache or fallback:`, e);
    }

    // 2. Check local cache if Yahoo Finance call failed or rate limited
    if (stockCache.has(cleanTicker)) {
      return res.json(stockCache.get(cleanTicker));
    }
    if (cleanTicker === '^JKSE') {
      if (stockCache.has('^JKSE')) return res.json(stockCache.get('^JKSE'));
      if (stockCache.has('IHSG')) return res.json(stockCache.get('IHSG'));
    }

    // 3. Dynamic generator fallback for unknown tickers
    const fallbackCandles = generateCandles(1500, 0.03, 0.001, 90);
    const fallbackStock = buildStockData(
      yahooSymbol,
      cleanTicker,
      `${cleanTicker} Indonesia Tbk.`,
      'IDX Market',
      fallbackCandles
    );

    stockCache.set(cleanTicker, fallbackStock);
    return res.json(fallbackStock);
  };

  app.get('/api/stock', handleStockRequest);
  app.get('/api/stock/:symbol', handleStockRequest);

  // Screener route
  app.get('/api/screener', (req, res) => {
    const list = Array.from(new Set(Array.from(stockCache.values())));

    const { structure, minRr, volumeOnly } = req.query;

    let filtered = list;

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

    res.json(filtered);
  });

  // Vite middleware for dev or Static serve for prod
  if (process.env.NODE_ENV !== 'production') {
    console.log('Creating Vite server middleware...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
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
      refreshLocalFallback();
      preloadRealMarketData().catch((err) => console.error('Background preload error:', err));
    }, 200);
  });
}

startServer();
