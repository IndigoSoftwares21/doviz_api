import Decimal from "decimal.js";
import { FEE_BEARER, FeeBearer } from "@/constants/nairaDeposits";

/**
 * Splits a confirmed transfer. `settled` is what reaches Doviz's balance at
 * the provider (received − provider fee).
 *   user bears the fee  → the user is credited `settled`; Doviz absorbs nothing
 *   Doviz bears the fee → the user is credited everything received; Doviz absorbs the fee
 * So credited = settled + absorbedFee always (the ledger posting balances).
 * Throws when the fee would eat the whole transfer.
 */
const calculateNairaDepositCredit = ({
    amountReceived,
    providerFee,
    feeBearer,
}: {
    amountReceived: string;
    providerFee: string;
    feeBearer: FeeBearer;
}) => {
    const received = new Decimal(amountReceived);
    const fee = new Decimal(providerFee);
    if (!received.greaterThan(0) || fee.isNegative()) throw new Error(`Invalid transfer: received ${amountReceived}, fee ${providerFee}`);

    const settled = received.minus(fee);
    if (!settled.greaterThan(0)) throw new Error(`Provider fee ${providerFee} leaves nothing of ${amountReceived}`);

    const absorbedFee = feeBearer === FEE_BEARER.DOVIZ ? fee : new Decimal(0);
    const credited = settled.plus(absorbedFee);

    return { amountCredited: credited.toFixed(2), settled: settled.toFixed(2), absorbedFee: absorbedFee.toFixed(2) };
};

export default calculateNairaDepositCredit;
