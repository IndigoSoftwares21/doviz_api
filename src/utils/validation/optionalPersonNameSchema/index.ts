import { z } from "zod";
import personNameSchema from "@/utils/validation/personNameSchema";

// Missing, null or blank → undefined (stored as NULL).
const optionalPersonNameSchema = ({ label }: { label: string }) =>
    z.preprocess(
        (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
        personNameSchema({ label }).optional(),
    );

export default optionalPersonNameSchema;
