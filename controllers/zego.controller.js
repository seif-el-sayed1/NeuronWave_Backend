const crypto   = require("crypto");
const ApiError = require("../utils/ApiError");

const APP_ID = parseInt(process.env.ZEGO_APP_ID);
const SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;

/**
 * Generates a secure ZEGOCLOUD UIKit token on the backend so authenticated
 * users can join real-time audio/video rooms.
 *
 * It creates a payload (app ID, user ID, timestamps, expiry), encrypts it
 * with AES-256-CBC using the server secret, and formats it exactly as
 * required by the ZEGOCLOUD UIKit Prebuilt SDK.
 *
 * The frontend uses the returned token with ZegoUIKitPrebuilt.create(token).
 * This must run on the server to keep the SERVER_SECRET private and ensure
 * the token is time-limited and secure for production use.
 */

function generateKitToken(appId, serverSecret, roomId, userId, userName, effectiveSeconds = 7200) {
  const now    = Date.now() / 1000 | 0;
  const expire = now + effectiveSeconds;
  const nonce  = 2147483647 * Math.random() | 0;

  const payload = JSON.stringify({ app_id: appId, user_id: userId, nonce, ctime: now, expire });

  // Random 16-char IV string (same as UIKit)
  let iv = Math.random().toString().substring(2, 18);
  if (iv.length < 16) iv += iv.substring(0, 16 - iv.length);

  // AES-256-CBC encryption using server secret
  const key    = Buffer.from(serverSecret, "utf8");
  const ivBuf  = Buffer.from(iv, "utf8");
  const cipher = crypto.createCipheriv("aes-256-cbc", key, ivBuf);
  const h      = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const c      = h.length;

  // Binary struct layout required by UIKit
  const struct = Buffer.alloc(28 + c);
  struct.writeUInt32BE(0, 0);
  struct.writeUInt32LE(expire, 4);
  struct[8] = iv.length >> 8;
  struct[9] = iv.length & 0xff;
  Buffer.from(iv, "ascii").copy(struct, 10);
  struct[26] = c >> 8;
  struct[27] = c & 0xff;
  h.copy(struct, 28);

  const meta = Buffer.from(JSON.stringify({
    userID:   userId,
    roomID:   roomId,
    userName: encodeURIComponent(userName),
    appID:    appId,
  })).toString("base64");

  return {
    token: `04${struct.toString("base64")}#${meta}`,
    expire,
  };
}

exports.generateZegoToken = async (req, res, next) => {
  try {
    const userId   = req.user._id.toString();
    const userName = req.user.fullName || req.user.firstName || req.user.name || "Unknown";
    const { roomId } = req.body;

    if (!roomId)
      return next(new ApiError("Room ID is required", 400));
    if (!APP_ID || !SERVER_SECRET)
      return next(new ApiError("Zego credentials not configured", 500));

    const { token, expire } = generateKitToken(APP_ID, SERVER_SECRET, roomId, userId, userName);

    res.status(200).json({
      success: true,
      data: { token, appId: APP_ID, userId, roomId, expire },
    });
  } catch (error) {
    next(new ApiError(error.message, 500));
  }
};