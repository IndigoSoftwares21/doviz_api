/**
 * Every kind of KYC data Ziks can hold. One definition drives the app's form
 * (GET /user/kyc → form.fields), the server's validation, and storage
 * (kyc_fields.field_key), so they can't drift. Adding a field — e.g. NIN — is
 * an entry here plus a form that asks for it: no migration, no app release
 * (unless it needs a brand-new `type`).
 */
export const KYC_FIELD_TYPE = {
    NAME: "name",
    DIGITS: "digits",
    DATE: "date",
    CHOICE: "choice",
    TEXT: "text",
} as const;

export type KycFieldType = (typeof KYC_FIELD_TYPE)[keyof typeof KYC_FIELD_TYPE];

export interface KycFieldDefinition {
    key: string;
    type: KycFieldType;
    label: string;
    hint: string | null;
    /** `digits`: exact length. */
    length?: number;
    /** `text`: length limits. */
    minLength?: number;
    maxLength?: number;
    /** `date` of birth: allowed age range. */
    minAge?: number;
    maxAge?: number;
    /** `choice`: the allowed values. */
    options?: { value: string; label: string }[];
    /** Unique to one Ziks user (claimed), and indexed for lookups. */
    identifier?: boolean;
    /** Safe-to-show hint kept beside the encrypted value. */
    displayHint?: "last4";
    /** Profile field the app may pre-fill from, when nothing is on file. */
    prefill?: "firstName" | "middleName" | "lastName";
}

export const KYC_FIELDS: Record<string, KycFieldDefinition> = {
    bvn: {
        key: "bvn",
        type: KYC_FIELD_TYPE.DIGITS,
        label: "BVN",
        hint: "We use your BVN to confirm it's you and to open your Ziks account number. It doesn't give us access to your bank accounts or money.",
        length: 11,
        identifier: true,
        displayHint: "last4",
    },
    first_name: { key: "first_name", type: KYC_FIELD_TYPE.NAME, label: "First name", hint: "Exactly as on your BVN.", prefill: "firstName" },
    middle_name: { key: "middle_name", type: KYC_FIELD_TYPE.NAME, label: "Middle name", hint: "Only if it's on your BVN.", prefill: "middleName" },
    last_name: { key: "last_name", type: KYC_FIELD_TYPE.NAME, label: "Last name", hint: "Exactly as on your BVN.", prefill: "lastName" },
    date_of_birth: { key: "date_of_birth", type: KYC_FIELD_TYPE.DATE, label: "Date of birth", hint: null, minAge: 18, maxAge: 120 },
    gender: {
        key: "gender",
        type: KYC_FIELD_TYPE.CHOICE,
        label: "Gender",
        hint: "As on your BVN.",
        options: [
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
        ],
    },
    address: { key: "address", type: KYC_FIELD_TYPE.TEXT, label: "Home address", hint: null, minLength: 5, maxLength: 200 },
};

/** What each verification level asks for. */
export const KYC_FORMS: Record<string, { required: string[]; optional: string[] }> = {
    bvn: { required: ["bvn", "first_name", "last_name", "date_of_birth", "gender", "address"], optional: ["middle_name"] },
};
