import Decimal from "decimal.js";
import { STATEMENT_SEARCH, STATEMENT_SEARCH_KEYWORDS } from "@/constants/statementSearch";
import { StatementSearch } from "@/types/statementFilters";

/** Escapes LIKE wildcards so a typed "%" or "_" is matched literally. */
const escapeLike = ({ text }: { text: string }) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Turns what the user typed into the ways a statement line can match it:
 * its biller / coin, a customer number, an exact amount, a reference
 * prefix, or keywords for the kind of transaction ("airtime", "refund").
 */
const buildStatementSearch = ({ q }: { q: string }): StatementSearch => {
    const text = q.trim().replace(/\s+/g, " ");
    const lower = text.toLowerCase();

    const amountText = lower.replace(/[₦,\s]/g, "").replace(/^ngn/, "");
    const amount = /^\d+(\.\d{1,2})?$/.test(amountText) ? new Decimal(amountText).toFixed(2) : null;

    const reference = /^[0-9a-f-]+$/.test(lower) && lower.length >= STATEMENT_SEARCH.MIN_REFERENCE_LENGTH ? lower : null;

    const digits = text.replace(/[\s-]/g, "");
    const customerDigits = /^\+?\d+$/.test(digits) && digits.replace("+", "").length >= STATEMENT_SEARCH.MIN_CUSTOMER_DIGITS
        ? digits.replace("+", "")
        : null;

    const words = lower.split(/[^a-z]+/).filter((word) => word.length >= STATEMENT_SEARCH.MIN_KEYWORD_LENGTH);
    const matched = STATEMENT_SEARCH_KEYWORDS.filter((entry) =>
        words.some((word) => entry.words.some((keyword) => keyword.startsWith(word))),
    );

    return {
        contains: `%${escapeLike({ text })}%`,
        prefix: `${escapeLike({ text })}%`,
        amount,
        referencePrefix: reference ? `${escapeLike({ text: reference })}%` : null,
        customerContains: customerDigits ? `%${escapeLike({ text: customerDigits })}%` : null,
        ledgerTypes: [...new Set(matched.flatMap((entry) => entry.ledgerTypes ?? []))],
        billCategories: [...new Set(matched.flatMap((entry) => entry.billCategories ?? []))],
    };
};

export default buildStatementSearch;
