import { Router } from "express";
import postOtp from "@/controllers/otp/post";
import postLogin from "@/controllers/login/post";
import postEmailVerification from "@/controllers/emailVerification/post";
import postEmailConfirmation from "@/controllers/emailConfirmation/post";
import getSecuritySettings from "@/controllers/securitySettings/get";
import postPin from "@/controllers/pin/post";
import putPin from "@/controllers/pin/put";
import postPinVerification from "@/controllers/pinVerification/post";
import postPinResetOtp from "@/controllers/pinResetOtp/post";
import postPinReset from "@/controllers/pinReset/post";
import postBiometric from "@/controllers/biometric/post";
import deleteBiometric from "@/controllers/biometric/delete";
import postBiometricChallenge from "@/controllers/biometricChallenge/post";
import postBiometricVerification from "@/controllers/biometricVerification/post";
import postSessionUnlock from "@/controllers/sessionUnlock/post";
import postSessionChallenge from "@/controllers/sessionChallenge/post";
import postLogout from "@/controllers/logout/post";
import getDevices from "@/controllers/devices/get";
import deleteDevice from "@/controllers/device/delete";
import sessionUnlockLimiter from "@/middlewares/rateLimit/sessionUnlockLimiter";
import otpRequestLimiter from "@/middlewares/rateLimit/otpRequestLimiter";
import loginLimiter from "@/middlewares/rateLimit/loginLimiter";
import postSessionExtension from "@/controllers/sessionExtension/post";
import requireAuth from "@/middlewares/requireAuth";

const router = Router();

router.post("/otp", otpRequestLimiter, postOtp);
router.post("/login", loginLimiter, postLogin);

// Idle unlock on a trusted device — authenticated by the refresh token.
router.post("/session/unlock", sessionUnlockLimiter, postSessionUnlock);
router.post("/session/challenge", sessionUnlockLimiter, postSessionChallenge);
// While the app is in use: a new access token for a still-valid one (no PIN). Idle → it expires → unlock.
router.post("/session/extend", requireAuth, postSessionExtension);
router.post("/logout", requireAuth, postLogout);

router.get("/devices", requireAuth, getDevices);
router.delete("/devices/:deviceId", requireAuth, deleteDevice);

router.post("/email/verification", requireAuth, postEmailVerification);
router.post("/email/confirmation", requireAuth, postEmailConfirmation);

router.get("/security", requireAuth, getSecuritySettings);

router.post("/pin", requireAuth, postPin);
router.put("/pin", requireAuth, putPin);
router.post("/pin/verification", requireAuth, postPinVerification);
router.post("/pin/reset/otp", requireAuth, otpRequestLimiter, postPinResetOtp);
router.post("/pin/reset", requireAuth, postPinReset);

router.post("/biometrics", requireAuth, postBiometric);
router.delete("/biometrics/:deviceId", requireAuth, deleteBiometric);
router.post("/biometrics/challenge", requireAuth, postBiometricChallenge);
router.post("/biometrics/verification", requireAuth, postBiometricVerification);

export default router;
