const crypto   = require("crypto");
const ApiError = require("../utils/ApiError");

// Read Zego credentials from environment
const APP_ID = parseInt(process.env.ZEGO_APP_ID);
const SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;

// Token generator for Web / ZegoUIKit
function generateKitToken(appId, serverSecret, roomId, userId, userName, effectiveSeconds = 7200) {
  const now    = Date.now() / 1000 | 0;          // current time (seconds)
  const expire = now + effectiveSeconds;         // token expiration time
  const nonce  = 2147483647 * Math.random() | 0; // random number to avoid replay

  // Payload that will be encrypted
  const payload = JSON.stringify({ app_id: appId, user_id: userId, nonce, ctime: now, expire });

  // Generate IV (16 bytes required for AES-256-CBC)
  let iv = Math.random().toString().substring(2, 18);
  if (iv.length < 16) iv += iv.substring(0, 16 - iv.length);

  const key = Buffer.from(serverSecret, "utf8"); // encryption key
  const ivBuf = Buffer.from(iv, "utf8");
  const cipher = crypto.createCipheriv("aes-256-cbc", key, ivBuf);

  // Encrypt payload
  const h = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const c = h.length;

  // Build token structure required by Zego
  const struct = Buffer.alloc(28 + c);
  struct.writeUInt32BE(0, 0);
  struct.writeUInt32LE(expire, 4);
  struct[8] = iv.length >> 8;
  struct[9] = iv.length & 0xff;
  Buffer.from(iv, "ascii").copy(struct, 10);
  struct[26] = c >> 8;
  struct[27] = c & 0xff;
  h.copy(struct, 28);

  // Extra metadata used by UIKit
  const meta = Buffer.from(JSON.stringify({
    userID:   userId,
    roomID:   roomId,
    userName: encodeURIComponent(userName),
    appID:    appId,
  })).toString("base64");

  return {
    token: `04${struct.toString("base64")}#${meta}`, // final token format
    expire,
  };
}

// Token generator for Flutter SDK
function generateFlutterToken(appId, serverSecret, userId, roomId, effectiveSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const expire = now + effectiveSeconds;
  const nonce = Math.floor(Math.random() * 2147483647);

  const payload = JSON.stringify({
    app_id: appId,
    user_id: userId,
    nonce: nonce,
    ctime: now,
    expire: expire,
    payload: "", // required by Flutter implementation
  });

  const key = Buffer.from(serverSecret, "utf8");
  const iv = crypto.randomBytes(16); // secure random IV
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);

  // Build final token buffer
  const result = Buffer.alloc(8 + 16 + 2 + encrypted.length);
  result.writeUInt32BE(0, 0);
  result.writeUInt32LE(expire, 4);
  iv.copy(result, 8);
  result.writeUInt16BE(encrypted.length, 24);
  encrypted.copy(result, 26);

  return {
    token:  "04" + result.toString("base64"),
    expire: expire,
  };
}

// Endpoint for Web clients
exports.generateZegoToken = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const userName = req.user.fullName || req.user.firstName || req.user.name || "Unknown";
    const { roomId } = req.body;

    if (!roomId)
      return next(new ApiError("Room ID is required", 400));

    // Ensure Zego credentials exist
    if (!APP_ID || !SERVER_SECRET)
      return next(new ApiError("Zego credentials not configured", 500));

    const { token, expire } =
      generateKitToken(APP_ID, SERVER_SECRET, roomId, userId, userName);

    res.status(200).json({
      success: true,
      data: { token, appId: APP_ID, userId, roomId, expire },
    });
  } catch (error) {
    next(new ApiError(error.message, 500));
  }
};

// Endpoint for Flutter clients
exports.generateZegoTokenFlutter = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const { roomId } = req.body;

    if (!roomId)
      return next(new ApiError("Room ID is required", 400));

    if (!APP_ID || !SERVER_SECRET)
      return next(new ApiError("Zego credentials not configured", 500));

    const { token, expire } =
      generateFlutterToken(APP_ID, SERVER_SECRET, userId, roomId);

    res.status(200).json({
      success: true,
      data: { token, appId: APP_ID, userId, roomId, expire },
    });
  } catch (error) {
    next(new ApiError(error.message, 500));
  }
};