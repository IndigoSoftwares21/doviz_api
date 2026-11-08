import monitoring from "@/utils/monitoring";

// TODO: wire a real email provider (nodemailer + SMTP, or Postmark/SES).
// Until then this refuses to run outside development so verification codes
// are never silently dropped (or logged) in staging/production.
const sendEmail = ({
    to,
    subject,
    text,
}: {
    to: string;
    subject: string;
    text: string;
}) => {
    if (process.env.NODE_ENV !== "development") {
        throw new Error("Email provider is not configured");
    }

    monitoring.info(`[DEV EMAIL] to ${to} | ${subject}: ${text}`);

    return Promise.resolve();
};

export default sendEmail;
