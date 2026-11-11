import { z } from "zod";

// Any string is checked (the answer says why it's not usable); just bound it.
const getTagCheckSchema = z.object({
    tag: z.string({ required_error: "Ziktag is required" }).trim().min(1, "Ziktag is required").max(40, "Ziktag is too long"),
});

export default getTagCheckSchema;
