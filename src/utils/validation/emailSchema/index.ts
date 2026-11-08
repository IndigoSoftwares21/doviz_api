import { z } from "zod";

const emailSchema = z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .max(254, "Email is too long")
    .email("Enter a valid email address");

export default emailSchema;
