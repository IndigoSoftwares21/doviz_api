import selectAppSetting from "@/actions/appSettings/fetchActiveKycLevel/queries/selectAppSetting";
import { APP_SETTINGS, AppSettingKey } from "@/constants/appSettings";

/** A feature switch's current value; its fallback when missing or not an allowed value. */
const fetchAppSetting = async ({ key }: { key: AppSettingKey }) => {
    const setting = await selectAppSetting({ key });
    const allowed: readonly string[] = APP_SETTINGS[key].values;
    return { data: setting && allowed.includes(setting.value) ? setting.value : APP_SETTINGS[key].fallback };
};

/** True when users may send to bank accounts that aren't their own. */
export const canSendToOthers = async () => (await fetchAppSetting({ key: "bank_transfers_to_others" })).data === "on";

export default fetchAppSetting;
