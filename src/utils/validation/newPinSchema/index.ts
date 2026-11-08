import pinSchema from "@/utils/validation/pinSchema";
import isWeakPin from "@/utils/auth/isWeakPin";

const newPinSchema = pinSchema.refine((pin) => !isWeakPin({ pin }), {
    message: "This PIN is too easy to guess. Avoid repeated or sequential digits.",
});

export default newPinSchema;
