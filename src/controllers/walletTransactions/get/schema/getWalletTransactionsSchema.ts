import { z } from "zod";
import { ENTRY_DIRECTION, STATEMENT_TYPE_FILTER } from "@/constants/ledger";
import decodeStatementCursor from "@/utils/wallet/decodeStatementCursor";
import buildStatementSearch from "@/utils/wallet/buildStatementSearch";
import { STATEMENT_SEARCH } from "@/constants/statementSearch";

const toInt = (value: unknown) => (value === undefined || value === "" ? undefined : Number(value));

const DIRECTIONS = [ENTRY_DIRECTION.CREDIT, ENTRY_DIRECTION.DEBIT] as const;
const TYPES = [
    STATEMENT_TYPE_FILTER.CRYPTO,
    STATEMENT_TYPE_FILTER.BANK_TRANSFER,
    STATEMENT_TYPE_FILTER.WITHDRAWAL,
    STATEMENT_TYPE_FILTER.BILL,
    STATEMENT_TYPE_FILTER.TRANSFER,
] as const;

/** ISO 8601 with an explicit offset (e.g. 2026-11-01T00:00:00+01:00), so a day boundary means the user's day. */
const instant = z
    .string()
    .trim()
    .datetime({ offset: true, message: "Use an ISO 8601 date-time with a timezone offset" })
    .transform((value) => new Date(value))
    .optional();

/** The widest range one request may ask for: keeps the query bounded. */
const MAX_RANGE_DAYS = 366;

const getWalletTransactionsSchema = z
    .object({
        cursor: z
            .string()
            .optional()
            .transform((cursor, ctx) => {
                if (!cursor) return null;
                const entryId = decodeStatementCursor({ cursor });
                if (!entryId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid cursor" });
                return entryId;
            }),
        size: z.preprocess(toInt, z.number().int().min(1).max(50, "Size can be at most 50").default(20)),
        direction: z
            .string()
            .trim()
            .toLowerCase()
            .pipe(z.enum(DIRECTIONS, { errorMap: () => ({ message: `Direction must be one of: ${DIRECTIONS.join(", ")}` }) }))
            .optional(),
        type: z
            .string()
            .trim()
            .toLowerCase()
            .pipe(z.enum(TYPES, { errorMap: () => ({ message: `Type must be one of: ${TYPES.join(", ")}` }) }))
            .optional(),
        from: instant,
        to: instant,
        q: z
            .string()
            .trim()
            .min(STATEMENT_SEARCH.MIN_LENGTH, `Search needs at least ${STATEMENT_SEARCH.MIN_LENGTH} characters`)
            .max(STATEMENT_SEARCH.MAX_LENGTH, `Search can be at most ${STATEMENT_SEARCH.MAX_LENGTH} characters`)
            .transform((q) => buildStatementSearch({ q }))
            .optional(),
    })
    .superRefine(({ from, to }, ctx) => {
        if (from && to && from >= to) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "To must be after from" });
        }
        if (from && to && to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["from"], message: `Date range can be at most ${MAX_RANGE_DAYS} days` });
        }
    });

export default getWalletTransactionsSchema;
