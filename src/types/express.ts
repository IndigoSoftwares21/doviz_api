// Adds the authenticated user that requireAuth attaches to the request.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: { id: string; sessionId: string; deviceId: string };
        }
    }
}

export {};
