import FossapayVirtualAccountProvider from "@/services/virtualAccounts/providers/fossapay/fossapayVirtualAccountProvider";
import FossapayClient from "@/services/fossapay/fossapayClient";

const customer = {
    customerRef: "zkabc123",
    firstName: "Ada Mary",
    middleName: null,
    lastName: "Okafor Eze",
    dateOfBirth: "1994-03-18",
    gender: "female",
    address: "12 Allen Avenue, Ikeja",
    city: "Lagos",
    bvn: "22212345678",
    phoneNumber: "+2348031234567",
    email: "ops@ziks.app",
};
const customerOk = { status: 201, data: { status: "success", data: { id: "11111111-1111-4111-8111-111111111111" } } };
const walletOk = { status: 201, data: { status: "success", data: { walletId: "w-1", bankName: "Providus Bank", bankCode: "101", accountName: "Ziks Ada Okafor", accountNumber: "9912345678" } } };

describe("Fossapay account numbers", () => {
    const post = jest.fn();
    const fossapay = new FossapayVirtualAccountProvider({ post } as unknown as FossapayClient, "ops@ziks.app", "Nigeria");

    beforeEach(() => {
        jest.resetAllMocks();
        for (const method of ["info", "warn", "error"] as const) jest.spyOn(console, method).mockImplementation(() => undefined);
    });

    it("creates the customer (Fossapay's name rules, a unique email) and then their wallet", async () => {
        post.mockResolvedValueOnce(customerOk).mockResolvedValueOnce(walletOk);
        await expect(fossapay.createAccount(customer)).resolves.toEqual({ accountNumber: "9912345678", accountName: "Ziks Ada Okafor", bankName: "Providus Bank", bankCode: "101" });
        expect(post).toHaveBeenNthCalledWith(1, "/customers", {
            firstName: "Ada",
            lastName: "Okafor-Eze",
            emailAddress: "ops+zkabc123@ziks.app",
            mobileNumber: "+2348031234567",
            dateOfBirth: "1994-03-18",
            address: "12 Allen Avenue, Ikeja",
            city: "Lagos",
            country: "Nigeria",
            type: "individual",
        });
        expect(post).toHaveBeenNthCalledWith(2, "/wallets/fiat/create", { customerId: "11111111-1111-4111-8111-111111111111", walletName: "Ada Mary Okafor Eze", walletReference: "zkabc123" });
    });

    it("keeps a user's own verified email, and takes the city from the address when none was collected", async () => {
        post.mockResolvedValueOnce(customerOk).mockResolvedValueOnce(walletOk);
        await fossapay.createAccount({ ...customer, email: "ada@example.com", city: null });
        expect(post.mock.calls[0][1]).toMatchObject({ emailAddress: "ada@example.com", city: "Ikeja" });
    });

    it.each([
        ["a network failure", { status: null, code: "ECONNRESET" }, "unavailable"],
        ["an outage", { status: 503, data: {} }, "unavailable"],
        ["our key refused", { status: 401, data: { message: "Invalid API key" } }, "unavailable"],
        ["a customer that already exists (reconcile)", { status: 400, data: { message: "Email already exists" } }, "unavailable"],
        ["details Fossapay won't accept", { status: 422, data: { message: "firstName is invalid" } }, "rejected"],
    ])("maps %s to %s", async (_why, reply, code) => {
        post.mockResolvedValueOnce(reply);
        await expect(fossapay.createAccount(customer)).rejects.toMatchObject({ code });
    });

    it("sweeps into the master wallet, whose account number sits under virtualAccount (seen live)", async () => {
        const get = jest.fn().mockResolvedValue({ status: 200, data: { data: { id: "m-1", availableBalance: 0, virtualAccount: { accountNumber: "8800112233", bankCode: "232", bankName: "Sterling Bank" } } } });
        const withGet = new FossapayVirtualAccountProvider({ post, get } as unknown as FossapayClient, "ops@ziks.app", "Nigeria");
        post.mockResolvedValueOnce({ status: 200, data: { status: "success" } });
        await withGet.sweepToPool({ fromAccount: "9712345741", amount: "495.00", reference: "sw123" });
        expect(post).toHaveBeenCalledWith("/wallets/fiat/transfers/wallet-to-wallet", { fromAccount: "9712345741", toAccount: "8800112233", amount: 495, reference: "sw123", narration: "Ziks pool" });
    });

    it("refuses a wallet reply without a real account number", async () => {
        post.mockResolvedValueOnce(customerOk).mockResolvedValueOnce({ status: 201, data: { data: {} } });
        await expect(fossapay.createAccount(customer)).rejects.toMatchObject({ code: "unavailable" });
    });
});
