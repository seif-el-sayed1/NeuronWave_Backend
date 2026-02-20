// ZegoCloud Server Assistant - Token Generation Utility
// Based on ZegoCloud's official server SDK
const crypto = require("crypto");

// Token version
const VERSION = "04";

// Generate ZegoCloud token
function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload = "") {
  if (!appId || typeof appId !== "number") throw new Error("appId must be a number");
  if (!userId || typeof userId !== "string") throw new Error("userId must be a string");
  if (!secret || typeof secret !== "string") throw new Error("secret must be a string");
  if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== "number")
    throw new Error("effectiveTimeInSeconds must be a number");

  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + effectiveTimeInSeconds;

  // Build the token info buffer
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: Math.floor(Math.random() * 2147483647),
    ctime: createTime,
    expire: expireTime,
    payload: payload,
  };

  const plaintext = JSON.stringify(tokenInfo);
  const plaintextBuffer = Buffer.from(plaintext, "utf8");

  // Generate IV (16 bytes)
  const iv = crypto.randomBytes(16);

  // AES-128-CBC encryption
  const keyBuffer = Buffer.from(secret, "utf8").slice(0, 16);
  const cipher = crypto.createCipheriv("aes-128-cbc", keyBuffer, iv);

  const encryptedBuffer = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);

  // Build result buffer: [IV length (2 bytes)] + [IV] + [encrypted data]
  const resultBuffer = Buffer.alloc(2 + iv.length + encryptedBuffer.length);
  resultBuffer.writeUInt16BE(iv.length, 0);
  iv.copy(resultBuffer, 2);
  encryptedBuffer.copy(resultBuffer, 2 + iv.length);

  // Build final token: VERSION + padding + base64
  const base64Result = resultBuffer.toString("base64");
  const token = `${VERSION}${String(expireTime).padStart(10, "0")}${base64Result}`;

  return token;
}

module.exports = { generateToken04 };