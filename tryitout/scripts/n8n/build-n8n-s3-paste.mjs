import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(dir, "../..");
const sourcePath = path.join(dir, "vto-user-upload-s3-code.js");
const pastePath = path.join(dir, "vto-user-upload-s3-n8n-paste.js");
const workflowPath = path.join(dir, "vto-user-upload-s3.workflow.json");
const envPath = path.join(rootDir, ".env");

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    env[key] = value;
  }
  return env;
}

function injectEnvConfig(source, env) {
  const config = {
    AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID || "PASTE_AWS_ACCESS_KEY_ID",
    AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY || "PASTE_AWS_SECRET_ACCESS_KEY",
    AWS_REGION: env.AWS_REGION || "ap-south-1",
    S3_UPLOAD_BUCKET: env.S3_UPLOAD_BUCKET || "shopify-product-cdn",
    S3_UPLOAD_PREFIX: env.S3_UPLOAD_PREFIX || "vto-test/shopper-photos/",
    S3_PRESIGN_TTL_SECONDS: env.S3_PRESIGN_TTL_SECONDS || "86400",
  };

  let out = source;
  for (const [key, value] of Object.entries(config)) {
    const pattern = new RegExp(`const ${key} = (?:"[^"]*"|\\d+);`);
    const replacement =
      key === "S3_PRESIGN_TTL_SECONDS"
        ? `const ${key} = ${Number(value) || 86400};`
        : `const ${key} = ${JSON.stringify(value)};`;
    out = out.replace(pattern, replacement);
  }
  return out;
}

const env = loadEnv(envPath);
const source = fs.readFileSync(sourcePath, "utf8").trimEnd();
const configuredSource = injectEnvConfig(source, env);
const paste = [
  "// === n8n S3 Upload — paste this ENTIRE file (select all, replace) ===",
  "// Mode: Run Once for Each Item | Language: JavaScript",
  "// Generated from tryitout/.env — do not commit this file",
  "",
  configuredSource,
  "",
].join("\n");

fs.writeFileSync(pastePath, paste);

// Workflow JSON keeps placeholders only (safe to commit).
const workflowSource = [
  "// === n8n S3 Upload — paste this ENTIRE file (select all, replace) ===",
  "// Mode: Run Once for Each Item | Language: JavaScript",
  "",
  source,
  "",
].join("\n");

if (fs.existsSync(workflowPath)) {
  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
  const node = workflow.nodes.find((n) => n.name === "S3 Upload");
  if (node) node.parameters.jsCode = workflowSource;
  fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
}

const hasKeys = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
console.log(`Wrote ${pastePath} (${paste.split("\n").length} lines)`);
console.log(
  hasKeys
    ? "✓ AWS creds loaded from tryitout/.env — paste into n8n S3 Upload Code node"
    : "⚠ No AWS creds in tryitout/.env — paste file still has PASTE_* placeholders",
);
