const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, QUARTER: 90, YEAR: 365 };

const WORD_NUMBERS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, SIX: 6, SEVEN: 7, TWELVE: 12, THIRTY: 30 };

/**
 * Validity in days from a raw product name, for providers that don't state
 * it: "SMART - One Month" → 30, "7 Days" → 7, "Light Quarterly" → 90. null when unclear.
 */
const parseValidityDays = ({ name }: { name: string }) => {
    const text = name.toUpperCase();

    const counted = text.match(/\b(\d+|ONE|TWO|THREE|FOUR|SIX|SEVEN|TWELVE|THIRTY)\s*-?\s*(DAY|WEEK|MONTH|YEAR)S?\b/);
    if (counted) {
        const count = /^\d+$/.test(counted[1]) ? Number(counted[1]) : WORD_NUMBERS[counted[1]];
        return count > 0 ? count * UNIT_DAYS[counted[2]] : null;
    }

    if (/\bDAILY\b|\b24\s*HRS?\b/.test(text)) return UNIT_DAYS.DAY;
    if (/\bWEEKLY\b/.test(text)) return UNIT_DAYS.WEEK;
    if (/\bMONTHLY\b/.test(text)) return UNIT_DAYS.MONTH;
    if (/\bQUARTER(LY)?\b/.test(text)) return UNIT_DAYS.QUARTER;
    if (/\b(YEARLY|ANNUAL(LY)?)\b/.test(text)) return UNIT_DAYS.YEAR;
    return null;
};

export default parseValidityDays;
