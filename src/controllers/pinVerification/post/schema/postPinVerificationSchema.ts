import { z } from "zod";
import pinSchema from "@/utils/validation/pinSchema";

const postPinVerificationSchema = z.object({ pin: pinSchema });

export default postPinVerificationSchema;
