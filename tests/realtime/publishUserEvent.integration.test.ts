/**
 * Real-Postgres check that user events are delivered only on COMMIT (skipped by default):
 *   DB_INTEGRATION=true DB_PORT=<port> npx jest tests/realtime/publishUserEvent.integration.test.ts
 */
import { Client } from "pg";
import { connectionDetails, db, disconnect } from "@/database";
import publishUserEvent from "@/services/realtime/publishUserEvent";
import { randomUUID } from "crypto";
import REALTIME, { REALTIME_EVENT } from "@/constants/realtime";

const run = process.env.DB_INTEGRATION === "true" ? describe : describe.skip;

run("publishUserEvent against Postgres", () => {
    const listener = new Client(connectionDetails);
    const received: unknown[] = [];
    // Other suites publish real events on the same channel; only count this test's user.
    const userId = `test-${randomUUID()}`;
    const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

    beforeAll(async () => {
        await listener.connect();
        listener.on("notification", (message) => {
            const event = JSON.parse(message.payload ?? "{}") as { userId?: string };
            if (event.userId === userId) received.push(event);
        });
        await listener.query(`LISTEN ${REALTIME.CHANNEL}`);
    });

    afterAll(async () => {
        await listener.end();
        await disconnect();
    });

    beforeEach(() => (received.length = 0));

    it("delivers an event once its transaction commits", async () => {
        await db.transaction().execute(async (trx) => {
            await publishUserEvent({ trx, userId, event: REALTIME_EVENT.BILL_PAYMENT_UPDATED, data: { billPaymentId: "p-1", status: "completed" } });
            await settle();
            expect(received).toEqual([]); // not before COMMIT
        });
        await settle();
        expect(received).toEqual([{ userId, event: "bill_payment.updated", data: { billPaymentId: "p-1", status: "completed" } }]);
    });

    it("never delivers an event whose transaction rolled back", async () => {
        await expect(
            db.transaction().execute(async (trx) => {
                await publishUserEvent({ trx, userId, event: REALTIME_EVENT.WALLET_BALANCE_CHANGED });
                throw new Error("ledger posting failed");
            }),
        ).rejects.toThrow("ledger posting failed");
        await settle();
        expect(received).toEqual([]);
    });
});
