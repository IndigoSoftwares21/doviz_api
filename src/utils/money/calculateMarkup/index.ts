import Decimal from "decimal.js";

/**
 * Splits a gross naira amount into Doviz's markup and what the user gets.
 * The markup is rounded DOWN to the kobo, so rounding always favours the
 * user, and net = gross − markup exactly (the database checks this too).
 */
const calculateMarkup = ({ grossNgn, markupPercent }: { grossNgn: string; markupPercent: string }) => {
    const gross = new Decimal(grossNgn);
    const markup = gross.times(markupPercent).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const net = gross.minus(markup);

    return { markupNgn: markup.toFixed(2), netNgn: net.toFixed(2) };
};

export default calculateMarkup;
