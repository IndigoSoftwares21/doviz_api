import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchBillProducts from "@/actions/billProducts/fetchBillProducts";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import getBillProductsSchema from "./schema/getBillProductsSchema";

const getBillProducts = async (req: Request, res: Response) => {
    try {
        const { billerId } = req.params;
        const provider = billProviderRegistry.active();

        const validated = await getBillProductsSchema.parseAsync({
            provider: provider.name,
            environment: provider.environment,
            billerId,
        });

        const { data } = await fetchBillProducts({ billerId: validated.billerId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Bill products fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch bill products", error });
    }
};

export default getBillProducts;
