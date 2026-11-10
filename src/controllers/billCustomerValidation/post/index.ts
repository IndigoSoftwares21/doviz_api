import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import createBillCustomerValidation from "@/actions/billCustomerValidation/createBillCustomerValidation";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import postBillCustomerValidationSchema from "./schema/postBillCustomerValidationSchema";
import ACTION_FAILURE from "@/constants/actionFailure";

export const BILL_CUSTOMER_NOT_FOUND = "We couldn't find this customer number. Check it and try again.";
export const BILLS_UNAVAILABLE = "Bill payments are temporarily unavailable. Please try again shortly.";

const postBillCustomerValidation = async (req: Request, res: Response) => {
    try {
        const { productId, customerId } = req.body;
        const provider = billProviderRegistry.active();

        const validated = await postBillCustomerValidationSchema.parseAsync({
            provider: provider.name,
            environment: provider.environment,
            productId,
            customerId,
        });

        const { data, failure } = await createBillCustomerValidation({
            productId: validated.productId,
            customerId: validated.customerId,
        });

        if (failure === ACTION_FAILURE.CUSTOMER_NOT_FOUND) {
            return handleError({ res, req, message: BILL_CUSTOMER_NOT_FOUND, code: 400 });
        }
        if (failure === ACTION_FAILURE.PROVIDER_UNAVAILABLE) {
            return handleError({ res, req, message: BILLS_UNAVAILABLE, code: 503 });
        }

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Customer found", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to verify customer", error });
    }
};

export default postBillCustomerValidation;
