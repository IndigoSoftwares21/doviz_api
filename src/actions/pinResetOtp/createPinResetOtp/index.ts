import AUTH from "@/constants/auth";
import createOtp from "@/actions/otp/createOtp";
import selectUserPhone from "./queries/selectUserPhone";

interface ICreatePinResetOtp {
    userId: string;
    requestIp: string | null;
    userAgent: string | null;
}

// Always texts the account's own verified phone number — never one supplied
// in the request.
const createPinResetOtp = async ({ userId, requestIp, userAgent }: ICreatePinResetOtp) => {
    const user = await selectUserPhone({ userId });

    const { data } = await createOtp({
        phoneNumber: user.phoneNumber,
        purpose: AUTH.OTP_PURPOSE_PIN_RESET,
        actorId: userId,
        requestIp,
        userAgent,
    });

    return { data };
};

export default createPinResetOtp;
