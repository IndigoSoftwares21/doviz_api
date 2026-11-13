import { createHash } from "crypto";

/**
 * Our reference for a user at an account-number provider: stable (a retry
 * after a lost reply finds the same account) and opaque (not the user id).
 */
const virtualAccountCustomerRef = ({ userId }: { userId: string }) => `zk${createHash("sha256").update(`ziks-virtual-account:${userId}`).digest("hex").slice(0, 30)}`;

export default virtualAccountCustomerRef;
