import AUTH from "@/constants/auth";

// Login codes keep the bare phone number as their subject; other purposes are
// prefixed so a code issued for one purpose can never verify another.
const getPhoneOtpSubject = ({ phoneNumber, purpose }: { phoneNumber: string; purpose: string }) => {
    const subject =
        purpose === AUTH.OTP_PURPOSE_LOGIN ? phoneNumber : `${purpose}:${phoneNumber}`;

    return subject;
};

export default getPhoneOtpSubject;
