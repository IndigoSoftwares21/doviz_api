import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchTransferRecipient from "@/actions/transferRecipient/fetchTransferRecipient";
import getTransferRecipientSchema from "./schema/getTransferRecipientSchema";
import { TRANSFER_MESSAGES } from "@/constants/transfers";

// Exact match only. Every "can't pay this tag" reason gets the SAME 404, so a
// lookup never reveals whether a tag exists, is suspended, or is your own.
const getTransferRecipient = async (req: Request, res: Response) => {
    try {
        const { tag } = req.query;
        const { id: viewerId } = req.user!;

        const validated = await getTransferRecipientSchema.parseAsync({ tag });

        const { data } = await fetchTransferRecipient({ tag: validated.tag, viewerId });
        if (!data) return handleError({ res, req, message: TRANSFER_MESSAGES.RECIPIENT_NOT_FOUND, code: 404 });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Recipient found", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to find recipient", error });
    }
};

export default getTransferRecipient;
