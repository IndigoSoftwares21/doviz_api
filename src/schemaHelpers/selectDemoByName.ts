import { db } from "@/database";

const selectDemoByName = async ({ name }: { name: string }) => {
    const demoRow = await db
        .selectFrom("demo")
        .select(["id"])
        .where("name", "=", name)
        .executeTakeFirst();

    return demoRow;
};

export default selectDemoByName;
