import { db } from "@/database";

interface ISelectDemo {
    limit: number;
}

const selectDemo = async ({ limit }: ISelectDemo) => {
    const demoRows = await db
        .selectFrom("demo")
        .select(["id", "name", "createdAt"])
        .orderBy("createdAt", "desc")
        .limit(limit)
        .execute();

    return demoRows;
};

export default selectDemo;
