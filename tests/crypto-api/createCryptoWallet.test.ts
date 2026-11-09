import createCryptoWallet from "@/actions/cryptoWallet/createCryptoWallet";
import selectWalletAsset from "@/actions/cryptoWallet/createCryptoWallet/queries/selectWalletAsset";
import selectCurrentWallet from "@/actions/cryptoWallet/createCryptoWallet/queries/selectCurrentWallet";
import insertPendingWallet from "@/actions/cryptoWallet/createCryptoWallet/queries/insertPendingWallet";
import updateWalletActive from "@/actions/cryptoWallet/createCryptoWallet/queries/updateWalletActive";
import updateSetPrimaryWallet from "@/actions/cryptoWallet/createCryptoWallet/queries/updateSetPrimaryWallet";
import createAuditLog from "@/actions/auditLog/createAuditLog";
import { useFakeProvider } from "./fakeProvider";

jest.mock("@/database", () => ({ withTransaction: (callback: (trx: unknown) => unknown) => callback({}) }));
jest.mock("@/actions/cryptoWallet/createCryptoWallet/queries/selectWalletAsset");
jest.mock("@/actions/cryptoWallet/createCryptoWallet/queries/selectCurrentWallet");
jest.mock("@/actions/cryptoWallet/createCryptoWallet/queries/insertPendingWallet");
jest.mock("@/actions/cryptoWallet/createCryptoWallet/queries/updateWalletActive");
jest.mock("@/actions/cryptoWallet/createCryptoWallet/queries/updateUnsetPrimaryWallets");
jest.mock("@/actions/cryptoWallet/createCryptoWallet/queries/updateSetPrimaryWallet");
jest.mock("@/actions/auditLog/createAuditLog");

const args = { userId: "user-1", assetId: "asset-1", ipAddress: "1.2.3.4", userAgent: "jest" };
const row = (overrides = {}) => ({
    id: "w-1", label: "dvz-w-1", status: "pending", isPrimary: false, address: null, createdAt: new Date(), ...overrides,
});
const active = row({ status: "active", isPrimary: true, address: "TV8dNYY" });

describe("createCryptoWallet", () => {
    let provider: ReturnType<typeof useFakeProvider>;
    beforeEach(() => {
        jest.resetAllMocks();
        provider = useFakeProvider();
        jest.mocked(selectWalletAsset).mockResolvedValue({ symbol: "USDT", network: "TRC20", providerAssetId: "pa-1", providerCode: "TRX_USDT" });
    });

    it("returns an existing primary address without calling the provider", async () => {
        jest.mocked(selectCurrentWallet).mockResolvedValue(active);
        const { data } = await createCryptoWallet(args);
        expect(data?.address).toBe("TV8dNYY");
        expect(provider.createDepositAddress).not.toHaveBeenCalled();
        expect(insertPendingWallet).not.toHaveBeenCalled();
    });

    it("stores a pending row first, labels it dvz-<id>, then activates it as primary", async () => {
        jest.mocked(selectCurrentWallet).mockResolvedValueOnce(undefined).mockResolvedValueOnce(row()).mockResolvedValue(active);
        provider.createDepositAddress.mockResolvedValue({ providerWalletId: "pw-1", address: "TV8dNYY" });
        await createCryptoWallet(args);

        const { id, label } = jest.mocked(insertPendingWallet).mock.calls[0][0];
        expect(label).toBe(`dvz-${id}`);
        expect(provider.createDepositAddress).toHaveBeenCalledWith({ providerAssetId: "pa-1", label: "dvz-w-1" });
        expect(updateWalletActive).toHaveBeenCalledWith(expect.objectContaining({ id: "w-1", address: "TV8dNYY", providerWalletId: "pw-1" }));
        expect(updateSetPrimaryWallet).toHaveBeenCalledWith(expect.objectContaining({ id: "w-1" }));
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "crypto.wallet.created" }));
    });

    it("recovers the address when the provider says the label already exists", async () => {
        jest.mocked(selectCurrentWallet).mockResolvedValueOnce(row()).mockResolvedValue(active);
        provider.createDepositAddress.mockRejectedValue(Object.assign(new Error("exists"), { code: "label_exists" }));
        provider.findAddressByLabel.mockResolvedValue({ providerWalletId: "pw-1", address: "TV8dNYY" });
        await createCryptoWallet(args);
        expect(provider.findAddressByLabel).toHaveBeenCalledWith({ providerCode: "TRX_USDT", label: "dvz-w-1" });
        expect(updateWalletActive).toHaveBeenCalled();
    });

    it("leaves the row pending when the provider fails (retry reuses the label)", async () => {
        jest.mocked(selectCurrentWallet).mockResolvedValue(row());
        provider.createDepositAddress.mockRejectedValue(new Error("timeout"));
        const result = await createCryptoWallet(args);
        expect(result).toEqual({ data: null, failure: "provider_unavailable" });
        expect(updateWalletActive).not.toHaveBeenCalled();
        expect(insertPendingWallet).not.toHaveBeenCalled();
    });

    it("uses the concurrent winner's row when its own insert loses the race", async () => {
        jest.mocked(selectCurrentWallet).mockResolvedValueOnce(undefined).mockResolvedValueOnce(row({ id: "w-other", label: "dvz-w-other" })).mockResolvedValue(active);
        jest.mocked(insertPendingWallet).mockResolvedValue(undefined);
        provider.createDepositAddress.mockResolvedValue({ providerWalletId: "pw-2", address: "TV8dNYY" });
        await createCryptoWallet(args);
        expect(provider.createDepositAddress).toHaveBeenCalledWith({ providerAssetId: "pa-1", label: "dvz-w-other" });
    });
});
