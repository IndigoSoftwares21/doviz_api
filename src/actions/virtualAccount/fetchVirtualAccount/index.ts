import selectActiveVirtualAccount from "./queries/selectActiveVirtualAccount";
import { VIRTUAL_ACCOUNT_STATUS } from "@/constants/nairaFunding";

/** The user's personal account number, as the app shows it (no provider names). */
const fetchVirtualAccount = async ({ userId }: { userId: string }) => {
    const account = await selectActiveVirtualAccount({ userId });
    return { data: { status: account ? VIRTUAL_ACCOUNT_STATUS.ACTIVE : VIRTUAL_ACCOUNT_STATUS.NONE, account } };
};

export default fetchVirtualAccount;
