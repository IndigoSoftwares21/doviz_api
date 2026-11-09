import createPinVerification from "@/actions/pinVerification/createPinVerification";
import hashPin from "@/utils/auth/hashPin";
import selectTransactionPinForUpdate from "@/actions/pinVerification/createPinVerification/queries/selectTransactionPinForUpdate";
import updatePinAttempts from "@/actions/pinVerification/createPinVerification/queries/updatePinAttempts";
import createAuditLog from "@/actions/auditLog/createAuditLog";

process.env.PIN_PEPPER = "test-pin-pepper-test-pin-pepper-test-0001";

jest.mock("@/database", () => ({
    withTransaction: (callback: (trx: unknown) => unknown) => callback({}),
}));
jest.mock("@/actions/pinVerification/createPinVerification/queries/selectTransactionPinForUpdate");
jest.mock("@/actions/pinVerification/createPinVerification/queries/updatePinAttempts");
jest.mock("@/actions/auditLog/createAuditLog");

// Real cost-12 bcrypt (~250ms each) runs several times per test; under
// parallel jest workers that can pass the 5s default, so allow more.
jest.setTimeout(30_000);

const userId = "user-1";
const args = (pin: string) => ({ userId, pin, ipAddress: "1.2.3.4", userAgent: "jest" });
let pinHash: string;
const pinRow = (overrides = {}) => ({ userId, pinHash, failedAttempts: 0, lockedUntil: null, ...overrides });
const auditActions = () => jest.mocked(createAuditLog).mock.calls.map(([call]) => call.action);

describe("createPinVerification", () => {
    beforeAll(async () => {
        pinHash = await hashPin({ userId, pin: "4827" });
    });
    beforeEach(() => jest.resetAllMocks());

    it("reports not_set when the user has no PIN", async () => {
        jest.mocked(selectTransactionPinForUpdate).mockResolvedValue(undefined);

        const { data } = await createPinVerification(args("4827"));

        expect(data).toEqual({ status: "not_set" });
    });

    it("refuses to check while locked — even the right PIN", async () => {
        const lockedUntil = new Date(Date.now() + 60_000);
        jest.mocked(selectTransactionPinForUpdate).mockResolvedValue(pinRow({ lockedUntil }));

        const { data } = await createPinVerification(args("4827"));

        expect(data).toEqual({ status: "locked", lockedUntil });
        expect(updatePinAttempts).not.toHaveBeenCalled();
    });

    it("verifies the right PIN and clears earlier failures", async () => {
        jest.mocked(selectTransactionPinForUpdate).mockResolvedValue(pinRow({ failedAttempts: 3 }));

        const { data } = await createPinVerification(args("4827"));

        expect(data).toEqual({ status: "verified" });
        expect(updatePinAttempts).toHaveBeenCalledWith(
            expect.objectContaining({ failedAttempts: 0, lockedUntil: null }),
        );
    });

    it("works again once a lock has expired", async () => {
        jest.mocked(selectTransactionPinForUpdate).mockResolvedValue(
            pinRow({ lockedUntil: new Date(Date.now() - 1000) }),
        );

        const { data } = await createPinVerification(args("4827"));

        expect(data).toEqual({ status: "verified" });
    });

    it("counts a wrong PIN and reports attempts left", async () => {
        jest.mocked(selectTransactionPinForUpdate).mockResolvedValue(pinRow({ failedAttempts: 1 }));

        const { data } = await createPinVerification(args("1111"));

        expect(data).toEqual({ status: "invalid", remainingAttempts: 3 });
        expect(updatePinAttempts).toHaveBeenCalledWith(
            expect.objectContaining({ failedAttempts: 2, lockedUntil: null }),
        );
        expect(auditActions()).toEqual(["security.pin.verification_failed"]);
    });

    it("locks for 30 minutes on the 5th wrong PIN", async () => {
        jest.mocked(selectTransactionPinForUpdate).mockResolvedValue(pinRow({ failedAttempts: 4 }));

        const { data } = await createPinVerification(args("1111"));

        expect(data.status).toBe("locked");
        const { lockedUntil } = jest.mocked(updatePinAttempts).mock.calls[0][0];
        expect(lockedUntil!.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
        expect(auditActions()).toEqual(["security.pin.verification_failed", "security.pin.locked"]);
        expect(JSON.stringify(jest.mocked(createAuditLog).mock.calls)).not.toContain("1111");
    });
});
