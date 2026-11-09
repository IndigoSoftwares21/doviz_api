import { db } from "@/database";

const selectBankName = async ({ bankId }: { bankId: string }) => {
    const bankRow = await db.selectFrom("payout_banks").select(["name"]).where("id", "=", bankId).executeTakeFirstOrThrow();

    return bankRow;
};

export default selectBankName;
