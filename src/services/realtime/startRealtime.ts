import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import monitoring from "@/utils/monitoring";
import REALTIME from "@/constants/realtime";
import authenticateSocket, { SocketUser } from "./authenticateSocket";
import listenForUserEvents from "./listenForUserEvents";

/**
 * Socket.IO on the API's HTTP server. Each signed-in device connects with
 * its access token, joins its user's room, and is disconnected when the
 * token expires (the app reconnects after unlocking, like any other call).
 * Events published anywhere (requests, webhooks, jobs, other instances)
 * reach the user's devices via Postgres LISTEN.
 */
const startRealtime = ({ server }: { server: HttpServer }) => {
    const io = new Server(server, { path: REALTIME.PATH, serveClient: false, cors: { origin: false } });
    io.use((socket, next) => void authenticateSocket(socket, next));

    io.on("connection", (socket) => {
        const user = socket.data.user as SocketUser;
        void socket.join(REALTIME.userRoom(user.userId));
        if (user.expiresAt) {
            const timer = setTimeout(() => socket.disconnect(true), Math.max(0, user.expiresAt.getTime() - Date.now()));
            socket.on("disconnect", () => clearTimeout(timer));
        }
    });

    const listener = listenForUserEvents({
        onEvent: ({ userId, event, data }) => io.to(REALTIME.userRoom(userId)).emit(event, data),
    });

    monitoring.info(`Realtime: socket server on ${REALTIME.PATH}`);
    return {
        io,
        stop: async () => {
            await listener.stop();
            await new Promise<void>((resolve) => io.close(() => resolve()));
        },
    };
};

export default startRealtime;
