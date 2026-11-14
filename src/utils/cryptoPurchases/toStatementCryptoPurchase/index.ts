import Decimal from "decimal.js";

export interface StatementCryptoPurchaseRow {
    purchaseId: string | null;
    purchaseStatus: string | null;
    purchaseSymbol: string | null;
    purchaseNetwork: string | null;
    purchaseCryptoAmount: string | null;
    purchaseNetworkFee: string | null;
    purchaseUnitPrice: string | null;
    purchaseNairaAmount: string | null;
    purchaseNairaFee: string | null;
    purchaseTotal: string | null;
    purchaseAddress: string | null;
    purchaseMemo: string | null;
    purchaseTxHash: string | null;
    purchaseFailureReason: string | null;
    purchaseRequestedAt: Date | null;
    purchaseCompletedAt: Date | null;
}

/**
 * The crypto purchase behind a statement line (its hold or its refund), as a
 * receipt: the coin received, where it went, and the on-chain hash once sent.
 * Never the provider or our rate/markup — only the price the user paid.
 */
const toStatementCryptoPurchase = ({ row }: { row: StatementCryptoPurchaseRow }) =>
    row.purchaseId
        ? {
              id: row.purchaseId,
              status: row.purchaseStatus,
              symbol: row.purchaseSymbol,
              network: row.purchaseNetwork,
              cryptoAmount: row.purchaseCryptoAmount === null ? null : new Decimal(row.purchaseCryptoAmount).toFixed(),
              networkFee: row.purchaseNetworkFee === null ? null : new Decimal(row.purchaseNetworkFee).toFixed(),
              unitPrice: row.purchaseUnitPrice,
              nairaAmount: row.purchaseNairaAmount,
              nairaFee: row.purchaseNairaFee,
              total: row.purchaseTotal,
              address: row.purchaseAddress,
              memo: row.purchaseMemo,
              txHash: row.purchaseTxHash,
              failureReason: row.purchaseFailureReason,
              createdAt: row.purchaseRequestedAt,
              completedAt: row.purchaseCompletedAt,
          }
        : null;

export default toStatementCryptoPurchase;
