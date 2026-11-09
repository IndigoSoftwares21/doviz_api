import { DepositStatus } from "@/constants/crypto";
import { DEPOSIT_STATUS } from "@/constants/cryptoStatus";
import { BREET_TRADE_STATUS } from "./constants";

/** Breet trade status → ours. Unknown statuses stay pending (never credited). */
const mapBreetStatus = ({ status }: { status: string }): DepositStatus => {
    switch (status) {
        case BREET_TRADE_STATUS.COMPLETED:
            return DEPOSIT_STATUS.COMPLETED;
        case BREET_TRADE_STATUS.FLAGGED:
            return DEPOSIT_STATUS.FLAGGED;
        case BREET_TRADE_STATUS.DELETED:
            return DEPOSIT_STATUS.DELETED;
        default:
            return DEPOSIT_STATUS.PENDING;
    }
};

export default mapBreetStatus;
