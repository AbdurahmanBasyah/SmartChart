import { getMockStocks } from "../src/data/mockStocks";

export default async function handler(req: any, res: any) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const stocks = getMockStocks();
        return res.status(200).json(stocks);
    } catch (error) {
        console.error("API /stocks handler error:", error);
        // Always return valid stock array even on unexpected runtime error to guarantee 200 OK
        try {
            const fallback = getMockStocks(30);
            return res.status(200).json(fallback);
        } catch (e) {
            return res.status(200).json([]);
        }
    }
}
