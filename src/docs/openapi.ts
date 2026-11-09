import AUTH from "@/constants/auth";
import successEnvelope from "@/docs/utils/successEnvelope";
import cryptoTags from "@/docs/paths/cryptoTags";
import cryptoPaths from "@/docs/paths/cryptoPaths";
import walletPaths from "@/docs/paths/wallet";
import bankPaths from "@/docs/paths/bankPaths";

const json = (schema: object, example?: object) => ({
    "application/json": example ? { schema, example } : { schema },
});

const validationExample = (path: string, message: string) => ({
    message: "Validation failed",
    code: 400,
    validationErrors: [{ path: [path], message }],
});

const openApiSpec = {
    openapi: "3.1.0",
    info: {
        title: "Doviz API",
        version: "1.0.0",
        description: `Internal API reference for the Doviz app.

## Base URL
All endpoints below are relative to \`/api/v1/app\`.

## Response format
Every endpoint (except \`/health\`) returns the same envelope:

\`\`\`json
{ "message": "Login successful", "code": 200, "data": { } }
\`\`\`

Errors drop \`data\`. Validation errors (400) add \`validationErrors\`, one entry per failing field:

\`\`\`json
{ "message": "Validation failed", "code": 400,
  "validationErrors": [{ "path": ["phoneNumber"], "message": "Phone number must be in international format, e.g. +2348012345678" }] }
\`\`\`

Unexpected failures always return a generic 500 message — internal details are never exposed.

## Signing in
SMS is only needed on a new device. After that, the device is **trusted** and the user unlocks with their PIN or biometrics.

1. \`POST /auth/otp\` with the phone number. A ${AUTH.OTP_LENGTH}-digit code is sent by SMS.
2. \`POST /auth/login\` with the phone number, code and the app's \`deviceId\`. The first login creates the account; every SMS login trusts that device.
3. Send the \`accessToken\` as \`Authorization: Bearer <token>\`. Keep the \`refreshToken\` in the keychain/keystore.

## Idle lock
Access tokens last **${AUTH.ACCESS_TOKEN_TTL_SECONDS / 60} minutes** — that's the idle lock. When a request returns \`401\` (or the app returns from the background), show the lock screen and call \`POST /auth/session/unlock\` with the refresh token and either:
- the **transfer PIN**, or
- a **biometric signature** over a challenge from \`POST /auth/session/challenge\`.

Each unlock returns a **new refresh token** — always store the latest one. Refresh tokens are single-use: if an old one is ever presented again, the session is ended as a precaution.

Go back to SMS login when unlock returns \`401\` (session ended, expired after ${AUTH.REFRESH_TOKEN_TTL_SECONDS / 86400} days, device signed out) or \`423\` (${AUTH.PIN_MAX_ATTEMPTS} wrong PINs).

Every request also re-checks the session server-side, so signing a device out takes effect immediately.

**Trying it here:** after a successful \`POST /auth/login\` on this page, the access token is attached to later requests automatically for this browser tab.

## Phone numbers
Send numbers in E.164 international format (\`+2348012345678\`). Spaces, dashes, brackets and a leading \`00\` are accepted and normalised. Local formats like \`08012345678\` are rejected.

## Rate limits
Limited endpoints return \`429\` when exceeded, with standard \`RateLimit\` / \`RateLimit-Policy\` headers. Per-phone and per-account limits (cooldowns, hourly caps) return \`400\` with a validation message instead.`,
    },
    servers: [{ url: "/api/v1/app", description: "This server" }],
    tags: [
        ...cryptoTags,
        { name: "Health", description: "Service status." },
        {
            name: "Phone login",
            description: "Passwordless sign-in with a one-time code sent by SMS.",
        },
        {
            name: "User",
            description: "The signed-in user's own profile and onboarding status. There is no way to read another user's data: the user always comes from the access token.",
        },
        {
            name: "Session",
            description: "Idle unlock with PIN or biometrics, and logging out. Unlock endpoints authenticate with the refresh token, not the access token.",
        },
        {
            name: "Devices",
            description: "Devices the user is signed in on. Signing a device out ends its session and turns its biometrics off; it needs an SMS login to be used again.",
        },
        {
            name: "Security",
            description: "What the signed-in user has set up: transfer PIN status and biometric devices.",
        },
        {
            name: "Transfer PIN",
            description: `A ${AUTH.PIN_LENGTH}-digit PIN that unlocks the app and approves money movement and sensitive changes. **${AUTH.PIN_MAX_ATTEMPTS} wrong attempts in a row lock it for ${AUTH.PIN_LOCK_SECONDS / 60} minutes** (\`423\`); resetting it with an SMS code unlocks it immediately.`,
        },
        {
            name: "Biometrics",
            description: `Face ID / fingerprint approval, backed by a device key — never a client-side "biometric passed" flag.

**How it works**
Biometrics always apply to the **device of the current session** — there's no \`deviceId\` to send.

1. **Turn on:** generate an ECDSA P-256 key pair in the Secure Enclave (iOS) or Android Keystore, with access gated by biometrics (iOS: \`.biometryCurrentSet\`; Android: \`setUserAuthenticationRequired(true)\` + \`setInvalidatedByBiometricEnrollment(true)\`). Send the public key (base64 DER / SPKI) with the user's PIN to \`POST /auth/biometrics\`.
2. **Approve an action:** \`POST /auth/biometrics/challenge\` → prompt for biometrics → sign the exact \`challenge\` string (UTF-8) with the private key using ECDSA-SHA256 (iOS: \`.ecdsaSignatureMessageX962SHA256\`; Android: \`SHA256withECDSA\`) → send the base64 DER signature to \`POST /auth/biometrics/verification\`.
3. **Unlock the app:** the same signing step, with \`POST /auth/session/challenge\` and \`POST /auth/session/unlock\` (see *Session*).
4. **Turn off:** \`DELETE /auth/biometrics/{deviceId}\`, and delete the key on the device.

Challenges are bound to their purpose: an unlock signature can never approve an action, and vice versa.

Challenges expire after ${AUTH.BIOMETRIC_CHALLENGE_TTL_SECONDS / 60} minutes and are single-use — even a failed attempt burns them. Resetting the PIN turns biometrics off on every device.`,
        },
        {
            name: "Email verification",
            description:
                "Add and verify an email address on the signed-in account. The email is only saved once the code is confirmed.",
        },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: `The \`accessToken\` from \`POST /auth/login\`. Expires after ${AUTH.ACCESS_TOKEN_TTL_SECONDS / 60} minutes.`,
            },
        },
        schemas: {
            PhoneNumber: {
                type: "string",
                pattern: "^\\+[1-9]\\d{7,14}$",
                description: "E.164 format. Spaces, dashes, brackets and a leading `00` are normalised.",
                example: "+2348012345678",
            },
            Otp: {
                type: "string",
                pattern: `^\\d{${AUTH.OTP_LENGTH}}$`,
                description: `${AUTH.OTP_LENGTH}-digit one-time code.`,
                example: "482913",
            },
            User: {
                type: "object",
                required: ["id", "phoneNumber"],
                properties: {
                    id: { type: "string", format: "uuid", example: "77b5692d-9c86-4f04-887b-a03ade9e2a42" },
                    phoneNumber: { $ref: "#/components/schemas/PhoneNumber" },
                },
            },
            OtpRequestResult: {
                type: "object",
                required: ["expiresAt", "resendAvailableAt"],
                properties: {
                    expiresAt: {
                        type: "string",
                        format: "date-time",
                        description: `When this code stops working (${AUTH.OTP_TTL_SECONDS / 60} minutes).`,
                    },
                    resendAvailableAt: {
                        type: "string",
                        format: "date-time",
                        description: "Earliest time a new code can be requested.",
                    },
                },
            },
            LoginResult: {
                type: "object",
                required: ["accessToken", "accessTokenExpiresAt", "refreshToken", "refreshTokenExpiresAt", "user"],
                properties: {
                    accessToken: { type: "string", description: "JWT for the `Authorization: Bearer` header." },
                    accessTokenExpiresAt: { type: "string", format: "date-time" },
                    refreshToken: {
                        type: "string",
                        description: "Opaque token. Store in secure device storage; it is shown only once.",
                    },
                    refreshTokenExpiresAt: { type: "string", format: "date-time" },
                    user: { $ref: "#/components/schemas/User" },
                },
            },
            EmailVerificationResult: {
                type: "object",
                required: ["email", "expiresAt", "resendAvailableAt"],
                properties: {
                    email: { type: "string", format: "email", example: "ada@example.com" },
                    expiresAt: {
                        type: "string",
                        format: "date-time",
                        description: `When this code stops working (${AUTH.EMAIL_OTP_TTL_SECONDS / 60} minutes).`,
                    },
                    resendAvailableAt: { type: "string", format: "date-time" },
                },
            },
            EmailConfirmationResult: {
                type: "object",
                required: ["id", "email", "emailVerifiedAt"],
                properties: {
                    id: { type: "string", format: "uuid" },
                    email: { type: "string", format: "email", example: "ada@example.com" },
                    emailVerifiedAt: { type: "string", format: "date-time" },
                },
            },
            Pin: {
                type: "string",
                pattern: `^\\d{${AUTH.PIN_LENGTH}}$`,
                description: `${AUTH.PIN_LENGTH}-digit transfer PIN.`,
                example: "4827",
            },
            NewPin: {
                type: "string",
                pattern: `^\\d{${AUTH.PIN_LENGTH}}$`,
                description: `${AUTH.PIN_LENGTH} digits. Repeated (\`1111\`), sequential (\`1234\`, \`4321\`), repeating-pair (\`1212\`) and very common PINs are rejected.`,
                example: "4827",
            },
            DeviceId: {
                type: "string",
                pattern: "^[A-Za-z0-9_-]{8,128}$",
                description: "Stable app-install ID generated by the app and kept in the keychain/keystore.",
                example: "8f14e45f-ceea-467a-9a36-dedd4bea2543",
            },
            BiometricDevice: {
                type: "object",
                required: ["deviceId", "deviceName", "createdAt", "lastUsedAt"],
                properties: {
                    deviceId: { $ref: "#/components/schemas/DeviceId" },
                    deviceName: { type: ["string", "null"], example: "Ada's iPhone" },
                    createdAt: { type: "string", format: "date-time" },
                    lastUsedAt: { type: ["string", "null"], format: "date-time" },
                },
            },
            SecuritySettings: {
                type: "object",
                required: ["pin", "biometricDevices"],
                properties: {
                    pin: {
                        type: "object",
                        required: ["isSet", "lockedUntil", "updatedAt"],
                        properties: {
                            isSet: { type: "boolean" },
                            lockedUntil: {
                                type: ["string", "null"],
                                format: "date-time",
                                description: "Set while the PIN is locked after too many wrong attempts.",
                            },
                            updatedAt: { type: ["string", "null"], format: "date-time" },
                        },
                    },
                    biometricDevices: {
                        type: "array",
                        description: "Devices with biometrics on. Compare with your own deviceId to show the toggle state.",
                        items: { $ref: "#/components/schemas/BiometricDevice" },
                    },
                },
            },
            PersonName: {
                type: "string",
                maxLength: 50,
                description: "Legal name as on the user's ID. Letters from any script (incl. tone marks), spaces, hyphens and apostrophes. Trimmed and whitespace-collapsed.",
            },
            CurrentUser: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    phoneNumber: { $ref: "#/components/schemas/PhoneNumber" },
                    firstName: { type: ["string", "null"], example: "Adéṣọlá" },
                    middleName: { type: ["string", "null"], example: null },
                    lastName: { type: ["string", "null"], example: "Okafor-Eze" },
                    email: { type: ["string", "null"], format: "email" },
                    emailVerifiedAt: { type: ["string", "null"], format: "date-time" },
                    accountStatus: { type: "string", enum: ["active", "suspended", "closed"] },
                    createdAt: { type: "string", format: "date-time" },
                    setup: {
                        type: "object",
                        properties: {
                            hasName: { type: "boolean" },
                            hasPin: { type: "boolean" },
                            hasVerifiedEmail: { type: "boolean" },
                            biometricsEnabled: { type: "boolean", description: "On the current device." },
                        },
                    },
                    onboarding: {
                        type: "object",
                        properties: {
                            isComplete: { type: "boolean" },
                            nextStep: {
                                type: ["string", "null"],
                                enum: ["name", "pin", null],
                                description: "Which onboarding screen to show next; null when done.",
                            },
                        },
                    },
                },
            },
            RefreshToken: {
                type: "string",
                description: "The latest refresh token from login or unlock. Single-use.",
                example: "Qm9vZ2llLXdvb2dpZS1yZWZyZXNoLXRva2VuLXZhbHVl",
            },
            Platform: { type: "string", enum: ["ios", "android", "web"] },
            SessionTokens: {
                type: "object",
                required: ["accessToken", "accessTokenExpiresAt", "refreshToken", "refreshTokenExpiresAt"],
                properties: {
                    accessToken: { type: "string" },
                    accessTokenExpiresAt: { type: "string", format: "date-time" },
                    refreshToken: { type: "string", description: "Replaces the one you sent. Store it; the old one no longer works." },
                    refreshTokenExpiresAt: { type: "string", format: "date-time", description: "When the session ends and SMS login is needed." },
                },
            },
            Device: {
                type: "object",
                properties: {
                    deviceId: { $ref: "#/components/schemas/DeviceId" },
                    deviceName: { type: ["string", "null"], example: "Ada's iPhone" },
                    platform: { oneOf: [{ $ref: "#/components/schemas/Platform" }, { type: "null" }] },
                    lastSeenAt: { type: "string", format: "date-time" },
                    trustedAt: { type: "string", format: "date-time", description: "Last SMS login on this device." },
                    firstSeenAt: { type: "string", format: "date-time" },
                    hasActiveSession: { type: "boolean" },
                    biometricsEnabled: { type: "boolean" },
                    isCurrent: { type: "boolean", description: "The device making this request." },
                },
            },
            Error: {
                type: "object",
                required: ["message", "code"],
                properties: {
                    message: { type: "string" },
                    code: { type: "integer" },
                },
            },
            ValidationError: {
                type: "object",
                required: ["message", "code", "validationErrors"],
                properties: {
                    message: { type: "string", example: "Validation failed" },
                    code: { type: "integer", example: 400 },
                    validationErrors: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["path", "message"],
                            properties: {
                                path: {
                                    type: "array",
                                    items: { type: ["string", "integer"] },
                                    example: ["phoneNumber"],
                                },
                                message: { type: "string" },
                            },
                        },
                    },
                },
            },
        },
        responses: {
            Forbidden: {
                description: "The account is suspended or closed.",
                content: json({ $ref: "#/components/schemas/Error" }, {
                    message: "Your account is not active. Please contact support.",
                    code: 403,
                }),
            },
            Unauthorized: {
                description: "Missing, invalid or expired access token, or the session was revoked.",
                content: json({ $ref: "#/components/schemas/Error" }, {
                    message: "Authentication required",
                    code: 401,
                }),
            },
            TooManyRequests: {
                description: "Per-IP rate limit exceeded. Check the `RateLimit` header for when to retry.",
                content: json({ $ref: "#/components/schemas/Error" }, {
                    message: "Too many requests, please try again later",
                    code: 429,
                }),
            },
            PinIncorrect: {
                description: "Wrong PIN, or no PIN set yet. The message includes the attempts left.",
                content: json({ $ref: "#/components/schemas/Error" }, {
                    message: "Incorrect PIN. 3 attempts remaining.",
                    code: 400,
                }),
            },
            PinLocked: {
                description: `Too many wrong attempts — the PIN is locked for ${AUTH.PIN_LOCK_SECONDS / 60} minutes. Resetting the PIN unlocks it.`,
                content: json({ $ref: "#/components/schemas/Error" }, {
                    message:
                        "Too many incorrect attempts. Your PIN is locked until 2026-11-08T16:30:00.000Z. Reset your PIN to unlock it now.",
                    code: 423,
                }),
            },
            ServerError: {
                description: "Unexpected error, e.g. SMS or email delivery failed. Safe to retry.",
                content: json({ $ref: "#/components/schemas/Error" }, {
                    message:
                        "An error occurred while processing your request. Please try again later or contact support.",
                    code: 500,
                }),
            },
        },
    },
    paths: {
        ...cryptoPaths,
        ...walletPaths,
        ...bankPaths,
        "/health": {
            get: {
                tags: ["Health"],
                summary: "Health check",
                description: "Liveness probe. Does not use the standard response envelope.",
                operationId: "getHealth",
                security: [],
                responses: {
                    "200": {
                        description: "Service is up.",
                        content: json(
                            { type: "object", properties: { status: { type: "string" } } },
                            { status: "ok" },
                        ),
                    },
                },
            },
        },
        "/user": {
            get: {
                tags: ["User"],
                summary: "Get current user",
                operationId: "getUser",
                security: [{ BearerAuth: [] }],
                description: "The signed-in user's profile, what they've set up, and the next onboarding step (`name` → `pin` → done). Call after login/unlock to decide which screen to show. Responses carry `Cache-Control: no-store`.",
                responses: {
                    "200": {
                        description: "Current user.",
                        content: json(
                            successEnvelope({ message: "User fetched", code: 200, dataRef: "#/components/schemas/CurrentUser" }),
                        ),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/user/name": {
            put: {
                tags: ["User"],
                summary: "Set legal name",
                operationId: "putUserName",
                security: [{ BearerAuth: [] }],
                description: "Saves the user's legal name **exactly as on their ID** — KYC checks will match against it. Free to set during onboarding; once the user has a name **and** a PIN, changing it requires `pin` (counts towards the PIN lockout).",
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["firstName", "lastName"],
                            properties: {
                                firstName: { $ref: "#/components/schemas/PersonName" },
                                middleName: { $ref: "#/components/schemas/PersonName" },
                                lastName: { $ref: "#/components/schemas/PersonName" },
                                pin: { $ref: "#/components/schemas/Pin" },
                            },
                        },
                        { firstName: "Adéṣọlá", lastName: "Okafor-Eze" },
                    ),
                },
                responses: {
                    "200": {
                        description: "Name saved.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Name saved" },
                                code: { type: "integer", example: 200 },
                                data: {
                                    type: "object",
                                    properties: {
                                        firstName: { type: "string" },
                                        middleName: { type: ["string", "null"] },
                                        lastName: { type: "string" },
                                        nameUpdatedAt: { type: "string", format: "date-time" },
                                    },
                                },
                            },
                        }),
                    },
                    "400": {
                        description: "Invalid name, PIN needed to change the name, or wrong PIN.",
                        content: json(
                            { $ref: "#/components/schemas/ValidationError" },
                            validationExample("firstName", "First name can only contain letters, spaces, hyphens and apostrophes"),
                        ),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                    "423": { $ref: "#/components/responses/PinLocked" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/otp": {
            post: {
                tags: ["Phone login"],
                summary: "Send login code",
                operationId: "postOtp",
                security: [],
                description: `Sends a ${AUTH.OTP_LENGTH}-digit code by SMS. Works for new and existing users alike.

- The code expires after **${AUTH.OTP_TTL_SECONDS / 60} minutes** and is never returned by the API.
- Requesting a new code cancels any previous one — only the latest code works.
- Limits per phone number: one code every **${AUTH.OTP_RESEND_COOLDOWN_SECONDS} seconds**, at most **${AUTH.OTP_MAX_REQUESTS_PER_HOUR} per hour** (\`400\`).
- Limit per IP: **10 requests per 15 minutes** (\`429\`).`,
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["phoneNumber"],
                            properties: { phoneNumber: { $ref: "#/components/schemas/PhoneNumber" } },
                        },
                        { phoneNumber: "+2348012345678" },
                    ),
                },
                responses: {
                    "201": {
                        description: "Code sent.",
                        content: json(
                            successEnvelope({
                                message: "Verification code sent",
                                code: 201,
                                dataRef: "#/components/schemas/OtpRequestResult",
                            }),
                        ),
                    },
                    "400": {
                        description:
                            "Invalid phone number, resend cooldown still active, or hourly limit reached.",
                        content: json(
                            { $ref: "#/components/schemas/ValidationError" },
                            validationExample(
                                "phoneNumber",
                                `Please wait ${AUTH.OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`,
                            ),
                        ),
                    },
                    "429": { $ref: "#/components/responses/TooManyRequests" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/login": {
            post: {
                tags: ["Phone login"],
                summary: "Log in with code",
                operationId: "postLogin",
                security: [],
                description: `Exchanges the SMS code for tokens. The first successful login creates the account.

- Each code works **once**.
- **${AUTH.OTP_MAX_ATTEMPTS} wrong attempts** cancel the code; request a new one.
- Every failure (wrong, expired, used or cancelled code) returns the **same** \`401\` — don't try to tell them apart.
- Limit per IP: **20 requests per 15 minutes** (\`429\`).
- Send the app's stable \`deviceId\`: this device becomes trusted for PIN/biometric unlock, and any older session on it ends.
- Responses carry \`Cache-Control: no-store\`.`,
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["phoneNumber", "otp", "deviceId"],
                            properties: {
                                phoneNumber: { $ref: "#/components/schemas/PhoneNumber" },
                                otp: { $ref: "#/components/schemas/Otp" },
                                deviceId: { $ref: "#/components/schemas/DeviceId" },
                                deviceName: { type: "string", maxLength: 100, example: "Ada's iPhone" },
                                platform: { $ref: "#/components/schemas/Platform" },
                            },
                        },
                        {
                            phoneNumber: "+2348012345678",
                            otp: "482913",
                            deviceId: "8f14e45f-ceea-467a-9a36-dedd4bea2543",
                            deviceName: "Ada's iPhone",
                            platform: "ios",
                        },
                    ),
                },
                responses: {
                    "200": {
                        description: "Logged in.",
                        content: json(
                            successEnvelope({
                                message: "Login successful",
                                code: 200,
                                dataRef: "#/components/schemas/LoginResult",
                            }),
                        ),
                    },
                    "400": {
                        description: "Malformed phone number or code.",
                        content: json(
                            { $ref: "#/components/schemas/ValidationError" },
                            validationExample("otp", `Verification code must be ${AUTH.OTP_LENGTH} digits`),
                        ),
                    },
                    "401": {
                        description: "Code is wrong, expired, already used or cancelled.",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Invalid or expired verification code",
                            code: 401,
                        }),
                    },
                    "429": { $ref: "#/components/responses/TooManyRequests" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/session/unlock": {
            post: {
                tags: ["Session"],
                summary: "Unlock with PIN or biometrics",
                operationId: "postSessionUnlock",
                security: [],
                description: `Unlocks an idle session on a trusted device — no SMS. Send the refresh token, the \`deviceId\`, and **either** \`pin\` **or** \`challengeId\` + \`signature\` (from \`POST /auth/session/challenge\`).

- Returns fresh tokens. **The refresh token is replaced** — store the new one.
- A wrong PIN counts towards the shared PIN lockout. When it locks, the session ends (\`423\`) and the user must log in by SMS.
- Responses carry \`Cache-Control: no-store\`. Limit per IP: **30 requests per 15 minutes**.`,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["refreshToken", "deviceId"],
                                properties: {
                                    refreshToken: { $ref: "#/components/schemas/RefreshToken" },
                                    deviceId: { $ref: "#/components/schemas/DeviceId" },
                                    pin: { $ref: "#/components/schemas/Pin" },
                                    challengeId: { type: "string", format: "uuid" },
                                    signature: { type: "string", description: "Base64 DER ECDSA signature over the challenge." },
                                },
                            },
                            examples: {
                                pin: {
                                    summary: "With PIN",
                                    value: { refreshToken: "Qm9vZ2llLXdvb2dpZS1yZWZyZXNoLXRva2VuLXZhbHVl", deviceId: "8f14e45f-ceea-467a-9a36-dedd4bea2543", pin: "4827" },
                                },
                                biometric: {
                                    summary: "With biometrics",
                                    value: {
                                        refreshToken: "Qm9vZ2llLXdvb2dpZS1yZWZyZXNoLXRva2VuLXZhbHVl",
                                        deviceId: "8f14e45f-ceea-467a-9a36-dedd4bea2543",
                                        challengeId: "0b6c7f6e-2a8b-4a8e-9d55-3f0f2c1d9b11",
                                        signature: "MEUCIQDx...",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Unlocked.",
                        content: json(
                            successEnvelope({
                                message: "Session unlocked",
                                code: 200,
                                dataRef: "#/components/schemas/SessionTokens",
                            }),
                        ),
                    },
                    "400": {
                        description: "Validation failed, wrong PIN (with attempts left), no PIN set, or biometric check failed. The user can try again.",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Incorrect PIN. 2 attempts remaining.",
                            code: 400,
                        }),
                    },
                    "401": {
                        description: "Session ended, expired or reused, or the device was signed out. **Go to SMS login.**",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Your session has ended. Log in again with an SMS code.",
                            code: 401,
                        }),
                    },
                    "423": {
                        description: "Too many wrong PINs — the session has ended. **Go to SMS login.**",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Too many incorrect attempts. Log in again with an SMS code.",
                            code: 423,
                        }),
                    },
                    "429": { $ref: "#/components/responses/TooManyRequests" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/session/challenge": {
            post: {
                tags: ["Session"],
                summary: "Get an unlock challenge",
                operationId: "postSessionChallenge",
                security: [],
                description: `Returns a single-use challenge to sign for biometric unlock. Expires in ${AUTH.BIOMETRIC_CHALLENGE_TTL_SECONDS / 60} minutes. Doesn't replace the refresh token.`,
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["refreshToken", "deviceId"],
                            properties: {
                                refreshToken: { $ref: "#/components/schemas/RefreshToken" },
                                deviceId: { $ref: "#/components/schemas/DeviceId" },
                            },
                        },
                    ),
                },
                responses: {
                    "201": {
                        description: "Challenge created.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Biometric challenge created" },
                                code: { type: "integer", example: 201 },
                                data: {
                                    type: "object",
                                    properties: {
                                        challengeId: { type: "string", format: "uuid" },
                                        challenge: { type: "string", description: "Sign this exact string (UTF-8)." },
                                        expiresAt: { type: "string", format: "date-time" },
                                    },
                                },
                            },
                        }),
                    },
                    "400": {
                        description: "Validation failed, or biometrics aren't on for this device — fall back to the PIN.",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Biometrics are not turned on for this device",
                            code: 400,
                        }),
                    },
                    "401": {
                        description: "Session ended. **Go to SMS login.**",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Your session has ended. Log in again with an SMS code.",
                            code: 401,
                        }),
                    },
                    "429": { $ref: "#/components/responses/TooManyRequests" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/logout": {
            post: {
                tags: ["Session"],
                summary: "Log out",
                operationId: "postLogout",
                security: [{ BearerAuth: [] }],
                description: "Ends the current session. The device stays trusted (its biometrics stay on), but the next login needs SMS. Delete the stored tokens on the device.",
                responses: {
                    "200": {
                        description: "Logged out.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Logged out" },
                                code: { type: "integer", example: 200 },
                                data: { type: "object", properties: { loggedOut: { type: "boolean", example: true } } },
                            },
                        }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/devices": {
            get: {
                tags: ["Devices"],
                summary: "List devices",
                operationId: "getDevices",
                security: [{ BearerAuth: [] }],
                description: "Trusted devices, most recently used first.",
                responses: {
                    "200": {
                        description: "Devices.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Devices fetched" },
                                code: { type: "integer", example: 200 },
                                data: { type: "array", items: { $ref: "#/components/schemas/Device" } },
                            },
                        }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/devices/{deviceId}": {
            delete: {
                tags: ["Devices"],
                summary: "Sign out a device",
                operationId: "deleteDevice",
                security: [{ BearerAuth: [] }],
                description: "Ends the device's session, turns its biometrics off and untrusts it — it needs an SMS login to be used again. Works on the current device too. Safe to repeat.",
                parameters: [
                    { name: "deviceId", in: "path", required: true, schema: { $ref: "#/components/schemas/DeviceId" } },
                ],
                responses: {
                    "200": {
                        description: "Signed out.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Device signed out" },
                                code: { type: "integer", example: 200 },
                                data: {
                                    type: "object",
                                    properties: {
                                        deviceId: { $ref: "#/components/schemas/DeviceId" },
                                        removed: { type: "boolean", description: "False if it was already signed out." },
                                    },
                                },
                            },
                        }),
                    },
                    "400": {
                        description: "Invalid device ID.",
                        content: json({ $ref: "#/components/schemas/ValidationError" }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/security": {
            get: {
                tags: ["Security"],
                summary: "Get security settings",
                operationId: "getSecuritySettings",
                security: [{ BearerAuth: [] }],
                description: "Whether a transfer PIN is set (and locked), and which devices have biometrics on.",
                responses: {
                    "200": {
                        description: "Current settings.",
                        content: json(
                            successEnvelope({
                                message: "Security settings fetched",
                                code: 200,
                                dataRef: "#/components/schemas/SecuritySettings",
                            }),
                        ),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/pin": {
            post: {
                tags: ["Transfer PIN"],
                summary: "Set PIN",
                operationId: "postPin",
                security: [{ BearerAuth: [] }],
                description: "Sets the transfer PIN for the first time. To change an existing PIN use `PUT /auth/pin`; if it's forgotten, reset it.",
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["pin", "confirmPin"],
                            properties: {
                                pin: { $ref: "#/components/schemas/NewPin" },
                                confirmPin: { $ref: "#/components/schemas/Pin" },
                            },
                        },
                        { pin: "4827", confirmPin: "4827" },
                    ),
                },
                responses: {
                    "201": {
                        description: "PIN set.",
                        content: json(
                            {
                                type: "object",
                                properties: {
                                    message: { type: "string", example: "Transfer PIN set" },
                                    code: { type: "integer", example: 201 },
                                    data: {
                                        type: "object",
                                        properties: { pinSetAt: { type: "string", format: "date-time" } },
                                    },
                                },
                            },
                        ),
                    },
                    "400": {
                        description: "Malformed or weak PIN, PINs don't match, or a PIN is already set.",
                        content: json(
                            { $ref: "#/components/schemas/ValidationError" },
                            validationExample("pin", "This PIN is too easy to guess. Avoid repeated or sequential digits."),
                        ),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
            put: {
                tags: ["Transfer PIN"],
                summary: "Change PIN",
                operationId: "putPin",
                security: [{ BearerAuth: [] }],
                description: "Changes the PIN. A wrong `currentPin` counts towards the lockout.",
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["currentPin", "newPin", "confirmPin"],
                            properties: {
                                currentPin: { $ref: "#/components/schemas/Pin" },
                                newPin: { $ref: "#/components/schemas/NewPin" },
                                confirmPin: { $ref: "#/components/schemas/Pin" },
                            },
                        },
                        { currentPin: "4827", newPin: "9361", confirmPin: "9361" },
                    ),
                },
                responses: {
                    "200": {
                        description: "PIN changed.",
                        content: json(
                            {
                                type: "object",
                                properties: {
                                    message: { type: "string", example: "Transfer PIN changed" },
                                    code: { type: "integer", example: 200 },
                                    data: {
                                        type: "object",
                                        properties: { pinChangedAt: { type: "string", format: "date-time" } },
                                    },
                                },
                            },
                        ),
                    },
                    "400": {
                        description: "Validation failed (`validationErrors`), or the current PIN is wrong / not set.",
                        content: json({ oneOf: [{ $ref: "#/components/schemas/ValidationError" }, { $ref: "#/components/schemas/Error" }] }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "423": { $ref: "#/components/responses/PinLocked" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/pin/verification": {
            post: {
                tags: ["Transfer PIN"],
                summary: "Verify PIN",
                operationId: "postPinVerification",
                security: [{ BearerAuth: [] }],
                description: "Checks the PIN, e.g. before revealing sensitive details. Transfers will check the PIN themselves — you won't need to call this first.",
                requestBody: {
                    required: true,
                    content: json(
                        { type: "object", required: ["pin"], properties: { pin: { $ref: "#/components/schemas/Pin" } } },
                        { pin: "4827" },
                    ),
                },
                responses: {
                    "200": {
                        description: "Correct PIN.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "PIN verified" },
                                code: { type: "integer", example: 200 },
                                data: { type: "object", properties: { verified: { type: "boolean", example: true } } },
                            },
                        }),
                    },
                    "400": { $ref: "#/components/responses/PinIncorrect" },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "423": { $ref: "#/components/responses/PinLocked" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/pin/reset/otp": {
            post: {
                tags: ["Transfer PIN"],
                summary: "Send PIN reset code",
                operationId: "postPinResetOtp",
                security: [{ BearerAuth: [] }],
                description: `Texts a ${AUTH.OTP_LENGTH}-digit code to the account's phone number (never a number from the request). Shares the per-phone cooldown and hourly limit with login codes.`,
                responses: {
                    "201": {
                        description: "Code sent.",
                        content: json(
                            successEnvelope({
                                message: "PIN reset code sent to your phone",
                                code: 201,
                                dataRef: "#/components/schemas/OtpRequestResult",
                            }),
                        ),
                    },
                    "400": {
                        description: "No PIN set yet, cooldown active, or hourly limit reached.",
                        content: json(
                            { $ref: "#/components/schemas/ValidationError" },
                            validationExample("phoneNumber", `Please wait ${AUTH.OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`),
                        ),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "429": { $ref: "#/components/responses/TooManyRequests" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/pin/reset": {
            post: {
                tags: ["Transfer PIN"],
                summary: "Reset PIN",
                operationId: "postPinReset",
                security: [{ BearerAuth: [] }],
                description: `Sets a new PIN using the SMS code. Also unlocks the PIN and **turns biometrics off on every device** — the user must turn them on again. ${AUTH.OTP_MAX_ATTEMPTS} wrong codes cancel the code.`,
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["otp", "newPin", "confirmPin"],
                            properties: {
                                otp: { $ref: "#/components/schemas/Otp" },
                                newPin: { $ref: "#/components/schemas/NewPin" },
                                confirmPin: { $ref: "#/components/schemas/Pin" },
                            },
                        },
                        { otp: "482913", newPin: "9361", confirmPin: "9361" },
                    ),
                },
                responses: {
                    "200": {
                        description: "PIN reset.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Transfer PIN reset" },
                                code: { type: "integer", example: 200 },
                                data: {
                                    type: "object",
                                    properties: {
                                        pinResetAt: { type: "string", format: "date-time" },
                                        biometricDevicesRevoked: { type: "integer", example: 1 },
                                    },
                                },
                            },
                        }),
                    },
                    "400": {
                        description: "Validation failed, or the code is wrong, expired or cancelled.",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Invalid or expired verification code",
                            code: 400,
                        }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/biometrics": {
            post: {
                tags: ["Biometrics"],
                summary: "Turn on biometrics",
                operationId: "postBiometric",
                security: [{ BearerAuth: [] }],
                description: "Registers the public key for the **current session's device**. Requires the PIN (counts towards the lockout). Turning it on again replaces the old key.",
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["publicKey", "pin"],
                            properties: {
                                deviceName: { type: "string", maxLength: 100, example: "Ada's iPhone" },
                                publicKey: {
                                    type: "string",
                                    description: "Base64 DER (SPKI) ECDSA P-256 public key.",
                                    example: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...",
                                },
                                pin: { $ref: "#/components/schemas/Pin" },
                            },
                        },
                    ),
                },
                responses: {
                    "201": {
                        description: "Biometrics on for this device.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Biometrics turned on" },
                                code: { type: "integer", example: 201 },
                                data: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string", format: "uuid" },
                                        deviceId: { $ref: "#/components/schemas/DeviceId" },
                                        deviceName: { type: ["string", "null"] },
                                        createdAt: { type: "string", format: "date-time" },
                                    },
                                },
                            },
                        }),
                    },
                    "400": {
                        description: "Invalid public key, no PIN set, or wrong PIN.",
                        content: json({ oneOf: [{ $ref: "#/components/schemas/ValidationError" }, { $ref: "#/components/schemas/Error" }] }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "423": { $ref: "#/components/responses/PinLocked" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/biometrics/{deviceId}": {
            delete: {
                tags: ["Biometrics"],
                summary: "Turn off biometrics",
                operationId: "deleteBiometric",
                security: [{ BearerAuth: [] }],
                description: "Revokes biometrics for one of the user's devices (usually the current one). No PIN needed. Safe to call when already off. Delete the key on the device too.",
                parameters: [
                    { name: "deviceId", in: "path", required: true, schema: { $ref: "#/components/schemas/DeviceId" } },
                ],
                responses: {
                    "200": {
                        description: "Biometrics off for this device.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Biometrics turned off" },
                                code: { type: "integer", example: 200 },
                                data: {
                                    type: "object",
                                    properties: {
                                        deviceId: { $ref: "#/components/schemas/DeviceId" },
                                        enabled: { type: "boolean", example: false },
                                    },
                                },
                            },
                        }),
                    },
                    "400": {
                        description: "Invalid device ID.",
                        content: json({ $ref: "#/components/schemas/ValidationError" }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/biometrics/challenge": {
            post: {
                tags: ["Biometrics"],
                summary: "Get a biometric challenge",
                operationId: "postBiometricChallenge",
                security: [{ BearerAuth: [] }],
                description: `Returns a single-use challenge for approving an action on the current session's device. Expires in ${AUTH.BIOMETRIC_CHALLENGE_TTL_SECONDS / 60} minutes. (To unlock the app, use \`POST /auth/session/challenge\` instead.)`,
                responses: {
                    "201": {
                        description: "Challenge created.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Biometric challenge created" },
                                code: { type: "integer", example: 201 },
                                data: {
                                    type: "object",
                                    properties: {
                                        challengeId: { type: "string", format: "uuid" },
                                        challenge: {
                                            type: "string",
                                            description: "Sign this exact string (UTF-8).",
                                            example: "q1V3t6mY0Yx8b2l0c0p1dGgyM2FiY2RlZmdoaWprbG0",
                                        },
                                        expiresAt: { type: "string", format: "date-time" },
                                    },
                                },
                            },
                        }),
                    },
                    "400": {
                        description: "Biometrics aren't on for this device.",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Biometrics are not turned on for this device",
                            code: 400,
                        }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/biometrics/verification": {
            post: {
                tags: ["Biometrics"],
                summary: "Verify biometric signature",
                operationId: "postBiometricVerification",
                security: [{ BearerAuth: [] }],
                description: "Checks the signature over an approval challenge. It must come from the current session's device. The challenge is used up whether or not the signature is valid. Transfers will accept the same challenge + signature directly.",
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["challengeId", "signature"],
                            properties: {
                                challengeId: { type: "string", format: "uuid" },
                                signature: { type: "string", description: "Base64 (or base64url) DER ECDSA signature." },
                            },
                        },
                    ),
                },
                responses: {
                    "200": {
                        description: "Signature valid.",
                        content: json({
                            type: "object",
                            properties: {
                                message: { type: "string", example: "Biometric verified" },
                                code: { type: "integer", example: 200 },
                                data: {
                                    type: "object",
                                    properties: {
                                        verified: { type: "boolean", example: true },
                                        deviceId: { $ref: "#/components/schemas/DeviceId" },
                                    },
                                },
                            },
                        }),
                    },
                    "400": {
                        description: "Bad signature, or the challenge is unknown, expired or already used.",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Biometric verification failed. Request a new challenge or use your PIN.",
                            code: 400,
                        }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/email/verification": {
            post: {
                tags: ["Email verification"],
                summary: "Send email code",
                operationId: "postEmailVerification",
                security: [{ BearerAuth: [] }],
                description: `Sends a ${AUTH.OTP_LENGTH}-digit code to the given address. The email is trimmed and lowercased.

- The code expires after **${AUTH.EMAIL_OTP_TTL_SECONDS / 60} minutes**; a new request cancels the previous code.
- Limits per account: one code every **${AUTH.EMAIL_OTP_RESEND_COOLDOWN_SECONDS} seconds**, at most **${AUTH.EMAIL_OTP_MAX_REQUESTS_PER_HOUR} per hour** (\`400\`).
- The account's email doesn't change until \`POST /auth/email/confirmation\` succeeds.`,
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["email"],
                            properties: { email: { type: "string", format: "email", maxLength: 254 } },
                        },
                        { email: "ada@example.com" },
                    ),
                },
                responses: {
                    "201": {
                        description: "Code sent.",
                        content: json(
                            successEnvelope({
                                message: "Verification code sent to your email",
                                code: 201,
                                dataRef: "#/components/schemas/EmailVerificationResult",
                            }),
                        ),
                    },
                    "400": {
                        description:
                            "Invalid email, already used by another account, already verified on this account, cooldown active, or hourly limit reached.",
                        content: json(
                            { $ref: "#/components/schemas/ValidationError" },
                            validationExample("email", "This email is already in use"),
                        ),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
        "/auth/email/confirmation": {
            post: {
                tags: ["Email verification"],
                summary: "Confirm email code",
                operationId: "postEmailConfirmation",
                security: [{ BearerAuth: [] }],
                description: `Confirms the latest email code and saves the email on the account.

- **${AUTH.EMAIL_OTP_MAX_ATTEMPTS} wrong attempts** cancel the code.
- A wrong or expired code returns **\`400\`**, not \`401\` — the user is still signed in.`,
                requestBody: {
                    required: true,
                    content: json(
                        {
                            type: "object",
                            required: ["otp"],
                            properties: { otp: { $ref: "#/components/schemas/Otp" } },
                        },
                        { otp: "482913" },
                    ),
                },
                responses: {
                    "200": {
                        description: "Email verified.",
                        content: json(
                            successEnvelope({
                                message: "Email verified",
                                code: 200,
                                dataRef: "#/components/schemas/EmailConfirmationResult",
                            }),
                        ),
                    },
                    "400": {
                        description: "Malformed, wrong, expired or cancelled code.",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Invalid or expired verification code",
                            code: 400,
                        }),
                    },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "409": {
                        description: "Another account verified this email in the meantime.",
                        content: json({ $ref: "#/components/schemas/Error" }, {
                            message: "Duplicate entry found",
                            code: 409,
                        }),
                    },
                    "500": { $ref: "#/components/responses/ServerError" },
                },
            },
        },
    },
};

export default openApiSpec;
