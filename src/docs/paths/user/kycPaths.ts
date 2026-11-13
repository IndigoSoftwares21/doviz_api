const auth = [{ BearerAuth: [] }];
const tags = ["User"];
const json = (schema: object) => ({ "application/json": { schema } });
const ref = (name: string) => ({ $ref: `#/components/responses/${name}` });
const error = (description: string, message: string, code: number) => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { message, code } } },
});
const dateTime = (description: string) => ({ type: ["string", "null"], format: "date-time", description });

const kyc = {
    type: "object",
    properties: {
        status: { type: "string", enum: ["not_started", "pending", "verified", "rejected"], description: "`pending` = a submission is being checked; `rejected` = the last one failed (submit again)." },
        level: { type: ["string", "null"], enum: [null, "bvn", "bvn_liveness"], description: "The level verified at; null until verified." },
        recordId: { type: ["string", "null"], format: "uuid", description: "The verification in force." },
        bvn: { type: ["string", "null"], example: "•••••••5678", description: "Masked — the full BVN is never returned." },
        rejectionReason: { type: ["string", "null"], example: "The name doesn't match your BVN." },
        submittedAt: dateTime("When the current submission was made."),
        verifiedAt: dateTime("When the verification in force was made."),
    },
};
const ok = (message: string, code: number) => ({
    description: message,
    content: json({ type: "object", properties: { message: { type: "string", example: message }, code: { type: "integer", example: code }, data: kyc } }),
});
const privacy = "Personal details are encrypted before storage and never returned or logged; responses only carry a masked BVN.";

const kycPaths = {
    "/user/kyc": {
        get: {
            tags, summary: "My verification status", operationId: "getUserKyc", security: auth,
            description: `What the app needs to show verification state. ${privacy}`,
            responses: { "200": ok("KYC status", 200), "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError") },
        },
        post: {
            tags, summary: "Submit my BVN details", operationId: "postUserKyc", security: auth,
            description: `Verifies identity by BVN. Names, birth date and gender must match the BVN record exactly. Needs the transfer PIN (same lockout as payments); limited to 5 attempts per hour per user. Every submission is kept as its own record. ${privacy}`,
            requestBody: {
                required: true,
                content: json({
                    type: "object",
                    required: ["bvn", "firstName", "lastName", "dateOfBirth", "gender", "address", "pin"],
                    properties: {
                        bvn: { type: "string", example: "22212345678", description: "11 digits; spaces and dashes are dropped." },
                        firstName: { type: "string", example: "Ada" },
                        middleName: { type: ["string", "null"], example: null, description: "Optional; blank counts as none." },
                        lastName: { type: "string", example: "Okafor" },
                        dateOfBirth: { type: "string", format: "date", example: "1994-03-18", description: "YYYY-MM-DD; at least 18 years old." },
                        gender: { type: "string", enum: ["male", "female"], description: "As on the BVN record." },
                        address: { type: "string", example: "12 Allen Avenue, Ikeja, Lagos", description: "5–200 characters." },
                        pin: { $ref: "#/components/schemas/Pin" },
                    },
                }),
            },
            responses: {
                "201": ok("Details received", 201),
                "400": { description: "Validation (messages never repeat what was typed), or a wrong PIN (plain 400 with remaining attempts).", content: json({ $ref: "#/components/schemas/ValidationError" }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "409": error("Already verified, a submission is in review, or the BVN belongs to another Ziks account.", "This BVN is already linked to another Ziks account.", 409),
                "423": ref("PinLocked"), "429": ref("TooManyRequests"), "500": ref("ServerError"),
            },
        },
    },
};

export default kycPaths;
