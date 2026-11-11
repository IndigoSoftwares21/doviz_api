import { BILL_CATEGORY } from "@/constants/bills";
import encodeStatementCursor from "@/utils/wallet/encodeStatementCursor";
import decodeStatementCursor from "@/utils/wallet/decodeStatementCursor";
import describeStatementEntry from "@/utils/wallet/describeStatementEntry";
import toStatementItem from "@/actions/walletTransactions/fetchWalletTransactions/utils/toStatementItem";
import { ENTRY_DIRECTION, LEDGER_TRANSACTION_TYPE } from "@/constants/ledger";

const ENTRY = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const row = { id: ENTRY, amount: "-5000.5", balanceAfter: "100", createdAt: new Date(), type: LEDGER_TRANSACTION_TYPE.WITHDRAWAL_HOLD,
    depositId: null, symbol: null, network: null, cryptoAmount: null, grossNgn: null, markupNgn: null, markupPercent: null, billPaymentId: null, billCategory: null, billerName: null, billProductName: null, billCustomerId: null };

describe("statement cursor", () => {
    it("round-trips an entry id", () => {
        expect(decodeStatementCursor({ cursor: encodeStatementCursor({ entryId: ENTRY }) })).toBe(ENTRY);
    });

    it.each(["", "abc", encodeStatementCursor({ entryId: "1 OR 1=1" })])("rejects %p", (cursor) => {
        expect(decodeStatementCursor({ cursor })).toBeNull();
    });
});

describe("toStatementItem", () => {
    it("shows debits as a positive amount with direction debit, to the kobo", () => {
        expect(toStatementItem({ row })).toMatchObject({
            direction: ENTRY_DIRECTION.DEBIT, amount: "5000.50", balanceAfter: "100.00", deposit: null,
            description: "Withdrawal to bank", bill: null,
        });
    });
});

describe("describeStatementEntry", () => {
    it("names the coin and trims trailing zeros", () => {
        expect(describeStatementEntry({ type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT, symbol: "BTC", cryptoAmount: "0.00150000" }))
            .toBe("0.0015 BTC converted to naira");
    });

    it("falls back when the deposit details are missing", () => {
        expect(describeStatementEntry({ type: LEDGER_TRANSACTION_TYPE.CRYPTO_DEPOSIT, symbol: null, cryptoAmount: null }))
            .toBe("Crypto converted to naira");
    });

    it("labels bill payments and their refunds", () => {
        expect(describeStatementEntry({ type: LEDGER_TRANSACTION_TYPE.BILL_HOLD, symbol: null, cryptoAmount: null }))
            .toBe("Bill payment");
        expect(describeStatementEntry({ type: LEDGER_TRANSACTION_TYPE.BILL_REVERSAL, symbol: null, cryptoAmount: null }))
            .toBe("Bill payment refunded");
    });

    it("names the kind of bill when the category is known", () => {
        const bill = (type: string, billCategory: string) => describeStatementEntry({ type, symbol: null, cryptoAmount: null, billCategory });
        expect(bill(LEDGER_TRANSACTION_TYPE.BILL_HOLD, BILL_CATEGORY.AIRTIME)).toBe("Airtime purchase");
        expect(bill(LEDGER_TRANSACTION_TYPE.BILL_HOLD, BILL_CATEGORY.DATA)).toBe("Data purchase");
        expect(bill(LEDGER_TRANSACTION_TYPE.BILL_HOLD, BILL_CATEGORY.ELECTRICITY)).toBe("Electricity bill");
        expect(bill(LEDGER_TRANSACTION_TYPE.BILL_HOLD, BILL_CATEGORY.CABLE_TV)).toBe("Cable TV subscription");
        expect(bill(LEDGER_TRANSACTION_TYPE.BILL_REVERSAL, BILL_CATEGORY.DATA)).toBe("Data refund");
        // An unknown category falls back to the generic wording.
        expect(bill(LEDGER_TRANSACTION_TYPE.BILL_HOLD, "gift_cards")).toBe("Bill payment");
    });

    it("labels crypto purchases and their refunds", () => {
        expect(describeStatementEntry({ type: LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_HOLD, symbol: null, cryptoAmount: null }))
            .toBe("Crypto purchase");
        expect(describeStatementEntry({ type: LEDGER_TRANSACTION_TYPE.CRYPTO_PURCHASE_REVERSAL, symbol: null, cryptoAmount: null }))
            .toBe("Crypto purchase refunded");
    });
});
