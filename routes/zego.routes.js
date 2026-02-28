const router = require("express").Router();
const { generateZegoToken } = require("../controllers/zego.controller");
const { protect } = require("../middlewares/auth.middleware");


router.post("/token", protect, generateZegoToken);

router.post("/zego/token-flutter", protect, generateZegoTokenFlutter);

module.exports = router;