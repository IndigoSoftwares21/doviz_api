import { z } from "zod";
import AUTH from "@/constants/auth";

// Accepts "+234 801-234-5678", "(+234)8012345678" or "002348012345678" and
// normalises all of them to E.164 ("+2348012345678") before validating.
const phoneNumberSchema = z.preprocess(
    (value) =>
        typeof value === "string"
            ? value.replace(/[\s\-().]/g, "").replace(/^00/, "+")
            : value,
    z
        .string({ required_error: "Phone number is required" })
        .regex(
            AUTH.E164_REGEX,
            "Phone number must be in international format, e.g. +2348012345678",
        ),
);

export default phoneNumberSchema;
