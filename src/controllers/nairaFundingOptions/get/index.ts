import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchNairaFundingOptions from "@/actions/nairaFunding/fetchNairaFundingOptions";

/** Which Add money flow the app should show. */
const getNairaFundingOptions = async (req: Request, res: Response) => {
    try {
        const { data } = await fetchNairaFundingOptions();
        res.set("Cache-Control", "no-store");
        return handleSuccess({ res, req, message: "Add money options", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to get add money options", error });
    }
};

export default getNairaFundingOptions;
