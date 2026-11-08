import DOCS from "@/constants/docs";

// Fails closed: with no (or a weak) password/secret configured, the docs are
// disabled entirely rather than falling back to a default.
const getDocsConfig = () => {
    const password = process.env.DOCS_PASSWORD;
    const secret = process.env.DOCS_SESSION_SECRET;

    if (
        !password ||
        password.length < DOCS.MIN_PASSWORD_LENGTH ||
        !secret ||
        secret.length < DOCS.MIN_SECRET_LENGTH
    ) {
        return null;
    }

    return { password, secret };
};

export default getDocsConfig;
