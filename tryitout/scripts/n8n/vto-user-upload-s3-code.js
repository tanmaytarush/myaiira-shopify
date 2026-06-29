// Edit here → run: node scripts/n8n/build-n8n-s3-paste.mjs → paste into n8n S3 Upload Code node.
// Pure JS SigV4 — no require(), no Web Crypto (n8n sandbox safe).
/* global $input */

// === EDIT THESE at the top of the n8n Code node (Community Edition has no Variables UI) ===
const AWS_ACCESS_KEY_ID = "PASTE_AWS_ACCESS_KEY_ID";
const AWS_SECRET_ACCESS_KEY = "PASTE_AWS_SECRET_ACCESS_KEY";
const AWS_REGION = "ap-south-1";
const S3_UPLOAD_BUCKET = "shopify-product-cdn";
const S3_UPLOAD_PREFIX = "vto-test/shopper-photos/";
const S3_PRESIGN_TTL_SECONDS = 86400;

function env(name, fallback) {
  try {
    if (typeof $env !== "undefined" && $env[name]) {
      return String($env[name]).trim();
    }
  } catch (_) {
    /* $env not available in this n8n version */
  }
  if (typeof process !== "undefined" && process.env?.[name]) {
    return String(process.env[name]).trim();
  }
  return fallback;
}

function extensionForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function newUploadId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function collectInputItems(ctx) {
  const items = [];
  const seen = new Set();

  function push(item) {
    if (!item || seen.has(item)) return;
    seen.add(item);
    items.push(item);
  }

  const webhookNames = ["Webhook", "webhook"];
  for (let i = 0; i < webhookNames.length; i++) {
    const name = webhookNames[i];
    try {
      if (typeof $ === "function") {
        const hook = $(name);
        if (hook && typeof hook.first === "function") push(hook.first());
        if (hook && typeof hook.all === "function") {
          const hookItems = hook.all();
          for (let j = 0; j < hookItems.length; j++) push(hookItems[j]);
        }
      }
    } catch (_) {
      /* node not found */
    }
  }

  if (typeof $input !== "undefined") {
    try {
      if (typeof $input.first === "function") push($input.first());
      if (typeof $input.all === "function") {
        const inputItems = $input.all();
        for (let k = 0; k < inputItems.length; k++) push(inputItems[k]);
      }
      if ($input.item) push($input.item);
    } catch (_) {
      /* $input unavailable */
    }
  }

  if (ctx && typeof ctx.getInputData === "function") {
    const ctxItems = ctx.getInputData();
    for (let m = 0; m < ctxItems.length; m++) push(ctxItems[m]);
  }

  return items;
}

function flattenJsonPayload(json) {
  if (!json || typeof json !== "object") return {};
  const out = Object.assign({}, json);
  const body = json.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    Object.assign(out, body);
  } else if (typeof body === "string" && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") Object.assign(out, parsed);
    } catch (_) {
      /* body is plain text */
    }
  }
  return out;
}

function bufferFromBinaryRef(bin) {
  if (!bin || bin.data == null) return null;

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(bin.data)) {
    return bin.data.length ? bin.data : null;
  }

  if (bin.data instanceof Uint8Array) {
    return bin.data.length ? Buffer.from(bin.data) : null;
  }

  if (typeof bin.data !== "string") return null;

  const encoding = String(bin.encoding || "base64").toLowerCase();
  if (encoding === "base64") {
    const buf = Buffer.from(bin.data, "base64");
    return buf.length ? buf : null;
  }
  if (encoding === "binary" || encoding === "latin1") {
    const buf = Buffer.from(bin.data, "latin1");
    return buf.length ? buf : null;
  }
  const buf = Buffer.from(bin.data, "utf8");
  return buf.length ? buf : null;
}

function tryBinaryFromItem(item) {
  if (!item || !item.binary) return null;
  const keys = Object.keys(item.binary);
  if (!keys.length) return null;
  const key = item.binary.photo ? "photo" : keys[0];
  const buffer = bufferFromBinaryRef(item.binary[key]);
  if (!buffer || !buffer.length) return null;
  return {
    buffer,
    mimeType: item.binary[key].mimeType || "image/jpeg",
  };
}

function tryJsonFromItem(item) {
  const payload = flattenJsonPayload(item && item.json);
  const base64 = String(
    payload.image_base64 || payload.photo_base64 || payload.photo || "",
  ).trim();
  if (!base64) return null;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) return null;
  return {
    buffer,
    mimeType: String(payload.content_type || payload.mime_type || "image/jpeg"),
  };
}

function extractPhotoBufferSync(ctx) {
  try {
    if (typeof $binary !== "undefined" && $binary && typeof $binary === "object") {
      const keys = Object.keys($binary);
      if (keys.length) {
        const key = $binary.photo ? "photo" : keys[0];
        const buffer = bufferFromBinaryRef($binary[key]);
        if (buffer && buffer.length) {
          return { buffer, mimeType: $binary[key].mimeType || "image/jpeg" };
        }
      }
    }
  } catch (_) {
    /* $binary unavailable */
  }

  const items = collectInputItems(ctx);
  for (let i = 0; i < items.length; i++) {
    const fromBinary = tryBinaryFromItem(items[i]);
    if (fromBinary) return fromBinary;
    const fromJson = tryJsonFromItem(items[i]);
    if (fromJson) return fromJson;
  }

  return null;
}

async function extractPhotoBuffer(ctx) {
  const helpers =
    (typeof $helpers !== "undefined" && $helpers) ||
    (ctx && ctx.helpers) ||
    null;

  if (helpers && typeof helpers.getBinaryDataBuffer === "function") {
    const preferred = ["photo", "data", "file", "image"];
    const items = collectInputItems(ctx);
    const itemCount = Math.max(items.length, 1);

    for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
      const item = items[itemIndex] || null;
      const names = item && item.binary ? Object.keys(item.binary) : [];
      const candidates = preferred.concat(names).filter(function (name, idx, arr) {
        return arr.indexOf(name) === idx;
      });

      for (let j = 0; j < candidates.length; j++) {
        const name = candidates[j];
        if (item && item.binary && !item.binary[name]) continue;
        try {
          const raw = await helpers.getBinaryDataBuffer(itemIndex, name);
          const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          if (buffer.length > 256) {
            const mimeType =
              (item && item.binary && item.binary[name] && item.binary[name].mimeType) ||
              "image/jpeg";
            return { buffer, mimeType };
          }
        } catch (_) {
          /* try next binary property */
        }
      }
    }
  }

  const syncResult = extractPhotoBufferSync(ctx);
  if (syncResult) return syncResult;

  throw new Error("photo required (multipart field photo or JSON image_base64)");
}

function outputItem(payload) {
  return [{ json: payload }];
}

function s3Host(bucket, region) {
  if (region === "us-east-1") return `${bucket}.s3.amazonaws.com`;
  return `${bucket}.s3.${region}.amazonaws.com`;
}

function encodePath(key) {
  return key
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment)
        .replace(/!/g, "%21")
        .replace(/'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A"),
    )
    .join("/");
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(value);
    }
    const out = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i) & 0xff;
    return out;
  }
  return new Uint8Array(value);
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x, n) {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(input) {
  const msg = toBytes(input);
  const bitLen = msg.length * 8;
  const padLen = ((56 - ((msg.length + 1) % 64)) + 64) % 64;
  const totalLen = msg.length + 1 + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let hh = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function sha256Hex(value) {
  return bytesToHex(sha256Bytes(value));
}

function hmacSha256(key, message) {
  const block = 64;
  let keyBytes = toBytes(key);
  if (keyBytes.length > block) keyBytes = sha256Bytes(keyBytes);
  if (keyBytes.length < block) {
    const padded = new Uint8Array(block);
    padded.set(keyBytes);
    keyBytes = padded;
  }

  const ipad = new Uint8Array(block);
  const opad = new Uint8Array(block);
  for (let i = 0; i < block; i++) {
    ipad[i] = keyBytes[i] ^ 0x36;
    opad[i] = keyBytes[i] ^ 0x5c;
  }

  return sha256Bytes(concatBytes(opad, sha256Bytes(concatBytes(ipad, toBytes(message)))));
}

function amzDates() {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function signPutObject({
  region,
  bucket,
  key,
  body,
  contentType,
  accessKeyId,
  secretAccessKey,
  sessionToken,
}) {
  const host = s3Host(bucket, region);
  const { amzDate, dateStamp } = amzDates();
  const payloadHash = sha256Hex(body);
  const canonicalUri = `/${encodePath(key)}`;

  const headerMap = {
    host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (sessionToken) headerMap["x-amz-security-token"] = sessionToken;

  const signedHeaderNames = Object.keys(headerMap).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headerMap[name]}\n`)
    .join("");

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = bytesToHex(hmacSha256(kSigning, stringToSign));

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  const headers = {
    Host: host,
    "Content-Type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: authorization,
  };
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;

  return {
    url: `https://${host}${canonicalUri}`,
    headers,
  };
}

function presignTtlSeconds() {
  const raw = env("S3_PRESIGN_TTL_SECONDS", String(S3_PRESIGN_TTL_SECONDS));
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 86400;
  return Math.min(parsed, 604800);
}

function signPresignedGetUrl({
  region,
  bucket,
  key,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  expiresIn,
}) {
  const host = s3Host(bucket, region);
  const { amzDate, dateStamp } = amzDates();
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;
  const canonicalUri = `/${encodePath(key)}`;

  const queryEntries = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  if (sessionToken) {
    queryEntries.push(["X-Amz-Security-Token", sessionToken]);
  }
  queryEntries.sort(function (a, b) {
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });

  const canonicalQueryString = queryEntries
    .map(function (entry) {
      return `${encodeURIComponent(entry[0])}=${encodeURIComponent(entry[1])}`;
    })
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = bytesToHex(hmacSha256(kSigning, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

async function putObjectToS3(helpers, buffer, mimeType) {
  const region = env("AWS_REGION", AWS_REGION);
  const bucket = env("S3_UPLOAD_BUCKET", S3_UPLOAD_BUCKET);
  const prefix = env("S3_UPLOAD_PREFIX", S3_UPLOAD_PREFIX).replace(/^\/+/, "").replace(/\/?$/, "/");
  const accessKeyId = env("AWS_ACCESS_KEY_ID", AWS_ACCESS_KEY_ID);
  const secretAccessKey = env("AWS_SECRET_ACCESS_KEY", AWS_SECRET_ACCESS_KEY);
  const sessionToken = env("AWS_SESSION_TOKEN", "");

  if (
    !accessKeyId ||
    !secretAccessKey ||
    accessKeyId.includes("PASTE_") ||
    secretAccessKey.includes("PASTE_")
  ) {
    throw new Error(
      "Edit AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY at the top of this Code node",
    );
  }
  if (!bucket || !region) {
    throw new Error("Set S3_UPLOAD_BUCKET and AWS_REGION in n8n environment");
  }
  if (!buffer || !buffer.length) {
    throw new Error("photo required (empty upload buffer)");
  }
  if (buffer.length < 256) {
    throw new Error(
      `Photo too small (${buffer.length} bytes). n8n did not read the uploaded file — check Webhook binary property is photo.`,
    );
  }

  const key = `${prefix}vto-model-${newUploadId()}.${extensionForMime(mimeType)}`;
  const { url, headers } = signPutObject({
    region,
    bucket,
    key,
    body: buffer,
    contentType: mimeType,
    accessKeyId,
    secretAccessKey,
    sessionToken,
  });

  try {
    await helpers.httpRequest({
      method: "PUT",
      url,
      headers,
      body: buffer,
      encoding: "binary",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`S3 PUT failed: ${detail}`);
  }

  // Presigned GET URL — works with private buckets; n8n virtual-tryon can fetch this.
  return signPresignedGetUrl({
    region,
    bucket,
    key,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    expiresIn: presignTtlSeconds(),
  });
}

// === n8n entry (Run Once for All Items) ===
async function n8nMain() {
  const helpers =
    (typeof $helpers !== "undefined" && $helpers) ||
    (typeof this !== "undefined" && this.helpers) ||
    null;

  if (!helpers?.httpRequest) {
    return outputItem({
      success: false,
      data: null,
      error: "n8n helpers missing — set Code node Mode to Run Once for All Items",
      httpStatus: 500,
    });
  }

  try {
    const { buffer, mimeType } = await extractPhotoBuffer(this);
    const userImageUrl = await putObjectToS3(helpers, buffer, mimeType);
    return outputItem({
      success: true,
      data: { user_image_url: userImageUrl },
      error: null,
      httpStatus: 200,
    });
  } catch (error) {
    return outputItem({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Upload failed",
      httpStatus: 500,
    });
  }
}

return n8nMain.call(this);
