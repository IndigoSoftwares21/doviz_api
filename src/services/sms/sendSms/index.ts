import monitoring from "@/utils/monitoring";

// TODO: wire a real SMS provider (e.g. Termii, Twilio). Until then this
// refuses to run outside development so OTPs can never be silently dropped
// (or logged) in staging/production.
const sendSms = ({ to, message }: { to: string; message: string }) => {
    if (process.env.NODE_ENV !== "development") {
        throw new Error("SMS provider is not configured");
    }

    monitoring.info(`[DEV SMS] to ${to}: ${message}`);

    return Promise.resolve();
};

export default sendSms;
