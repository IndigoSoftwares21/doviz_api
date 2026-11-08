import { Request, Response } from "express";
import monitoring from "../monitoring";

interface IHandleSuccess {
    res: Response;
    req?: Request;
    message: string;
    code: number;
    data?: any;
}

/**
 * Utility function to handle success responses and send a structured success response.
 *
 * @param {IHandleSuccess} params - The parameters including the response object, message, success code, and optional data.
 * @returns {Response} The response object with the success details in JSON format.
 */
/**
 * Recursively converts BigInt values to strings to make objects JSON-serializable.
 */
const convertBigIntToString = (value: unknown): any => {
    if (typeof value === "bigint") {
        return value.toString();
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((item) => convertBigIntToString(item));
    }
    if (value && typeof value === "object") {
        const inputRecord = value as Record<string, unknown>;
        const output: Record<string, unknown> = {};
        for (const key of Object.keys(inputRecord)) {
            output[key] = convertBigIntToString(inputRecord[key]);
        }
        return output;
    }
    return value;
};

const handleSuccess = ({
    res,
    req,
    message = "Success",
    code = 204, // Default status code to 204
    data,
}: IHandleSuccess): Response => {
    monitoring.info(`${req?.method} ${req?.originalUrl} - ${code}`);

    const successResponse = {
        message,
        code,
        data: data ? convertBigIntToString(data) : null,
    };

    return res.status(code).json(successResponse);
};

export default handleSuccess;
