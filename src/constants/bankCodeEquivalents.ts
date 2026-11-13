/**
 * The same bank under different code systems. Providers disagree: some use
 * CBN bank codes (GTBank "058"), others NIP institution codes (GTBank
 * "000013"), and fintechs have provider-specific ones (OPay "305" vs
 * "100004"). Each group is one bank; bank sync treats any code in a group as
 * that bank, so a user's saved account works whichever payout provider is on.
 * Pairs marked ✓ were seen side by side in our own Korapay/Fossapay lists.
 */
const BANK_CODE_EQUIVALENTS: readonly (readonly string[])[] = [
    ["058", "000013"], // GTBank ✓
    ["057", "000015"], // Zenith ✓
    ["044", "000014"], // Access
    ["063", "000005"], // Access (Diamond)
    ["011", "000016"], // First Bank
    ["033", "000004"], // UBA
    ["214", "000003"], // FCMB
    ["070", "000007"], // Fidelity
    ["076", "000008"], // Polaris
    ["221", "000012"], // Stanbic IBTC
    ["232", "000001"], // Sterling ✓
    ["035", "000017"], // Wema ✓
    ["032", "000018"], // Union ✓
    ["050", "000010"], // Ecobank ✓
    ["082", "000002"], // Keystone ✓
    ["215", "000011"], // Unity ✓
    ["101", "000023"], // Providus ✓
    ["100", "000022"], // Suntrust ✓
    ["301", "000006"], // Jaiz ✓
    ["302", "000026"], // Taj ✓
    ["303", "000029"], // Lotus ✓
    ["526", "000030"], // Parallex ✓
    ["105", "000031"], // Premium Trust ✓
    ["102", "000025"], // Titan Trust
    ["103", "000027"], // Globus
    ["106", "000034"], // Signature
    ["107", "000036"], // Optimus
    ["023", "000009"], // Citibank
    ["068", "000021"], // Standard Chartered
    ["305", "100004"], // OPay ✓
    ["50211", "090267"], // Kuda ✓
];

/** Every code that means the same bank as `code` (including itself). */
export const equivalentBankCodes = (code: string) => BANK_CODE_EQUIVALENTS.find((group) => group.includes(code)) ?? [code];

export default BANK_CODE_EQUIVALENTS;
