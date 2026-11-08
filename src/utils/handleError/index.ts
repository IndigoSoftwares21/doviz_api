import { Request, Response } from "express";
import { ZodError } from "zod";
import { DatabaseError } from "pg";
import monitoring from "../monitoring";
import ERRORS from "@/constants/error_types";

interface IHandleError {
    res: Response;
    req?: Request;
    message?: string;
    code?: number;
    error?: any;
}

const handleError = ({
    res,
    req,
    message = "An error occurred",
    code = 500,
    error,
}: IHandleError): Response => {
    monitoring.error(message, error);

    let errorCode = code;
    let errorMessage = message;

    if (error instanceof ZodError) {
        errorCode = 400;
        errorMessage = ERRORS.FORM_VALIDATION_ERROR;

        const validationErrors = error.errors.map((err) => ({
            path: err.path,
            message: err.message,
        }));

        monitoring.info(`${req?.method} ${req?.originalUrl} - ${errorCode}`);

        return res.status(errorCode).json({
            message: errorMessage,
            code: errorCode,
            validationErrors,
        });
    }

    if (error instanceof DatabaseError) {
        const dbErrorCode = error.code || "DB_ERROR";

        monitoring.error(
            `Database error: Code ${dbErrorCode}, Detail: ${error.detail}`,
            Error(
                JSON.stringify(
                    {
                        user: (req as any)?.user,
                        code: dbErrorCode,
                        detail: error.detail,
                        constraint: error.constraint,
                        severity: error.severity,
                        schema: error.schema,
                        table: error.table,
                        column: error.column,
                        position: error.position,
                    },
                    null,
                    2,
                ),
            ),
        );

        switch (dbErrorCode) {
            case "23505":
                errorCode = 409;
                errorMessage =
                    ERRORS.DUPLICATE_ENTRY || "A duplicate entry was found";
                break;
            case "23503":
                errorCode = 400;
                errorMessage =
                    ERRORS.INVALID_REFERENCE ||
                    "Invalid reference to another resource";
                break;
            case "42P01":
            case "42703":
                errorCode = 500;
                errorMessage = ERRORS.SCHEMA_ERROR || "Database schema error";
                break;
            case "57014":
                errorCode = 504;
                errorMessage =
                    ERRORS.QUERY_TIMEOUT || "Database query timed out";
                break;
            default:
                errorCode = 500;
                errorMessage =
                    ERRORS.DATABASE_ERROR || "Database error occurred";
        }
    }

    if (error?.message && !errorMessage) {
        errorMessage = error.message;
    }

    monitoring.info(`${req?.method} ${req?.originalUrl} - ${errorCode}`);

    if (errorCode === 500) {
        return res.status(errorCode).json({
            message:
                "An error occurred while processing your request. Please try again later or contact support.",
            code: errorCode,
        });
    }

    return res.status(errorCode).json({
        message: errorMessage,
        code: errorCode,
    });
};

export default handleError;
