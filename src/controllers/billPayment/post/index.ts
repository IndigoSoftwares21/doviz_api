import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import handlePinFailure from "@/utils/auth/handlePinFailure";
import createBillPayment from "@/actions/billPayment/createBillPayment";
import billProviderRegistry from "@/services/bills/billProviderRegistry";
import postBillPaymentSchema from "./schema/postBillPaymentSchema";
import PIN_VERIFICATION_STATUS from "@/constants/pinVerificationStatus";
import ACTION_FAILURE from "@/constants/actionFailure";
import { BILL_CUSTOMER_NOT_FOUND, BILLS_UNAVAILABLE } from "@/controllers/billCustomerValidation/post";
import FormatNaira from "@/utils/bills/formatNaira";

export const INSUFFICIENT_BALANCE = "You don't have enough balance for this payment";

const postBillPayment = async (req: Request, res: Response) => {
    try {
        const { productId, customerId, amount, idempotencyKey, pin } = req.body;
        const { id: userId } = req.user!;
        const provider = billProviderRegistry.active();

        const validated = await postBillPaymentSchema.parseAsync({
            provider: provider.name,
            environment: provider.environment,
            productId,
            customerId,
            amount,
            idempotencyKey,
            pin,
        });

        const { data, failure, verification, isNew, limits } = await createBillPayment({
            userId,
            productId: validated.productId,
            customerId: validated.customerId,
            amount: validated.amount ?? null,
            idempotencyKey: validated.idempotencyKey,
            pin: validated.pin,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        });

        if (verification.status !== PIN_VERIFICATION_STATUS.VERIFIED) return handlePinFailure({ res, req, verification });
        if (failure === ACTION_FAILURE.INSUFFICIENT_BALANCE) return handleError({ res, req, message: INSUFFICIENT_BALANCE, code: 402 });
        if (failure === ACTION_FAILURE.CUSTOMER_NOT_FOUND) return handleError({ res, req, message: BILL_CUSTOMER_NOT_FOUND, code: 400 });
        if (failure === ACTION_FAILURE.PROVIDER_UNAVAILABLE) return handleError({ res, req, message: BILLS_UNAVAILABLE, code: 503 });
        if (failure === ACTION_FAILURE.AMOUNT_OUT_OF_RANGE) {
            const range = [limits?.minAmount && `at least ₦${FormatNaira({ value: limits.minAmount })}`, limits?.maxAmount && `at most ₦${FormatNaira({ value: limits.maxAmount })}`];
            return handleError({ res, req, message: `For this customer the amount must be ${range.filter(Boolean).join(" and ")}`, code: 400 });
        }

        res.set("Cache-Control", "no-store");

        return isNew
            ? handleSuccess({ res, req, message: "Bill payment submitted", code: 201, data })
            : handleSuccess({ res, req, message: "Bill payment already submitted", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to pay bill", error });
    }
};

export default postBillPayment;
