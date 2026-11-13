import "dotenv/config";
import { Dreep, DreepConflictError } from "dreep";
import STORAGE_FOLDERS from "@/services/fileStorage/folders";

/**
 * Creates the storage folders with the right access (idempotent). Run once per
 * environment BEFORE anything uploads — uploads never create folders, because
 * a folder dreep creates on its own is public.
 */
const main = async () => {
    const apiKey = process.env.DREEP_API_KEY;
    if (!apiKey) throw new Error("DREEP_API_KEY is not set");
    const dreep = new Dreep({ apiKey });

    for (const { path, access } of Object.values(STORAGE_FOLDERS)) {
        try {
            const folder = await dreep.createFolder({ path, accessControlType: access });
            console.log(`✓ ${path}: ${folder.accessControlType}`);
            if (folder.accessControlType !== access) throw new Error(`${path} exists as ${folder.accessControlType}, expected ${access} — fix it in the dreep dashboard`);
        } catch (error) {
            if (error instanceof DreepConflictError) {
                console.log(`• ${path}: already exists — confirm in the dreep dashboard that its access is "${access}"`);
                continue;
            }
            console.error(`✗ ${path}: ${(error as Error).message}`);
            process.exitCode = 1;
        }
    }
};

main().then(() => process.exit());
