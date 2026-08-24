import { BrokerInventoryItem } from "../types";

export function compareBrokerNetFlow(a: BrokerInventoryItem, b: BrokerInventoryItem): number {
    return (
        b.netVol - a.netVol ||
        b.netVal - a.netVal ||
        a.brokerCode.localeCompare(b.brokerCode)
    );
}

export function sortBrokerInventoryRows(rows: BrokerInventoryItem[]): BrokerInventoryItem[] {
    return [...rows].sort(compareBrokerNetFlow);
}
