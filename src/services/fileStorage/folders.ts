/** Storage folders. Each is created once by `npm run storage:setup` with the access shown. */
const STORAGE_FOLDERS = {
    /** KYC evidence (selfies) — encrypted by the vault, readable only via short-lived signed links. */
    KYC_EVIDENCE: { path: process.env.DREEP_KYC_FOLDER || "kyc-evidence", access: "signed" as const },
} as const;

export default STORAGE_FOLDERS;
