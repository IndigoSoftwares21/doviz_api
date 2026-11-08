import { Router } from "express";
import requireDocsEnabled from "@/middlewares/requireDocsEnabled";
import docsSecurityHeaders from "@/middlewares/docsSecurityHeaders";
import protectDocs from "@/middlewares/protectDocs";
import docsLoginLimiter from "@/middlewares/rateLimit/docsLoginLimiter";
import getDocsLogin from "@/controllers/docsLogin/get";
import postDocsLogin from "@/controllers/docsLogin/post";
import getDocsLogout from "@/controllers/docsLogout/get";
import getDocs from "@/controllers/docs/get";
import getOpenApiSpec from "@/controllers/openApiSpec/get";

const router = Router();

router.use(requireDocsEnabled);
router.use(docsSecurityHeaders);

// Public: login/logout.
router.get("/login", getDocsLogin);
router.post("/login", docsLoginLimiter, postDocsLogin);
router.get("/logout", getDocsLogout);

// Everything below needs a valid docs session.
router.use(protectDocs);
router.get("/openapi.json", getOpenApiSpec);
router.get("/", getDocs);

export default router;
