import { PROVIDER_TRANSFER_STATUS, ProviderTransferStatus } from "@/constants/nairaDeposits";

/** Korapay charge status → ours. Anything unknown stays pending (never credited on a guess). */
const mapKorapayChargeStatus = ({ status }: { status: string | undefined }): ProviderTransferStatus => {
    switch ((status ?? "").toLowerCase()) {
        case "success":
            return PROVIDER_TRANSFER_STATUS.COMPLETED;
        case "expired":
            return PROVIDER_TRANSFER_STATUS.EXPIRED;
        case "failed":
            return PROVIDER_TRANSFER_STATUS.FAILED;
        default:
            return PROVIDER_TRANSFER_STATUS.PENDING;
    }
};

export default mapKorapayChargeStatus;
