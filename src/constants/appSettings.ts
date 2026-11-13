import { KYC_FORMS } from "@/constants/kycFields";

/**
 * Every feature switch in app_settings, with its allowed values and the value
 * used when it's missing. Set with `npm run settings:set -- <key> <value>`
 * (audited); the API reads it on each request, so no restart or release.
 */
export const APP_SETTINGS = {
    /** Which checks identity verification runs. */
    kyc_level: { values: Object.keys(KYC_FORMS), fallback: "bvn" },
    /** Whether users can send to ANY bank account, not just their own saved ones. */
    bank_transfers_to_others: { values: ["on", "off"], fallback: "off" },
} as const satisfies Record<string, { values: readonly string[]; fallback: string }>;

export type AppSettingKey = keyof typeof APP_SETTINGS;
