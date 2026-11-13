import { Dreep, DreepNotFoundError } from "dreep";
import { FileStorage, StoredFile } from "../../fileStorage";

const UPLOAD_TIMEOUT_MS = 60_000;
const READ_LINK_SECONDS = 60;

/**
 * dreep.cloud behind FileStorage. Protected files live in a SIGNED folder
 * (created by `npm run storage:setup`): readable only through a short-lived
 * signed link, which only the server can make. Uploads never create folders.
 */
class DreepFileStorage implements FileStorage {
    readonly name = "dreep";
    private readonly client: Dreep;

    constructor({ apiKey, signingSecret }: { apiKey: string; signingSecret: string }) {
        this.client = new Dreep({ apiKey, signingSecret });
    }

    async put({ bytes, filename, folder }: { bytes: Buffer; filename: string; folder: string }): Promise<StoredFile> {
        const asset = await this.client.upload({ file: bytes, filename, folder, autoCreateFolders: false, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) });
        return { id: asset.id, url: asset.url };
    }

    async get(file: StoredFile): Promise<Buffer> {
        const link = this.client.signedUrl(file, { expiresIn: READ_LINK_SECONDS });
        const response = await fetch(link, { signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`dreep read failed with ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
    }

    async remove(file: StoredFile): Promise<void> {
        try {
            await this.client.deleteMedia({ id: file.id });
        } catch (error) {
            if (!(error instanceof DreepNotFoundError)) throw error;
        }
    }
}

export default DreepFileStorage;
