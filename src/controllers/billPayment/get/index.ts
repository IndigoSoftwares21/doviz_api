import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchBillPayment from "@/actions/billPayment/fetchBillPayment";
import getBillPaymentSchema from "./schema/getBillPaymentSchema";

const getBillPayment = async (req: Request, res: Response) => {
    try {
        const { billPaymentId } = req.params;
        const { id: userId } = req.user!;

        const validated = await getBillPaymentSchema.parseAsync({ billPaymentId });

        const { data } = await fetchBillPayment({ userId, billPaymentId: validated.billPaymentId });
        if (!data) return handleError({ res, req, message: "Bill payment not found", code: 404 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Bill payment fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch bill payment", error });
    }
};

export default getBillPayment;
