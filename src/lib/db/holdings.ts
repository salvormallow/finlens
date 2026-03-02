import { sql } from "@/lib/db";
import { decryptNumber, decrypt } from "./encryption";
import type { HoldingDetail, HoldingsResponse } from "@/types/financial";

interface RawHoldingRow {
  id: string;
  symbol: string;
  quantity: number | string;
  cost_basis: string;
  current_value: string;
  account_name: string;
  account_type: string;
}

export async function getHoldingsDetail(
  userId: string
): Promise<HoldingsResponse> {
  const result = await sql`
    SELECT
      ph.id, ph.symbol, ph.quantity, ph.cost_basis, ph.current_value,
      a.account_name, a.account_type
    FROM portfolio_holdings ph
    JOIN accounts a ON ph.account_id = a.id
    WHERE ph.user_id = ${userId}
    ORDER BY ph.symbol
  `;

  const holdings: HoldingDetail[] = [];
  let totalValue = 0;
  let totalCostBasis = 0;

  for (const r of result.rows) {
    try {
      const raw = r as unknown as RawHoldingRow;
      const costBasis = decryptNumber(raw.cost_basis);
      const currentValue = decryptNumber(raw.current_value);
      const quantity =
        typeof raw.quantity === "string"
          ? parseFloat(raw.quantity)
          : raw.quantity;
      const gainLoss = currentValue - costBasis;
      const gainLossPercent =
        costBasis !== 0
          ? Math.round(((currentValue - costBasis) / costBasis) * 1000) / 10
          : 0;

      let accountName: string;
      try {
        accountName = decrypt(raw.account_name);
      } catch {
        accountName = raw.account_name;
      }

      holdings.push({
        id: raw.id,
        symbol: raw.symbol,
        quantity,
        costBasis,
        currentValue,
        gainLoss,
        gainLossPercent,
        accountName,
        accountType: raw.account_type,
      });

      totalValue += currentValue;
      totalCostBasis += costBasis;
    } catch {
      // Skip rows that fail decryption
    }
  }

  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPercent =
    totalCostBasis !== 0
      ? Math.round(((totalValue - totalCostBasis) / totalCostBasis) * 1000) / 10
      : 0;

  return {
    holdings,
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPercent,
  };
}
