import { FileStorage } from "./fileStorage";
import DreepFileStorage from "./providers/dreep/dreepFileStorage";

let storage: FileStorage | null = null;

/** The app's file store, from the environment; throws if it isn't configured. */
const getFileStorage = (): FileStorage => {
    if (storage) return storage;
    const apiKey = process.env.DREEP_API_KEY;
    const signingSecret = process.env.DREEP_SIGNING_SECRET;
    if (!apiKey || !signingSecret) throw new Error("File storage is not configured (DREEP_API_KEY, DREEP_SIGNING_SECRET)");
    storage = new DreepFileStorage({ apiKey, signingSecret });
    return storage;
};

/** Tests only. */
export const setFileStorage = (next: FileStorage | null) => {
    storage = next;
};

export default getFileStorage;
