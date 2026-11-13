/**
 * Where Ziks keeps files (KYC evidence, images…). Provider-agnostic: callers
 * only see this interface; dreep.cloud is the implementation. Files that hold
 * personal data are encrypted by the caller BEFORE `put`, so the store only
 * ever sees unreadable bytes.
 */
export interface StoredFile {
    /** The store's own id. */
    id: string;
    /** Its address in the store (not publicly readable for protected folders). */
    url: string;
}

export interface FileStorage {
    readonly name: string;
    /** Stores bytes in a folder that must already exist (never auto-created: a new folder could be public). */
    put(args: { bytes: Buffer; filename: string; folder: string }): Promise<StoredFile>;
    /** Reads a stored file's bytes. */
    get(file: StoredFile): Promise<Buffer>;
    /** Deletes a stored file; resolves if it's already gone. */
    remove(file: StoredFile): Promise<void>;
}
