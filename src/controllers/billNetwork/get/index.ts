import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchBillNetwork from "@/actions/billNetwork/fetchBillNetwork";
import getBillNetworkSchema from "./schema/getBillNetworkSchema";

const getBillNetwork = async (req: Request, res: Response) => {
    try {
        const { phone } = req.query;

        const validated = await getBillNetworkSchema.parseAsync({ phone });

        const { data } = await fetchBillNetwork({ phone: validated.phone });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: data.network ? "Network detected" : "Network not recognised", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to detect network", error });
    }
};

export default getBillNetwork;
