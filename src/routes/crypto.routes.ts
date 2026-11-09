import { Router } from "express";
import getCryptoAssets from "@/controllers/cryptoAssets/get";
import getCryptoQuote from "@/controllers/cryptoQuote/get";
import postCryptoWallet from "@/controllers/cryptoWallet/post";
import getCryptoWallets from "@/controllers/cryptoWallets/get";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

router.get("/assets", requireAuth, getCryptoAssets);
router.get("/quote", requireAuth, getCryptoQuote);
router.post("/wallets", requireAuth, postCryptoWallet);
router.get("/wallets", requireAuth, getCryptoWallets);

export default router;
