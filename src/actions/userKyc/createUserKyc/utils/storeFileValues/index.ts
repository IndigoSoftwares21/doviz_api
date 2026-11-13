import { randomUUID } from "crypto";
import getFileStorage from "@/services/fileStorage/getFileStorage";
import STORAGE_FOLDERS from "@/services/fileStorage/folders";
import { StoredFile } from "@/services/fileStorage/fileStorage";
import getKycKeyring from "@/services/kycVault/getKycKeyring";
import sealKycValue from "@/services/kycVault/sealKycValue";
import { KYC_FIELDS } from "@/constants/kycFields";

/** The file's own encryption context: bound to the user, the field and this blob. */
export const fileFieldKey = (fieldKey: string) => `${fieldKey}:file`;

/**
 * For fields kept as files (a selfie): encrypts the content with its own key
 * (bound to user + field + blob id), uploads the ciphertext to file storage,
 * and swaps the value for a pointer — which is itself encrypted as the field's
 * value. Returns the uploads so the caller can delete them if the attempt
 * isn't recorded.
 */
const storeFileValues = async ({ userId, values }: { userId: string; values: Record<string, string> }) => {
    const stored: Record<string, string> = { ...values };
    const uploads: StoredFile[] = [];
    try {
        for (const [key, value] of Object.entries(values)) {
            if (!KYC_FIELDS[key]?.storedAsFile) continue;
            const blobId = randomUUID();
            const sealed = sealKycValue({ userId, fieldKey: fileFieldKey(key), rowId: blobId, value, keyring: getKycKeyring() });
            const file = await getFileStorage().put({ bytes: Buffer.from(JSON.stringify(sealed), "utf8"), filename: `${blobId}.enc`, folder: STORAGE_FOLDERS.KYC_EVIDENCE.path });
            uploads.push(file);
            stored[key] = JSON.stringify({ storage: getFileStorage().name, id: file.id, url: file.url, blobId });
        }
    } catch (error) {
        await removeUploads(uploads);
        throw error;
    }
    return { stored, uploads };
};

/** Best-effort clean-up of uploads that ended up unused. */
export const removeUploads = async (uploads: StoredFile[]) => {
    await Promise.allSettled(uploads.map((file) => getFileStorage().remove(file)));
};

export default storeFileValues;
