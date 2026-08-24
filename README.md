# SmartChart

SmartChart adalah aplikasi web untuk analisis teknikal saham Indonesia (IDX/BEI) berbasis Smart Money Concepts (SMC). Aplikasi menyediakan chart analisis, rekomendasi berbasis rule, screener, watchlist, broker inventory flow, dan kalkulator position sizing.

> SmartChart adalah alat bantu analisis, bukan nasihat investasi. Data Yahoo Finance dapat terlambat, gagal diambil, atau digantikan oleh data fallback.

## Fitur utama

- Analisis chart: market structure, swing, FVG, order block, price gap, liquidity sweep, support/resistance, indikator, dan rekomendasi.
- Screener berdasarkan struktur market, risk/reward, volume, sektor, konglomerat, tipe zona, dan status sinyal.
- Broker Inventory Flow dengan filter rentang tanggal dan katalog broker IDX.
- Broker Inventory Flow memakai summary dan histori accumulation dari external broker-data provider melalui proxy server-side.
- Watchlist yang tersimpan di browser.
- Position calculator dengan aturan tick price IDX dan perhitungan risk/reward.
- Deep link untuk analisis dan inventory, misalnya `/analysis/BBCA` dan `/inventory/BBCA`.
- Pagination pada screener, watchlist, dan tabel broker; motion load transition dengan dukungan reduced-motion.
- Data berlapis: Yahoo Finance → cache server → dataset mock → generator fallback.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS v4
- Express + `tsx` untuk server development/production Node
- Vercel-style handlers di `api/`
- `lucide-react`, `motion`, dan `three` untuk UI/visualisasi
- Bun lockfile (`bun.lock`)

## Menjalankan lokal

Prasyarat: Bun dan Node.js yang kompatibel dengan TypeScript/Vite pada `package.json`.

```bash
bun install
bun run dev
```

Buka <http://localhost:3000>.

Pemeriksaan yang tersedia:

```bash
bun run lint   # TypeScript check, tanpa emit
bun run build  # Build frontend dan bundle server
```

Belum ada script test otomatis di `package.json`. Perubahan yang menyentuh engine analisis, data, atau routing tetap perlu divalidasi dengan `bun run lint`, `bun run build`, dan pemeriksaan manual pada route yang terdampak.

## Route aplikasi

| Route | Fungsi |
| --- | --- |
| `/` | Landing/dashboard |
| `/analysis/:ticker` | Analisis SMC saham atau IHSG |
| `/inventory` | Inventory dengan saham default |
| `/inventory/:ticker` | Inventory saham tertentu |
| `/screener` | Screener saham |
| `/watchlist` | Daftar saham tersimpan |
| `/calculator` | Position sizing dan risk/reward |

Guide SMC dibuka sebagai modal dari navigasi, bukan route mandiri.

## Data dan fallback

Saat server berjalan, cache lokal diisi dari `getMockStocks()`, lalu preload data Yahoo Finance berjalan di background. Frontend juga melakukan sinkronisasi data dan dapat mengambil ticker baru secara langsung.

`StockData.isRealData` membedakan data hasil pengambilan market data dari data mock/generator. Jangan menghapus penanda ini atau menampilkan data fallback sebagai data real.

Penyimpanan browser yang digunakan saat ini:

| Key | Isi |
| --- | --- |
| `smc_watchlist` | Array ticker watchlist |
| `smc_custom_stocks` | Stock data real/custom yang dicache frontend |

## Struktur penting

```text
src/
  App.tsx                    # shell aplikasi, state utama, dan navigasi history
  components/                # UI feature components
  data/mockStocks.ts         # dataset/generator dan pembentukan StockData frontend
  services/yahooFinance.ts   # pengambilan data market berlapis
  utils/smcEngine.ts         # indikator dan rule SMC
  utils/brokerInventoryEngine.ts
  utils/idxTickRules.ts
  types.ts                   # kontrak domain frontend
api/
  _lib/stockEngine.ts        # engine self-contained untuk serverless
  stock.ts, stocks.ts, screener.ts
server.ts                    # Express + Vite middleware + compatibility endpoints
```

## Dokumentasi proyek

- [AGENTS.md](AGENTS.md) — aturan kerja agent dan developer.
- [DESIGNS.md](DESIGNS.md) — arsitektur dan alur sistem yang berjalan.
- [DECISIONS.md](DECISIONS.md) — keputusan arsitektur serta riwayat perubahan.
- [API.md](API.md) — endpoint, query parameter, dan catatan sumber data.
- [DEVELOPMENT.md](DEVELOPMENT.md) — workflow implementasi dan troubleshooting.

## Konfigurasi external broker-data provider

Salin `.env.example` ke `.env`, lalu isi `BROKER_DATA_API_BASE_URL` dan `BROKER_DATA_API_KEY`. Secret hanya dibaca server-side melalui `/api/broker-summary` dan `/api/broker-accumulation`; jangan menaruhnya di source, log, atau commit.

Provider external mengembalikan agregat summary dan deret accumulation untuk rentang tanggal terpilih. UI menampilkan kurva hanya dari histori real; jika provider gagal atau mengembalikan dataset kosong, halaman menampilkan state kosong/error eksplisit tanpa data rekaan.

Tabel broker diurutkan berdasarkan signed net volume terbesar pada selected period, lalu net value dan kode broker sebagai tie-break. Nilai tersebut adalah net flow periode terpilih, bukan estimasi saldo custody sebelum tanggal awal.

## Catatan penting

- Broker inventory memiliki failure handling generik; konfigurasi provider yang kosong atau request provider yang gagal menghasilkan pesan unavailable yang aman tanpa membocorkan secret.
- Price gap hanya menampilkan sisa opening gap yang belum terisi. Gap naik berasal dari `current.open > previous.close`, sedangkan gap turun berasal dari `current.open < previous.close`; gap yang sudah terisi penuh tidak digambar.
- Tapped rebound long hanya valid ketika candle terakhir retrace dari atas ke zona bullish aktif sebelum candle tersebut dan ditutup kembali di atas zona.
- Engine di `src/` dan `api/_lib/` memiliki implementasi yang mirip tetapi terpisah. Perubahan rule harus menjaga keduanya tetap konsisten.
- `vercel.json` mempertahankan rewrite API dan menambahkan SPA fallback untuk route non-API seperti `/analysis/:ticker` dan `/inventory/:ticker`.
- Jangan commit file `.env`; gunakan `.env.example` sebagai referensi konfigurasi.
