import { db } from "@/database";

interface IInsertDemo {
    name: string;
}

const insertDemo = async ({ name }: IInsertDemo) => {
    const row = await db
        .insertInto("demo")
        .values({ name })
        .returning(["id", "name", "createdAt"])
        .executeTakeFirstOrThrow();

    return row;
};

export default insertDemo;
