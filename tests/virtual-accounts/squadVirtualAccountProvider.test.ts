import SquadVirtualAccountProvider from "@/services/virtualAccounts/providers/squad/squadVirtualAccountProvider";
import SquadClient from "@/services/virtualAccounts/providers/squad/squadClient";

const customer = {
    customerRef: "zkabc",
    firstName: "Ada",
    middleName: null,
    lastName: "Okafor",
    dateOfBirth: "1994-03-18",
    gender: "female",
    address: "12 Allen Avenue, Ikeja",
    city: "Lagos",
    bvn: "22212345678",
    phoneNumber: "+2348031234567",
    email: "ada@example.com",
};
const created = (number = "0123456789") => ({ status: 200, data: { success: true, data: { first_name: "Ada", last_name: "Okafor", bank_code: "058", virtual_account_number: number, customer_identifier: "zkabc" } } });

describe("Squad account numbers", () => {
    const post = jest.fn();
    const get = jest.fn();
    const squad = new SquadVirtualAccountProvider({ post, get } as unknown as SquadClient, "sandbox", "5007013371");

    beforeEach(() => {
        jest.resetAllMocks();
        for (const method of ["info", "warn", "error"] as const) jest.spyOn(console, method).mockImplementation(() => undefined);
    });

    it("sends the verified details in Squad's formats, settling to our GTBank account", async () => {
        post.mockResolvedValue(created());
        await expect(squad.createAccount(customer)).resolves.toEqual({ accountNumber: "0123456789", accountName: "Ada Okafor", bankName: "GTBank", bankCode: "058" });
        expect(post).toHaveBeenCalledWith("/virtual-account", {
            first_name: "Ada",
            last_name: "Okafor",
            middle_name: "",
            mobile_num: "08031234567",
            dob: "03/18/1994",
            email: "ada@example.com",
            bvn: "22212345678",
            gender: "2",
            address: "12 Allen Avenue, Ikeja",
            customer_identifier: "zkabc",
            beneficiary_account: "5007013371",
        });
    });

    it("returns the existing account when it was already created (e.g. a lost reply), never a second one", async () => {
        post.mockResolvedValue({ status: 400, data: { message: "Customer identifier already exists" } });
        get.mockResolvedValue(created("0987654321"));
        await expect(squad.createAccount(customer)).resolves.toMatchObject({ accountNumber: "0987654321" });
        expect(get).toHaveBeenCalledWith("/virtual-account/zkabc");
    });

    it.each([
        ["a network failure", { status: null, code: "ECONNRESET" }, "unavailable"],
        ["an outage", { status: 502, data: {} }, "unavailable"],
        ["our key refused", { status: 403, data: { message: "Merchant authentication failed" } }, "unavailable"],
        ["a refused customer", { status: 400, data: { message: "BVN details do not match" } }, "rejected"],
        ["our merchant's account-opening limit (seen live)", { status: 400, data: { message: "Merchant has reached account opening limit, please contact habaripay support" } }, "unavailable"],
    ])("maps %s to %s", async (_why, reply, code) => {
        post.mockResolvedValue(reply);
        get.mockResolvedValue({ status: 404, data: {} });
        await expect(squad.createAccount(customer)).rejects.toMatchObject({ code });
    });

    it("refuses a reply without a real account number", async () => {
        post.mockResolvedValue({ status: 200, data: { data: {} } });
        await expect(squad.createAccount(customer)).rejects.toMatchObject({ code: "unavailable" });
    });
});
