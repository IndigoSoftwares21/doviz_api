import { Router } from "express";
import getCryptoAssets from "@/controllers/cryptoAssets/get";
import getCryptoQuote from "@/controllers/cryptoQuote/get";
import postCryptoWallet from "@/controllers/cryptoWallet/post";
import getCryptoWallets from "@/controllers/cryptoWallets/get";
import getCryptoBuyAssets from "@/controllers/cryptoBuyAssets/get";
import getCryptoBuyQuote from "@/controllers/cryptoBuyQuote/get";
import postCryptoPurchase from "@/controllers/cryptoPurchase/post";
import getCryptoPurchase from "@/controllers/cryptoPurchase/get";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

router.get("/assets", requireAuth, getCryptoAssets);
router.get("/quote", requireAuth, getCryptoQuote);
router.post("/wallets", requireAuth, postCryptoWallet);
router.get("/wallets", requireAuth, getCryptoWallets);
// Buying crypto with naira. /assets and /quote before /:purchaseId so they aren't taken for an id.
router.get("/buy/assets", requireAuth, getCryptoBuyAssets);
router.get("/buy/quote", requireAuth, getCryptoBuyQuote);
router.post("/buy", requireAuth, postCryptoPurchase);
router.get("/buy/:purchaseId", requireAuth, getCryptoPurchase);

export default router;
