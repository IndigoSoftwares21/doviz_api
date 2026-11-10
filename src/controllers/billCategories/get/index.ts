import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchBillCategories from "@/actions/billCategories/fetchBillCategories";

const getBillCategories = async (req: Request, res: Response) => {
    try {
        const { data } = await fetchBillCategories();

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Bill categories fetched", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to fetch bill categories", error });
    }
};

export default getBillCategories;
