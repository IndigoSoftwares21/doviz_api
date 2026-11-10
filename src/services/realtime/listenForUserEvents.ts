import { Client } from "pg";
import { connectionDetails } from "@/database";
import monitoring from "@/utils/monitoring";
import REALTIME from "@/constants/realtime";

export interface UserEvent {
    userId: string;
    event: string;
    data: Record<string, unknown>;
}

const RECONNECT_AFTER_MS = 5000;

/**
 * LISTENs on the user-events channel with its own connection (a pooled one
 * would be handed back and stop listening). Reconnects after a drop; events
 * published while it's down are missed, which is fine — they only prompt the
 * app to refresh, and the app also refreshes when it reconnects.
 */
const listenForUserEvents = ({ onEvent }: { onEvent: (event: UserEvent) => void }) => {
    let stopped = false;
    let client: Client | null = null;

    const connect = async () => {
        if (stopped) return;
        const current = new Client(connectionDetails);
        client = current;
        current.on("notification", (message) => {
            try {
                const parsed = JSON.parse(message.payload ?? "") as UserEvent;
                if (typeof parsed.userId === "string" && typeof parsed.event === "string") onEvent(parsed);
            } catch (error) {
                monitoring.warn(`Realtime: unreadable event (${(error as Error).message})`);
            }
        });
        current.on("error", (error) => {
            monitoring.error("Realtime: listener connection lost — reconnecting", error);
            current.end().catch(() => undefined);
            if (!stopped) setTimeout(connect, RECONNECT_AFTER_MS).unref();
        });
        try {
            await current.connect();
            await current.query(`LISTEN ${REALTIME.CHANNEL}`);
            monitoring.info(`Realtime: listening on ${REALTIME.CHANNEL}`);
        } catch (error) {
            monitoring.error("Realtime: couldn't start listening — retrying", error as Error);
            current.end().catch(() => undefined);
            if (!stopped) setTimeout(connect, RECONNECT_AFTER_MS).unref();
        }
    };

    void connect();

    return {
        stop: async () => {
            stopped = true;
            await client?.end().catch(() => undefined);
        },
    };
};

export default listenForUserEvents;
