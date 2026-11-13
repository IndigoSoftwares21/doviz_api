import { VirtualAccountCustomer } from "../../virtualAccountProvider";

/** Fossapay takes ONE name per field — no spaces or digits. */
const words = (value: string) => value.replace(/\d/g, "").trim().split(/\s+/).filter(Boolean);
/** "Ada Mary" → "Ada" (the first given name). */
const firstWord = (value: string) => words(value)[0] ?? value.trim();
/** "Okafor Eze" → "Okafor-Eze" (a family name kept whole). */
const hyphenated = (value: string) => words(value).join("-") || value.trim();

/**
 * Fossapay needs an email that's unique per customer. A user without one gets
 * the fallback address with our customer reference added
 * (ops@ziks.app → ops+zk1a2b…@ziks.app), so each is unique and reaches us.
 */
export const uniqueEmail = ({ email, fallback, customerRef }: { email: string; fallback: string; customerRef: string }) => {
    if (email !== fallback) return email;
    const [local, domain] = fallback.split("@");
    return `${local}+${customerRef}@${domain}`;
};

/** City at KYC, else the last part of the address ("12 Allen Ave, Ikeja" → "Ikeja"). */
export const cityOf = (customer: VirtualAccountCustomer) => customer.city ?? customer.address.split(",").map((part) => part.trim()).filter(Boolean).pop() ?? customer.address;

/** Our neutral customer → Fossapay's create-customer body (no unknown fields: Fossapay rejects them). */
const fossapayCustomerFields = ({ customer, email, country }: { customer: VirtualAccountCustomer; email: string; country: string }) => ({
    firstName: firstWord(customer.firstName),
    lastName: hyphenated(customer.lastName),
    ...(customer.middleName ? { middleName: firstWord(customer.middleName) } : {}),
    emailAddress: email,
    mobileNumber: customer.phoneNumber,
    dateOfBirth: customer.dateOfBirth,
    address: customer.address,
    city: cityOf(customer),
    country,
    type: "individual",
});

export default fossapayCustomerFields;
