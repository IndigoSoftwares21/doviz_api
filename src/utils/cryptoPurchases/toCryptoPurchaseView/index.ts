import Decimal from "decimal.js";
import { CryptoPurchaseRow } from "@/actions/cryptoPurchase/fetchCryptoPurchase/queries/selectCryptoPurchase";

/**
 * A purchase as the app sees it. Never a provider name, provider reference or
 * our rate/markup — only the price the user paid. Crypto amounts are trimmed
 * of trailing zeros.
 */
const toCryptoPurchaseView = ({ row }: { row: CryptoPurchaseRow }) => ({
    id: row.id,
    status: row.status,
    asset: { id: row.assetId, symbol: row.symbol, network: row.network, name: row.assetName },
    address: row.address,
    memo: row.memo,
    cryptoAmount: new Decimal(row.cryptoAmount).toFixed(),
    networkFee: new Decimal(row.networkFee).toFixed(),
    unitPrice: row.unitPrice,
    currency: row.currency,
    nairaAmount: row.nairaAmount,
    nairaFee: row.nairaFee,
    total: row.totalNaira,
    txHash: row.txHash,
    failureReason: row.failureReason,
    createdAt: row.requestedAt,
    completedAt: row.finalizedAt,
});

export default toCryptoPurchaseView;
