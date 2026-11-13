import fetchVerifiedKycFields from "@/actions/kycFields/fetchVerifiedKycFields";
import selectProfileNames from "./queries/selectProfileNames";
import fetchActiveKycLevel from "@/actions/appSettings/fetchActiveKycLevel";
import { KYC_FIELDS, KYC_FORMS } from "@/constants/kycFields";

/**
 * The KYC form the app draws for a level — field by field, from the same
 * definitions the server validates with. Fields on file — from the user's
 * VERIFIED details only, never a rejected attempt — come back `onFile` (the
 * user may leave them out and they're reused); identifiers show
 * only a masked hint. Never returns a stored value.
 */
const fetchKycForm = async ({ userId }: { userId: string }) => {
    const { data: level } = await fetchActiveKycLevel();
    const form = KYC_FORMS[level];
    const [{ data: onFile }, profile] = await Promise.all([fetchVerifiedKycFields({ userId }), selectProfileNames({ userId })]);

    const fields = [...form.required, ...form.optional].map((key) => {
        const { identifier: _identifier, displayHint: _displayHint, prefill, fresh, storedAsFile: _storedAsFile, ...definition } = KYC_FIELDS[key];
        const saved = fresh ? undefined : onFile.get(key);
        return {
            ...definition,
            required: form.required.includes(key),
            onFile: Boolean(saved),
            /** What to show for a saved value, e.g. "•••••••5678"; null when there's nothing safe to show. */
            display: saved?.displayHint ? `•••••••${saved.displayHint}` : null,
            /** A suggested starting value (from the profile) — only when nothing is on file. */
            value: !saved && prefill ? (profile?.[prefill] ?? null) : null,
        };
    });

    return { data: { level, fields } };
};

export default fetchKycForm;
