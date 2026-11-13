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
        level: { type: ["string", "null"], enum: [null, "bvn", "bvn_selfie", "bvn_liveness"], description: "The level verified at; null until verified." },
        recordId: { type: ["string", "null"], format: "uuid", description: "The verification in force." },
        bvn: { type: ["string", "null"], example: "•••••••5678", description: "Masked — the full BVN is never returned." },
        rejectionReason: { type: ["string", "null"], example: "The name doesn't match your BVN." },
        submittedAt: dateTime("When the current submission was made."),
        verifiedAt: dateTime("When the verification in force was made."),
    },
};
const field = {
    type: "object",
    properties: {
        key: { type: "string", example: "bvn", description: "Send the value under this key in `details`." },
        type: { type: "string", enum: ["name", "digits", "date", "choice", "text", "selfie"], description: "How to draw it. `selfie`: a front-camera photo sent as a JPEG/PNG base64 data URI (never on file — every attempt needs a new one). An unknown type means the app needs an update." },
        label: { type: "string", example: "BVN" },
        hint: { type: ["string", "null"], example: "We use your BVN to confirm it's you and to open your Ziks account number. It doesn't give us access to your bank accounts or money.", description: "Show as given, under the field." },
        required: { type: "boolean" },
        onFile: { type: "boolean", description: "Already saved: may be left out (it's reused) or filled in to replace it." },
        display: { type: ["string", "null"], example: "•••••••5678", description: "What to show for a saved value; null when there's nothing safe to show (show \"Saved\")." },
        value: { type: ["string", "null"], example: "Ada", description: "Suggested starting value (from the profile), only when nothing is on file." },
        length: { type: "integer", example: 11, description: "`digits`: exact length." },
        minLength: { type: "integer" }, maxLength: { type: "integer" },
        minAge: { type: "integer", example: 18, description: "`date` of birth: youngest allowed." }, maxAge: { type: "integer" },
        maxBytes: { type: "integer", example: 1500000, description: "`selfie`: largest accepted image, in bytes (decoded)." },
        options: { type: "array", items: { type: "object", properties: { value: { type: "string", example: "female" }, label: { type: "string", example: "Female" } } }, description: "`choice`: send one `value`." },
    },
};
const form = {
    type: "object",
    description: "The form to draw, field by field — the server validates with the same definitions, so the app hardcodes no field.",
    properties: { level: { type: "string", example: "bvn", description: "`bvn`: BVN details matched (names, date of birth, the user's verified phone). `bvn_selfie`: plus a selfie matched to the BVN photo. Set on the server." }, fields: { type: "array", items: field } },
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
            responses: { "200": {
                description: "KYC status",
                content: json({ type: "object", properties: {
                    message: { type: "string", example: "KYC status" }, code: { type: "integer", example: 200 },
                    data: { ...kyc, properties: { ...kyc.properties, form } },
                } }),
            }, "401": ref("Unauthorized"), "403": ref("Forbidden"), "500": ref("ServerError") },
        },
        post: {
            tags, summary: "Submit my BVN details", operationId: "postUserKyc", security: auth,
            description: `Verifies the user on the spot (allow up to ~30 s): the details — submitted plus any reused from file — and the selfie are checked against the BVN record by the KYC verifier, and the response is \`verified\` or \`rejected\` (with \`rejectionReason\`). The selfie is kept encrypted as evidence. Request body up to 2.5 MB. Names, birth date and gender must match the BVN record exactly. Saved details are reused; anything sent replaces the saved value (history is kept). Needs the transfer PIN (same lockout as payments); limited to 5 attempts per hour per user. Every submission is kept as its own record. ${privacy}`,
            requestBody: {
                required: true,
                content: json({
                    type: "object",
                    required: ["details", "pin"],
                    properties: {
                        level: { type: "string", enum: ["bvn", "bvn_selfie"], description: "Send back `form.level`. The server's setting decides the level (`npm run kyc:level -- <level>`); a form from before a switch gets a 400 on `level` — reload GET /user/kyc." },
                        details: {
                            type: "object",
                            additionalProperties: { type: "string" },
                            description: "Values by field `key` from the form. Leave out fields that are `onFile` to reuse them. Dates are YYYY-MM-DD.",
                            example: { bvn: "22212345678", first_name: "Ada", last_name: "Okafor", date_of_birth: "1994-03-18", gender: "female", address: "12 Allen Avenue, Ikeja, Lagos", selfie: "data:image/jpeg;base64,/9j/4AAQ…" },
                        },
                        pin: { $ref: "#/components/schemas/Pin" },
                    },
                }),
            },
            responses: {
                "201": ok("You're verified", 201),
                "400": { description: "Validation — errors on `details.<key>` (messages never repeat what was typed) — or a wrong PIN (plain 400 with remaining attempts).", content: json({ $ref: "#/components/schemas/ValidationError" }) },
                "401": ref("Unauthorized"), "403": ref("Forbidden"),
                "409": error("Already verified, a submission is in review, or the BVN belongs to another Ziks account.", "This BVN is already linked to another Ziks account.", 409),
                "423": ref("PinLocked"), "429": ref("TooManyRequests"), "500": ref("ServerError"),
                "503": error("The check couldn't run (verifier or storage down). Nothing was recorded — try again.", "We couldn't check your details right now. Please try again.", 503),
            },
        },
    },
};

export default kycPaths;
