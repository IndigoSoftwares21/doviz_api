import Decimal from "decimal.js";

/** "1000.00" → "1,000.00", for messages shown to users. */
const FormatNaira = ({ value }: { value: string }) => {
    const [whole, kobo] = new Decimal(value).toFixed(2).split(".");
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${kobo}`;
};

export default FormatNaira;
