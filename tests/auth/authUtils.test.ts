import generateOtp from "@/utils/auth/generateOtp";
import hashOtp from "@/utils/auth/hashOtp";
import verifyOtpHash from "@/utils/auth/verifyOtpHash";
import getRequiredEnv from "@/utils/auth/getRequiredEnv";
import phoneNumberSchema from "@/utils/validation/phoneNumberSchema";

process.env.OTP_PEPPER = "test-pepper-test-pepper-test-pepper-0001";

describe("generateOtp", () => {
    it("returns 6 numeric characters, including leading zeros", () => {
        for (let i = 0; i < 2000; i++) {
            expect(generateOtp()).toMatch(/^\d{6}$/);
        }
    });

    it("does not repeat a value across a small sample", () => {
        const codes = new Set(Array.from({ length: 200 }, () => generateOtp()));
        expect(codes.size).toBeGreaterThan(190);
    });
});

describe("hashOtp / verifyOtpHash", () => {
    const phoneNumber = "+2348012345678";

    it("never stores the plain code", () => {
        const codeHash = hashOtp({ subject: phoneNumber, otp: "123456" });
        expect(codeHash).toMatch(/^[0-9a-f]{64}$/);
        expect(codeHash).not.toContain("123456");
    });

    it("accepts the right code and rejects a wrong one", () => {
        const codeHash = hashOtp({ subject: phoneNumber, otp: "123456" });
        expect(verifyOtpHash({ subject: phoneNumber, otp: "123456", codeHash })).toBe(true);
        expect(verifyOtpHash({ subject: phoneNumber, otp: "123457", codeHash })).toBe(false);
    });

    it("binds the hash to the phone number", () => {
        const codeHash = hashOtp({ subject: phoneNumber, otp: "123456" });
        expect(
            verifyOtpHash({ subject: "+2348000000000", otp: "123456", codeHash }),
        ).toBe(false);
    });

    it("keeps phone and email codes in separate domains", () => {
        const emailHash = hashOtp({ subject: "email:user-1:a@b.co", otp: "123456" });
        expect(verifyOtpHash({ subject: phoneNumber, otp: "123456", codeHash: emailHash })).toBe(false);
    });

    it("rejects a malformed stored hash without throwing", () => {
        expect(verifyOtpHash({ subject: phoneNumber, otp: "123456", codeHash: "abc" })).toBe(false);
    });
});

describe("getRequiredEnv", () => {
    it("throws when the secret is missing or too short", () => {
        process.env.SHORT_SECRET = "short";
        expect(() => getRequiredEnv({ name: "SHORT_SECRET" })).toThrow();
        expect(() => getRequiredEnv({ name: "MISSING_SECRET_XYZ" })).toThrow();
    });
});

describe("phoneNumberSchema", () => {
    it.each([
        ["+2348012345678", "+2348012345678"],
        ["+234 801-234-5678", "+2348012345678"],
        ["(+234) 801 234 5678", "+2348012345678"],
        ["002348012345678", "+2348012345678"],
    ])("normalises %s", async (input, expected) => {
        await expect(phoneNumberSchema.parseAsync(input)).resolves.toBe(expected);
    });

    it.each(["08012345678", "+0123456789", "+234abc", "", "+1234567"])(
        "rejects %s",
        async (input) => {
            await expect(phoneNumberSchema.parseAsync(input)).rejects.toThrow();
        },
    );
});
