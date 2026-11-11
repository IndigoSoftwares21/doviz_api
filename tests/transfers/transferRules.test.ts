import displayName from "@/utils/transfers/displayName";
import nameInitials from "@/utils/transfers/nameInitials";
import transferLimitProblem from "@/utils/transfers/transferLimitProblem";
import transferReference from "@/utils/transfers/transferReference";
import transferDescription from "@/utils/transfers/transferDescription";
import toStatementTransfer from "@/utils/transfers/toStatementTransfer";
import toTransferView from "@/utils/transfers/toTransferView";

const limits = { minAmount: "100.00", maxPerTransfer: "1000000.00", maxPerDay: "1000000.00" };

describe("transfer rules", () => {
    it("shows first name + last initial, and initials — never the full surname", () => {
        expect(displayName({ firstName: "Ada", lastName: "okafor" })).toBe("Ada O.");
        expect(displayName({ firstName: "Ada", lastName: null })).toBe("Ada");
        expect(nameInitials({ firstName: "ada", lastName: "Okafor" })).toBe("AO");
    });

    it("limits: minimum, per transfer, and what's left of the rolling 24 hours", () => {
        const check = (amount: string, sentToday = "0") => transferLimitProblem({ amount, limits, sentToday });
        expect(check("99.99")).toBe("The minimum transfer is ₦100");
        expect(check("100")).toBeNull();
        expect(check("1000000.00")).toBeNull();
        expect(check("1000000.01")).toBe("You can send up to ₦1,000,000 per transfer");
        expect(check("640000", "360000.00")).toBeNull();
        expect(check("640000.50", "360000.00")).toBe("You can send up to ₦640,000 more today");
        expect(check("100", "999950.50")).toBe("You can send up to ₦49.50 more today");
        expect(check("100", "1000000.00")).toBe("You've reached your ₦1,000,000 daily sending limit. Try again later.");
    });

    it("a lowered limit leaves nothing negative: over the cap already → reached", () => {
        expect(transferLimitProblem({ amount: "100", limits: { ...limits, maxPerDay: "50000" }, sentToday: "60000" })).toMatch(/reached/);
    });

    it("descriptions and references", () => {
        expect(transferDescription({ direction: "sent", counterpartyTag: "ada", counterpartyName: "Ada O." })).toBe("Sent to @ada");
        expect(transferDescription({ direction: "received", counterpartyTag: "tunde", counterpartyName: "Tunde B." })).toBe("Received from @tunde");
        expect(transferDescription({ direction: "received", counterpartyTag: null, counterpartyName: "Tunde B." })).toBe("Received from Tunde B.");
        expect(transferReference({ id: "3f9a1c2b-7d4e-4c5e-9f7a-1b2c3d4e5f60" })).toBe("ZT-3F9A1C2B7D4E");
    });

    const row = {
        transferId: "t-1", transferSenderTag: "tunde", transferRecipientTag: "ada", transferNote: "for lunch",
        transferSenderFirstName: "Tunde", transferSenderLastName: "Bello", transferRecipientFirstName: "Ada", transferRecipientLastName: "Okafor",
    };

    it("a statement line's transfer is from its owner's side", () => {
        expect(toStatementTransfer({ row, isDebit: true })).toEqual({
            direction: "sent", counterpartyTag: "ada", counterpartyName: "Ada O.", note: "for lunch", description: "Sent to @ada",
        });
        expect(toStatementTransfer({ row, isDebit: false })).toMatchObject({ direction: "received", counterpartyTag: "tunde", counterpartyName: "Tunde B.", description: "Received from @tunde" });
        expect(toStatementTransfer({ row: { transferId: null }, isDebit: true })).toBeNull();
    });

    it("the transfer view: direction and counterparty relative to the viewer", () => {
        const transfer = {
            id: "3f9a1c2b-7d4e-4c5e-9f7a-1b2c3d4e5f60", senderId: "u-tunde", senderTag: "tunde", recipientTag: "ada", amount: "5000",
            currency: "NGN", note: null, status: "completed", createdAt: new Date(0),
            senderFirstName: "Tunde", senderLastName: "Bello", recipientFirstName: "Ada", recipientLastName: "Okafor",
        };
        expect(toTransferView({ row: transfer, viewerId: "u-tunde" })).toMatchObject({
            amount: "5000.00", direction: "sent", counterparty: { tag: "ada", displayName: "Ada O.", initials: "AO" }, reference: "ZT-3F9A1C2B7D4E",
        });
        expect(toTransferView({ row: transfer, viewerId: "u-ada" })).toMatchObject({ direction: "received", counterparty: { tag: "tunde", displayName: "Tunde B." } });
    });
});
