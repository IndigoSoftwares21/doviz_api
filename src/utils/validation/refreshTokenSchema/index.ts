import { z } from "zod";

const refreshTokenSchema = z
    .string({ required_error: "Refresh token is required" })
    .trim()
    .regex(/^[A-Za-z0-9_-]{20,128}$/, "Invalid refresh token");

export default refreshTokenSchema;
