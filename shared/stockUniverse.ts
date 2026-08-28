export interface CanonicalStockConfig {
  readonly t: string;
  readonly n: string;
  readonly s: string;
  readonly p: number;
  readonly cg?: string;
}

/**
 * The single approved IDX universe. Keep this metadata module dependency-free
 * so browser metadata and server/job code cannot drift into separate lists.
 */
export const CANONICAL_STOCK_UNIVERSE = [
  { t: "IHSG", n: "Indeks Harga Saham Gabungan (IHSG)", s: "Market Index", p: 7350, cg: "Bursa Efek Indonesia" },
  { t: "CDIA", n: "PT Chandra Daya Investama Tbk.", s: "Basic Materials", p: 1850, cg: "Prajogo Pangestu" },
  { t: "CUAN", n: "PT Petrindo Jaya Kreasi Tbk.", s: "Energy", p: 7600, cg: "Prajogo Pangestu" },
  { t: "BREN", n: "PT Barito Renewables Energy Tbk.", s: "Energy", p: 7250, cg: "Prajogo Pangestu" },
  { t: "PTRO", n: "PT Petrosea Tbk.", s: "Energy", p: 14500, cg: "Prajogo Pangestu" },
  { t: "TPIA", n: "PT Chandra Asri Pacific Tbk.", s: "Basic Materials", p: 8800, cg: "Prajogo Pangestu" },
  { t: "SINI", n: "PT Singaraja Putra Tbk.", s: "Energy", p: 1250, cg: "Prajogo Pangestu" },
  { t: "BRPT", n: "PT Barito Pacific Tbk.", s: "Basic Materials", p: 1120, cg: "Prajogo Pangestu" },
  { t: "ALII", n: "PT Anugerah Logistik Indonesia Tbk.", s: "Industrials", p: 450, cg: "Grup Bakrie" },
  { t: "BNBR", n: "PT Bakrie & Brothers Tbk.", s: "Industrials", p: 60, cg: "Grup Bakrie" },
  { t: "KOTA", n: "PT DMS Propertindo Tbk.", s: "Properties", p: 50, cg: "Grup Bakrie" },
  { t: "MDIA", n: "PT Intermedia Capital Tbk.", s: "Telecommunication", p: 50, cg: "Grup Bakrie" },
  { t: "BRMS", n: "PT Bumi Resources Minerals Tbk.", s: "Basic Materials", p: 340, cg: "Grup Bakrie" },
  { t: "BUMI", n: "PT Bumi Resources Tbk.", s: "Energy", p: 140, cg: "Grup Bakrie" },
  { t: "DEWA", n: "PT Darma Henwa Tbk.", s: "Energy", p: 92, cg: "Grup Bakrie" },
  { t: "ENRG", n: "PT Energi Mega Persada Tbk.", s: "Energy", p: 230, cg: "Grup Bakrie" },
  { t: "VKTR", n: "PT VKTR Teknologi Mobilitas Tbk.", s: "Industrials", p: 145, cg: "Grup Bakrie" },
  { t: "JGLE", n: "PT Graha Andrasentra Propertindo Tbk.", s: "Properties", p: 50, cg: "Grup Bakrie" },
  { t: "OASA", n: "PT Maharaksa Biru Energi Tbk.", s: "Energy", p: 140, cg: "Grup Bakrie" },
  { t: "BIPI", n: "PT Astrindo Nusantara Infrastruktur Tbk.", s: "Energy", p: 68, cg: "Grup Bakrie" },
  { t: "UNSP", n: "PT Bakrie Sumatera Plantations Tbk.", s: "Consumer Staples", p: 110, cg: "Grup Bakrie" },
  { t: "VIVA", n: "PT Visi Media Asia Tbk.", s: "Telecommunication", p: 50, cg: "Grup Bakrie" },
  { t: "MBMA", n: "PT Merdeka Battery Materials Tbk.", s: "Basic Materials", p: 580, cg: "Boy Thohir" },
  { t: "ESSA", n: "PT ESSA Industries Indonesia Tbk.", s: "Basic Materials", p: 840, cg: "Boy Thohir" },
  { t: "MDKA", n: "PT Merdeka Copper Gold Tbk.", s: "Basic Materials", p: 2450, cg: "Boy Thohir" },
  { t: "AADI", n: "PT Adaro Andalan Indonesia Tbk.", s: "Energy", p: 5850, cg: "Boy Thohir" },
  { t: "ADMR", n: "PT Adaro Minerals Indonesia Tbk.", s: "Energy", p: 1420, cg: "Boy Thohir" },
  { t: "ADRO", n: "PT Adaro Energy Indonesia Tbk.", s: "Energy", p: 3650, cg: "Boy Thohir" },
  { t: "EMAS", n: "PT Wilton Makmur Indonesia Tbk.", s: "Basic Materials", p: 125, cg: "Boy Thohir" },
  { t: "CBDK", n: "PT Cipta Bangun Dimensi Kreasi Tbk.", s: "Properties", p: 250, cg: "Agung Sedayu (Aguan)" },
  { t: "ECII", n: "PT Electronic City Indonesia Tbk.", s: "Consumer Cyclical", p: 280, cg: "Agung Sedayu (Aguan)" },
  { t: "ERAA", n: "PT Erajaya Swasembada Tbk.", s: "Consumer Cyclical", p: 430, cg: "Agung Sedayu (Aguan)" },
  { t: "ERAL", n: "PT Sinar Eka Selaras Tbk.", s: "Consumer Cyclical", p: 280, cg: "Agung Sedayu (Aguan)" },
  { t: "INPC", n: "PT Bank Artha Graha Internasional Tbk.", s: "Financials", p: 120, cg: "Agung Sedayu (Aguan)" },
  { t: "JIHD", n: "PT Jakarta International Hotels & Dev Tbk.", s: "Properties", p: 480, cg: "Agung Sedayu (Aguan)" },
  { t: "PANI", n: "PT Pantai Indah Kapuk Dua Tbk.", s: "Properties", p: 12800, cg: "Agung Sedayu (Aguan)" },
  { t: "ARCI", n: "PT Archi Indonesia Tbk.", s: "Basic Materials", p: 310, cg: "Happy Hapsoro" },
  { t: "BUVA", n: "PT Bukit Uluwatu Villa Tbk.", s: "Consumer Cyclical", p: 70, cg: "Happy Hapsoro" },
  { t: "CBRE", n: "PT Cakra Buana Resources Energi Tbk.", s: "Energy", p: 75, cg: "Happy Hapsoro" },
  { t: "MINA", n: "PT Sanurhasta Mitra Tbk.", s: "Consumer Cyclical", p: 50, cg: "Happy Hapsoro" },
  { t: "PADI", n: "PT Minna Padi Investama Sekuritas Tbk.", s: "Financials", p: 50, cg: "Happy Hapsoro" },
  { t: "PSKT", n: "PT Red Planet Indonesia Tbk.", s: "Consumer Cyclical", p: 65, cg: "Happy Hapsoro" },
  { t: "RAJA", n: "PT Rukun Raharja Tbk.", s: "Energy", p: 1420, cg: "Happy Hapsoro" },
  { t: "RATU", n: "PT Ratu Prabu Energy Tbk.", s: "Energy", p: 95, cg: "Happy Hapsoro" },
  { t: "UANG", n: "PT Pakuan Tbk.", s: "Properties", p: 680, cg: "Happy Hapsoro" },
  { t: "PSAB", n: "PT J Resources Asia Pasifik Tbk.", s: "Basic Materials", p: 290, cg: "Happy Hapsoro" },
  { t: "FORU", n: "PT Fortune Indonesia Tbk.", s: "Consumer Cyclical", p: 1350, cg: "Happy Hapsoro" },
  { t: "AGRO", n: "PT Bank Raya Indonesia Tbk.", s: "Financials", p: 260, cg: "Sektor Perbankan" },
  { t: "ARTO", n: "PT Bank Jago Tbk.", s: "Financials", p: 2850, cg: "Sektor Perbankan" },
  { t: "BBYB", n: "PT Bank Neo Commerce Tbk.", s: "Financials", p: 270, cg: "Sektor Perbankan" },
  { t: "BGTG", n: "PT Bank Ganesha Tbk.", s: "Financials", p: 85, cg: "Sektor Perbankan" },
  { t: "BMRI", n: "PT Bank Mandiri (Persero) Tbk.", s: "Financials", p: 6900, cg: "Sektor Perbankan" },
  { t: "BBCA", n: "PT Bank Central Asia Tbk.", s: "Financials", p: 10150, cg: "Sektor Perbankan" },
  { t: "BBNI", n: "PT Bank Negara Indonesia (Persero) Tbk.", s: "Financials", p: 5400, cg: "Sektor Perbankan" },
  { t: "BBTN", n: "PT Bank Tabungan Negara (Persero) Tbk.", s: "Financials", p: 1380, cg: "Sektor Perbankan" },
  { t: "BBRI", n: "PT Bank Rakyat Indonesia (Persero) Tbk.", s: "Financials", p: 4850, cg: "Sektor Perbankan" },
  { t: "BRIS", n: "PT Bank Syariah Indonesia Tbk.", s: "Financials", p: 2920, cg: "Sektor Perbankan" },
  { t: "BBHI", n: "PT Allo Bank Indonesia Tbk.", s: "Financials", p: 1180, cg: "Sektor Perbankan" },
  { t: "NOBU", n: "PT Bank Nationalnobu Tbk.", s: "Financials", p: 580, cg: "Sektor Perbankan" },
  { t: "PNBN", n: "PT Bank Pan Indonesia Tbk.", s: "Financials", p: 1250, cg: "Sektor Perbankan" },
  { t: "PNLF", n: "PT Panin Financial Tbk.", s: "Financials", p: 310, cg: "Sektor Perbankan" },
  { t: "ANTM", n: "PT Aneka Tambang Tbk.", s: "Basic Materials", p: 1520, cg: "BUMN" },
  { t: "GIAA", n: "PT Garuda Indonesia (Persero) Tbk.", s: "Industrials", p: 68, cg: "BUMN" },
  { t: "GMFI", n: "PT Garuda Maintenance Facility Aero Asia Tbk.", s: "Industrials", p: 60, cg: "BUMN" },
  { t: "INCO", n: "PT Vale Indonesia Tbk. / MIND ID", s: "Basic Materials", p: 3850, cg: "BUMN" },
  { t: "JSMR", n: "PT Jasa Marga (Persero) Tbk.", s: "Industrials", p: 4700, cg: "BUMN" },
  { t: "KAEF", n: "PT Kimia Farma Tbk.", s: "Healthcare", p: 680, cg: "BUMN" },
  { t: "KRAS", n: "PT Krakatau Steel (Persero) Tbk.", s: "Basic Materials", p: 110, cg: "BUMN" },
  { t: "SMBR", n: "PT Semen Baturaja Tbk.", s: "Industrials", p: 240, cg: "BUMN" },
  { t: "SMGR", n: "PT Semen Indonesia (Persero) Tbk.", s: "Industrials", p: 3950, cg: "BUMN" },
  { t: "TINS", n: "PT Timah Tbk.", s: "Basic Materials", p: 1150, cg: "BUMN" },
  { t: "TLKM", n: "PT Telkom Indonesia (Persero) Tbk.", s: "Telecommunication", p: 3050, cg: "BUMN" },
  { t: "HRUM", n: "PT Harum Energy Tbk.", s: "Energy", p: 1380, cg: "Sektor COAL" },
  { t: "ITMG", n: "PT Indo Tambangraya Megah Tbk.", s: "Energy", p: 26200, cg: "Sektor COAL" },
  { t: "PTBA", n: "PT Bukit Asam Tbk.", s: "Energy", p: 2680, cg: "Sektor COAL" },
  { t: "BYAN", n: "PT Bayan Resources Tbk.", s: "Energy", p: 18500, cg: "Sektor COAL" },
  { t: "FAST", n: "PT Fast Food Indonesia Tbk.", s: "Consumer Cyclical", p: 450, cg: "Haji Isam (Jholin)" },
  { t: "JARR", n: "PT Jhonlin Agro Raya Tbk.", s: "Consumer Staples", p: 320, cg: "Haji Isam (Jholin)" },
  { t: "PGUN", n: "PT Pradiksi Gunatama Tbk.", s: "Consumer Staples", p: 460, cg: "Haji Isam (Jholin)" },
  { t: "TEBE", n: "PT Dana Brata Luhur Tbk.", s: "Energy", p: 780, cg: "Haji Isam (Jholin)" },
  { t: "DOOH", n: "PT Era Media Sejahtera Tbk.", s: "Telecommunication", p: 50, cg: "Hasyim Djojohadikusumo" },
  { t: "INET", n: "PT Sinergi Inti Andalan Prima Tbk.", s: "Telecommunication", p: 110, cg: "Hasyim Djojohadikusumo" },
  { t: "KETR", n: "PT Ketrosden Triasmitra Tbk.", s: "Telecommunication", p: 210, cg: "Hasyim Djojohadikusumo" },
  { t: "WIFI", n: "PT Solusi Sinergi Digital Tbk.", s: "Telecommunication", p: 310, cg: "Hasyim Djojohadikusumo" },
  { t: "ICBP", n: "PT Indofood CBP Sukses Makmur Tbk.", s: "Consumer Staples", p: 11850, cg: "Grup Salim" },
  { t: "LSIP", n: "PT PP London Sumatra Indonesia Tbk.", s: "Consumer Staples", p: 1020, cg: "Grup Salim" },
  { t: "SIMP", n: "PT Salim Ivomas Pratama Tbk.", s: "Consumer Staples", p: 410, cg: "Grup Salim" },
  { t: "META", n: "PT Nusantara Infrastructure Tbk.", s: "Industrials", p: 238, cg: "Grup Salim" },
  { t: "INDF", n: "PT Indofood Sukses Makmur Tbk.", s: "Consumer Staples", p: 7150, cg: "Grup Salim" },
  { t: "AMRT", n: "PT Sumber Alfaria Trijaya Tbk.", s: "Consumer Cyclical", p: 2850, cg: "Grup Salim" },
  { t: "ROTI", n: "PT Nippon Indosari Corpindo Tbk.", s: "Consumer Staples", p: 1040, cg: "Grup Salim" },
  { t: "DNET", n: "PT Indoritel Makmur Internasional Tbk.", s: "Consumer Cyclical", p: 4100, cg: "Grup Salim" },
  { t: "IMAS", n: "PT Indomobil Sukses Internasional Tbk.", s: "Consumer Cyclical", p: 1320, cg: "Grup Salim" },
  { t: "IMJS", n: "PT Indomobil Multi Jasa Tbk.", s: "Financials", p: 170, cg: "Grup Salim" },
  { t: "AMMN", n: "PT Amman Mineral Internasional Tbk.", s: "Basic Materials", p: 8950, cg: "Grup Salim & Medco" },
  { t: "MEDC", n: "PT Medco Energi Internasional Tbk.", s: "Energy", p: 1320, cg: "Grup Salim & Medco" },
  { t: "MORA", n: "PT Mora Telematika Indonesia Tbk.", s: "Telecommunication", p: 280, cg: "Internet & Telco" },
  { t: "IRSX", n: "PT Aviana Sinar Abadi Tbk.", s: "Technology", p: 50, cg: "Internet & Telco" },
  { t: "PADA", n: "PT Personel Alih Daya Tbk.", s: "Industrials", p: 60, cg: "Internet & Telco" },
  { t: "SOCI", n: "PT Soechi Lines Tbk.", s: "Industrials & Energy", p: 195, cg: "Logistik & Perkapalan" },
  { t: "BULL", n: "PT Buana Lintas Lautan Tbk.", s: "Industrials & Energy", p: 135, cg: "Logistik & Perkapalan" },
  { t: "GTSI", n: "PT GTS Internasional Tbk.", s: "Energy", p: 50, cg: "Logistik & Perkapalan" },
  { t: "HUMI", n: "PT Humpuss Maritim Internasional Tbk.", s: "Energy", p: 65, cg: "Logistik & Perkapalan" },
  { t: "LEAD", n: "PT Logindo Samudramakmur Tbk.", s: "Energy", p: 60, cg: "Logistik & Perkapalan" },
  { t: "DSSA", n: "PT Duta Sarana Elektrindo Tbk.", s: "Telecommunication", p: 50, cg: "Data Center & Telekomunikasi" },
  { t: "EDGE", n: "PT Edge Data Center Indonesia Tbk.", s: "Telecommunication", p: 50, cg: "Data Center & Telekomunikasi" },
  { t: "POWR", n: "PT Powerindo Primajaya Tbk.", s: "Telecommunication", p: 50, cg: "Data Center & Telekomunikasi" },
  { t: "ARKO", n: "PT Arkora Hydro Tbk.", s: "Telecommunication", p: 50, cg: "Data Center & Telekomunikasi" },
  { t: "TOTL", n: "PT Total Bangun Persada Tbk.", s: "Telecommunication", p: 50, cg: "Data Center & Telekomunikasi" },
  { t: "KIJA", n: "PT Kharisma Pemasaran Bersama Tbk.", s: "Telecommunication", p: 50, cg: "Data Center & Telekomunikasi" },
  { t: "DMAS", n: "PT Duta Masindo Tbk.", s: "Telecommunication", p: 50, cg: "Data Center & Telekomunikasi" },
  { t: "BEST", n: "PT Besta Medika Nusantara Tbk.", s: "Telecommunication", p: 50, cg: "Data Center & Telekomunikasi" },
  { t: "ASII", n: "PT Astra International Tbk.", s: "Consumer Cyclical", p: 5150 },
  { t: "UNVR", n: "PT Unilever Indonesia Tbk.", s: "Consumer Staples", p: 2350 },
  { t: "CPIN", n: "PT Charoen Pokphand Indonesia Tbk.", s: "Consumer Staples", p: 5150 },
  { t: "KLBF", n: "PT Kalbe Farma Tbk.", s: "Healthcare", p: 1650 },
  { t: "PGAS", n: "PT Perusahaan Gas Negara Tbk.", s: "Energy", p: 1540 },
  { t: "UNTR", n: "PT United Tractors Tbk.", s: "Industrials", p: 26800 },
  { t: "ISAT", n: "PT Indosat Ooredoo Hutchison Tbk.", s: "Telecommunication", p: 10250 },
  { t: "EXCL", n: "PT XL Axiata Tbk.", s: "Telecommunication", p: 2250 },
  { t: "TOWR", n: "PT Sarana Menara Nusantara Tbk.", s: "Telecommunication", p: 810 },
  { t: "INKP", n: "PT Indah Kiat Pulp & Paper Tbk.", s: "Basic Materials", p: 8150 },
  { t: "TKIM", n: "PT Pabrik Kertas Tjiwi Kimia Tbk.", s: "Basic Materials", p: 7100 },
  { t: "BSDE", n: "PT Bumi Serpong Damai Tbk.", s: "Properties", p: 1120 },
  { t: "CTRA", n: "PT Ciputra Development Tbk.", s: "Properties", p: 1280 },
] as const satisfies readonly CanonicalStockConfig[];

export const CANONICAL_STOCK_COUNT = 125 as const;
export const CANONICAL_STOCK_TICKERS = CANONICAL_STOCK_UNIVERSE.map((stock) => stock.t);

export function normalizeUniverseTicker(value: unknown): string {
  const raw = String(value ?? "").trim().toUpperCase().replace(/\.JK$/, "");
  return raw === "IHSG" || raw === "JKSE" || raw === "^JKSE" ? "IHSG" : raw;
}

export function tickerToUniverseSymbol(value: unknown): string {
  const ticker = normalizeUniverseTicker(value);
  return ticker === "IHSG" ? "^JKSE" : `${ticker}.JK`;
}

export function isCanonicalTicker(value: unknown): boolean {
  return (CANONICAL_STOCK_TICKERS as readonly string[]).includes(normalizeUniverseTicker(value));
}

export function getCanonicalStockConfig(value: unknown): CanonicalStockConfig | undefined {
  const ticker = normalizeUniverseTicker(value);
  return CANONICAL_STOCK_UNIVERSE.find((stock) => stock.t === ticker);
}
