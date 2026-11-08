import { z } from "zod";
import AUTH from "@/constants/auth";

const otpSchema = z
    .string({ required_error: "Verification code is required" })
    .trim()
    .regex(
        new RegExp(`^\\d{${AUTH.OTP_LENGTH}}$`),
        `Verification code must be ${AUTH.OTP_LENGTH} digits`,
    );

export default otpSchema;
