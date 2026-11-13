import selectAppSetting from "./queries/selectAppSetting";
import { DEFAULT_KYC_LEVEL, KYC_LEVEL_SETTING } from "@/constants/kyc";
import { KYC_FORMS } from "@/constants/kycFields";

/**
 * Which checks identity verification runs now (app_settings → kyc_level,
 * switched with `npm run kyc:level -- <level>`). Missing or unknown falls back
 * to the default. The form and the validation both follow it.
 */
const fetchActiveKycLevel = async () => {
    const setting = await selectAppSetting({ key: KYC_LEVEL_SETTING });
    const level = setting && KYC_FORMS[setting.value] ? setting.value : DEFAULT_KYC_LEVEL;
    return { data: level };
};

export default fetchActiveKycLevel;
