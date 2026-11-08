import { Request } from "express";

const getCookie = ({ req, name }: { req: Request; name: string }) => {
    const header = req.headers.cookie;

    if (!header) {
        return undefined;
    }

    const pair = header
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    if (!pair) {
        return undefined;
    }

    try {
        const value = decodeURIComponent(pair.slice(name.length + 1));
        return value;
    } catch {
        return undefined;
    }
};

export default getCookie;
