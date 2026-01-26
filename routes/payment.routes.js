const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");

// paymentController uses unified checkout
router.post("/processed", paymentController.processed);
router.get("/response", paymentController.response);
router.post("/callback", paymentController.callBack);

module.exports = router;
