/** How an idle session was unlocked (audit metadata). */
const UNLOCK_METHOD = {
    PIN: "pin",
    BIOMETRIC: "biometric",
} as const;

export type UnlockMethod = (typeof UNLOCK_METHOD)[keyof typeof UNLOCK_METHOD];

export default UNLOCK_METHOD;
