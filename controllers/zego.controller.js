const APP_ID = parseInt(process.env.ZEGO_APP_ID);
const SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;
const ApiError = require("../utils/ApiError");
const crypto = require("crypto");

function generateToken(userId, roomId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const expire = timestamp + 3600; // token valid for 1 hour

  // Payload that will be encrypted inside the token
  const payload = JSON.stringify({
    app_id: APP_ID,
    user_id: userId,
    nonce: Math.floor(Math.random() * 2147483647), // prevent replay
    ctime: timestamp,
    expire: expire,
    payload: ""
  });

  const payloadBuffer = Buffer.from(payload, "utf8");

  // Manual padding required for AES-128-CBC
  const padLen = 16 - (payloadBuffer.length % 16);
  const padded = Buffer.concat([payloadBuffer, Buffer.alloc(padLen, padLen)]);

  const iv = crypto.randomBytes(16); // random IV per token
  const keyBuffer = Buffer.from(SERVER_SECRET, "utf8").slice(0, 16);

  const cipher = crypto.createCipheriv("aes-128-cbc", keyBuffer, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);

  // Final token structure
  const result = Buffer.alloc(2 + iv.length + encrypted.length);
  result.writeUInt16BE(iv.length, 0);
  iv.copy(result, 2);
  encrypted.copy(result, 2 + iv.length);

  const base64 = result.toString("base64");
  const token = `04${String(expire).padStart(10, "0")}${base64}`;

  return { token, expire };
}

exports.generateZegoToken = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const { roomId } = req.body;

    // Basic validation
    if (!roomId) return next(new ApiError("Room ID is required", 400));
    if (!APP_ID || !SERVER_SECRET) return next(new ApiError("Zego credentials not configured", 500));

    const { token, expire } = generateToken(userId, roomId);

    res.status(200).json({
      success: true,
      data: {
        token,
        appId: APP_ID,
        userId,
        roomId,
        expire,
      },
    });
  } catch (error) {
    next(new ApiError(error.message, 500));
  }
};