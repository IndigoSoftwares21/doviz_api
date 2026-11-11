import { Request, Response } from "express";
import handleSuccess from "@/utils/handleSuccess";
import handleError from "@/utils/handleError";
import fetchTagSuggestions from "@/actions/userTag/fetchTagSuggestions";

const getTagSuggestions = async (req: Request, res: Response) => {
    try {
        const { id: userId } = req.user!;

        const { data } = await fetchTagSuggestions({ userId });

        res.set("Cache-Control", "no-store");

        return handleSuccess({ res, req, message: "Ziktag suggestions", code: 200, data });
    } catch (error) {
        return handleError({ res, req, message: "Failed to suggest Ziktags", error });
    }
};

export default getTagSuggestions;
