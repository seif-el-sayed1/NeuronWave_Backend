const router = require("express").Router();
const ZegoController = require("../controllers/zego.controller");

const { protect } = require("../middlewares/auth.middleware");

// token for frontend
router.post("/token", protect, ZegoController.generateZegoToken);
// token for flutter
router.post("/token-flutter", protect, ZegoController.generateZegoTokenFlutter);

module.exports = router;