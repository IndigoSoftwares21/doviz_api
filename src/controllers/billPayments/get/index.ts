import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchBillPayments from "@/actions/billPayments/fetchBillPayments";
import getBillPaymentsSchema from "./schema/getBillPaymentsSchema";

const getBillPayments = async (req: Request, res: Response) => {
    try {
        const { limit, offset } = req.query;
        const { id: userId } = req.user!;

        const validated = await getBillPaymentsSchema.parseAsync({ limit, offset });

        const { data } = await fetchBillPayments({ userId, limit: validated.limit, offset: validated.offset });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Bill payments fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch bill payments", error });
    }
};

export default getBillPayments;
