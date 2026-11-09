import maskAccountNumber from "@/utils/banks/maskAccountNumber";
import selectUserBankAccounts from "./queries/selectUserBankAccounts";

/** Active withdrawal accounts; account numbers are always masked. */
const fetchBankAccounts = async ({ userId }: { userId: string }) => {
    const rows = await selectUserBankAccounts({ userId });

    const data = rows.map((row) => ({
        id: row.id,
        bankId: row.bankId,
        bankName: row.bankName,
        accountNumber: maskAccountNumber({ accountNumber: row.accountNumber }),
        accountName: row.accountName,
        isPrimary: row.isPrimary,
        verifiedAt: row.verifiedAt,
    }));

    return { data };
};

export default fetchBankAccounts;
