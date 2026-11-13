import fetchActiveKycLevel from "@/actions/appSettings/fetchActiveKycLevel";
import selectAppSetting from "@/actions/appSettings/fetchActiveKycLevel/queries/selectAppSetting";

jest.mock("@/database", () => ({ db: {} }));
jest.mock("@/actions/appSettings/fetchActiveKycLevel/queries/selectAppSetting");

describe("KYC level setting", () => {
    it.each(["bvn", "bvn_selfie"])("uses %s when it's set", async (value) => {
        jest.mocked(selectAppSetting).mockResolvedValue({ value });
        await expect(fetchActiveKycLevel()).resolves.toEqual({ data: value });
        expect(selectAppSetting).toHaveBeenCalledWith({ key: "kyc_level" });
    });

    it.each([[null], [{ value: "bvn_liveness" }], [{ value: "anything" }]])("falls back to bvn when missing or a level with no form (%#)", async (setting) => {
        jest.mocked(selectAppSetting).mockResolvedValue(setting);
        await expect(fetchActiveKycLevel()).resolves.toEqual({ data: "bvn" });
    });
});
