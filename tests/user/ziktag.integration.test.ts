/**
 * Real-Postgres check of Ziktags (skipped by default). Run against a DISPOSABLE, migrated database:
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/user/ziktag.integration.test.ts
 */
import { randomUUID } from "crypto";
import { db, disconnect } from "@/database";
import modifyUserTag from "@/actions/userTag/modifyUserTag";
import fetchTagAvailability from "@/actions/userTag/fetchTagAvailability";
import createPinVerification from "@/actions/pinVerification/createPinVerification";
import putUserTagSchema from "@/controllers/userTag/put/schema/putUserTagSchema";

jest.mock("@/actions/pinVerification/createPinVerification");

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("Ziktags against Postgres", () => {
    const run6 = randomUUID().replace(/-/g, "").slice(0, 6);
    const t = (name: string) => `${name}${run6}`; // unique per run, ≤ 20 chars
    const newUser = async () =>
        (await db.insertInto("users").values({ phoneNumber: `+23485${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`, status: "active", firstName: "Ada", lastName: "Okafor" } as never)
            .returning(["id"]).executeTakeFirstOrThrow()).id;
    const set = (userId: string, value: string, pin: string | null = null) => modifyUserTag({ userId, value, pin, ipAddress: null, userAgent: null });
    const backdate = (userId: string) => db.updateTable("users").set({ tagChangedAt: new Date(Date.now() - 31 * 86_400_000) }).where("id", "=", userId).execute();

    beforeEach(() => jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "verified" } } as never));
    afterAll(() => disconnect());

    it("is unique whatever the case, and the check never says who has it", async () => {
        const [a, b] = [await newUser(), await newUser()];
        await expect(set(a, `@${t("Ada_")}`.toUpperCase())).resolves.toMatchObject({ failure: null, data: { tag: t("ada_") } });
        await expect(set(b, t("ADA_"))).resolves.toMatchObject({ failure: "taken" });

        const { data: forB } = await fetchTagAvailability({ userId: b, value: t("ada_") });
        expect(forB).toMatchObject({ available: false, reason: "taken" });
        expect(Object.keys(forB)).toEqual(["tag", "available", "reason", "suggestions"]);
        await expect(fetchTagAvailability({ userId: a, value: t("ada_") })).resolves.toMatchObject({ data: { available: true, reason: null } });
    });

    it("first set is free; a change needs the PIN and waits 30 days; the same tag is a no-op", async () => {
        const a = await newUser();
        const first = await set(a, t("tun_"));
        await expect(set(a, t("tunde_"))).resolves.toMatchObject({ failure: "pin_required" });
        await expect(set(a, t("tunde_"), "4827")).resolves.toMatchObject({ failure: "cooldown", nextChangeAt: first.data!.nextChangeAt });

        const again = await set(a, t("tun_"), "4827");
        expect(again).toMatchObject({ failure: null, data: { tag: t("tun_"), changedAt: first.data!.changedAt } });
        const holds = await db.selectFrom("user_tag_history").select(["tag"]).where("userId", "=", a).execute();
        expect(holds).toHaveLength(0);
    });

    it("a wrong PIN changes nothing", async () => {
        const a = await newUser();
        await set(a, t("pin_"));
        await backdate(a);
        jest.mocked(createPinVerification).mockResolvedValue({ data: { status: "invalid", remainingAttempts: 2 } } as never);
        await expect(set(a, t("pinx_"), "0000")).resolves.toMatchObject({ failure: "pin" });
        const row = await db.selectFrom("users").select(["tag"]).where("id", "=", a).executeTakeFirstOrThrow();
        expect(row.tag).toBe(t("pin_"));
    });

    it("holds a released tag for 30 days: blocked for others, not for its owner", async () => {
        const [a, b] = [await newUser(), await newUser()];
        await set(a, t("old_"));
        await backdate(a);
        await expect(set(a, t("new_"), "4827")).resolves.toMatchObject({ failure: null });

        await expect(set(b, t("old_"))).resolves.toMatchObject({ failure: "taken" });
        await expect(fetchTagAvailability({ userId: b, value: t("old_") })).resolves.toMatchObject({ data: { reason: "taken" } });

        await backdate(a);
        await expect(set(a, t("old_"), "4827")).resolves.toMatchObject({ failure: null, data: { tag: t("old_") } });
    });

    it("two people grabbing the same tag at once: one wins, the other gets taken", async () => {
        const [c, d] = [await newUser(), await newUser()];
        const results = await Promise.all([set(c, t("race_")), set(d, t("race_"))]);
        expect(results.map((r) => r.failure).sort()).toEqual([null, "taken"]);
    });

    it("the request schema refuses taken and on-hold tags with 400-shaped errors on `tag` — same rule as /check", async () => {
        const [a, b] = [await newUser(), await newUser()];
        await set(a, t("held_"));
        await backdate(a);
        await set(a, t("mine_"), "4827"); // held_ is now on hold for a

        const issues = async (userId: string, tag: string) => {
            const parsed = await putUserTagSchema.safeParseAsync({ userId, tag });
            return parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }));
        };
        await expect(issues(b, t("MINE_"))).resolves.toEqual([{ path: ["tag"], message: "That Ziktag is taken" }]);
        await expect(issues(b, t("held_"))).resolves.toEqual([{ path: ["tag"], message: "That Ziktag is taken" }]);
        await expect(issues(b, "ziks_support")).resolves.toEqual([{ path: ["tag"], message: "That Ziktag isn't available" }]);
        await expect(issues(a, t("held_"))).resolves.toEqual([]); // its owner may take it back
        await expect(issues(a, t("mine_"))).resolves.toEqual([]); // their own current tag
    });

    it("the database itself refuses a malformed tag", async () => {
        const a = await newUser();
        await expect(db.updateTable("users").set({ tag: "Bad Tag" }).where("id", "=", a).execute()).rejects.toThrow(/users_tag_format/);
    });
});
