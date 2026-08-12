import { getMockStocks } from "../src/data/mockStocks";

export default async function handler(req: any, res: any) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const list = getMockStocks();
        const { structure, minRr, volumeOnly } = req.query;

        let filtered = list;

        if (structure && structure !== "ALL") {
            filtered = filtered.filter(
                (s) => s.recommendation.structure === structure
            );
        }

        if (minRr) {
            const minVal = parseFloat(minRr as string);
            filtered = filtered.filter(
                (s) => s.recommendation.riskRewardRatio >= minVal
            );
        }

        if (volumeOnly === "true") {
            filtered = filtered.filter(
                (s) => s.recommendation.volumeConfirmation
            );
        }

        return res.status(200).json(filtered);
    } catch (err) {
        console.error("API /screener handler error:", err);
        try {
            const fallback = getMockStocks(30);
            return res.status(200).json(fallback);
        } catch (e) {
            return res.status(200).json([]);
        }
    }
}
