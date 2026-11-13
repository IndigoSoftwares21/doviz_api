import { db } from "@/database";

const selectAppSetting = async ({ key }: { key: string }) => {
    const settingRow = await db.selectFrom("app_settings").select(["value"]).where("key", "=", key).executeTakeFirst();
    return settingRow ?? null;
};

export default selectAppSetting;
