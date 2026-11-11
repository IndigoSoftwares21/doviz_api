import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";
import tagUnavailableReason from "@/schemaHelpers/tagUnavailableReason";
import { ZIKTAG_MESSAGES } from "@/constants/ziktags";

// The tag itself is validated here — format, reserved/blocked, taken or on
// hold for someone else — so a bad one never reaches the action. The same
// rule answers GET /user/tag/check. The 30-day limit and whether a PIN is
// needed are decided in modifyUserTag (they're about the user, not the tag).
const putUserTagSchema = z
    .object({
        userId: z.string(),
        tag: z.string({ required_error: "Ziktag is required" }).max(40, ZIKTAG_MESSAGES.INVALID),
        pin: pinSchema.optional(),
    })
    .superRefine(async (values, ctx) => {
        const { reason } = await tagUnavailableReason({ value: values.tag, userId: values.userId });
        if (reason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tag"], message: ZIKTAG_MESSAGES.BY_REASON[reason] });
    });

export default putUserTagSchema;
