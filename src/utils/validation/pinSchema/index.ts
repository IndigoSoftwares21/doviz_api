import { z } from "zod";
import AUTH from "@/constants/auth";

const pinSchema = z
    .string({ required_error: "PIN is required" })
    .regex(new RegExp(`^\\d{${AUTH.PIN_LENGTH}}$`), `PIN must be ${AUTH.PIN_LENGTH} digits`);

export default pinSchema;
