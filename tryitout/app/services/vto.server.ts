import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export type VtoJobStatus = "queued" | "processing" | "completed" | "failed";

export type VtoItem = {
  item_image_url: string;
  sub_type: string;
};

export type VtoJob = {
  job_id: string;
  status: VtoJobStatus;
  progress: number;
  image_url?: string;
  error?: string;
  created_at: string;
};

type SubmitInput = {
  items: VtoItem[];
  photo: Blob;
};

const jobs = new Map<string, VtoJob>();
const uploads = new Map<
  string,
  { body: Buffer; mime: string; expiresAt: number }
>();
const UPLOAD_TTL_MS = 60 * 60 * 1000;
const WEBHOOK_DEFAULT = "https://ai.talentool.in/webhook/virtual-tryon";

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  const v = value.trim();
  return v.startsWith("your_") || v.startsWith("<") || v.includes("YOUR-POSTMAN-HOST");
}

function webhookUrl() {
  const configured = process.env.MYAIIRA_VTO_WEBHOOK_URL?.trim();
  if (configured && !isPlaceholder(configured)) return configured;
  return WEBHOOK_DEFAULT;
}

function publicBaseUrl() {
  const base =
    process.env.MYAIIRA_VTO_PUBLIC_BASE_URL?.trim() ||
    process.env.SHOPIFY_APP_URL?.trim() ||
    process.env.HOST?.trim();
  if (!base || base.includes("example.com")) {
    throw new Error(
      "Set SHOPIFY_APP_URL or MYAIIRA_VTO_PUBLIC_BASE_URL so the VTO API can fetch uploaded photos.",
    );
  }
  return base.replace(/\/$/, "");
}

export function parseVtoItems(raw: unknown): VtoItem[] | null {
  if (typeof raw === "string" && raw.trim()) {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;

  const items = raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const item_image_url = String(row.item_image_url || "").trim();
      const sub_type = String(row.sub_type || "default").trim().toLowerCase();
      if (!item_image_url) return null;
      return { item_image_url, sub_type };
    })
    .filter((item): item is VtoItem => item !== null);

  return items.length > 0 ? items : null;
}

export function getCachedShopperPhoto(uploadId: string) {
  const entry = uploads.get(uploadId);
  if (!entry || entry.expiresAt <= Date.now()) {
    uploads.delete(uploadId);
    return null;
  }
  return entry;
}

async function publishShopperPhoto(photo: Blob, uploadId: string) {
  uploads.set(uploadId, {
    body: Buffer.from(await photo.arrayBuffer()),
    mime: photo.type || "image/jpeg",
    expiresAt: Date.now() + UPLOAD_TTL_MS,
  });
  return `${publicBaseUrl()}/vto/uploads/${uploadId}`;
}

function updateJob(jobId: string, patch: Partial<VtoJob>) {
  const current = jobs.get(jobId);
  if (current) jobs.set(jobId, { ...current, ...patch });
}

function extractResultImageUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;

  for (const key of ["result_image_url", "image_url", "result_url"]) {
    const value = record[key];
    if (typeof value === "string" && value.startsWith("http")) return value;
  }

  for (const nestedKey of ["data", "output", "result"]) {
    const nested = record[nestedKey];
    const url = extractResultImageUrl(nested);
    if (url) return url;
  }

  return null;
}

async function callWebhook(userImageUrl: string, items: VtoItem[]) {
  const res = await fetch(webhookUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_image_url: userImageUrl, items }),
    signal: AbortSignal.timeout(300_000),
  });

  const raw = await res.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : raw.slice(0, 200) || res.statusText;
    throw new Error(`virtual-tryon failed (${res.status}): ${detail}`);
  }

  if (data && typeof data === "object" && (data as { success?: boolean }).success === false) {
    throw new Error(String((data as { error?: unknown }).error || "virtual-tryon failed"));
  }

  const imageUrl = extractResultImageUrl(data);
  if (!imageUrl) throw new Error("virtual-tryon response missing result image URL");
  return imageUrl;
}

async function processJob(jobId: string, input: SubmitInput) {
  try {
    updateJob(jobId, { status: "processing", progress: 25 });

    const override = process.env.MYAIIRA_VTO_USER_IMAGE_URL?.trim();
    const userImageUrl =
      override && !isPlaceholder(override)
        ? override
        : await publishShopperPhoto(input.photo, jobId);

    updateJob(jobId, { progress: 50 });
    console.info("VTO webhook", {
      jobId,
      url: webhookUrl(),
      itemCount: input.items.length,
    });

    const imageUrl = await callWebhook(userImageUrl, input.items);
    updateJob(jobId, { status: "completed", progress: 100, image_url: imageUrl });
  } catch (error) {
    console.error("VTO job failed", jobId, error);
    updateJob(jobId, {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : "Virtual try-on failed",
    });
  }
}

async function parseSubmitRequest(request: Request) {
  const form = await request.formData();
  const photo = form.get("photo");
  const rawItems = form.get("items");

  return {
    productId: String(form.get("product_id") || ""),
    productImageUrl: String(form.get("product_image_url") || ""),
    photo: photo instanceof Blob ? photo : null,
    items: parseVtoItems(rawItems),
  };
}

export async function vtoJobsAction({ request }: ActionFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);
  } catch (error) {
    if (error instanceof Response) throw error;
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let productId: string;
  let productImageUrl: string;
  let photo: Blob | null;
  let items: VtoItem[] | null;

  try {
    ({ productId, productImageUrl, photo, items } = await parseSubmitRequest(request));
  } catch {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  if (!photo?.size || !productId) {
    return json({ error: "photo and product_id required" }, { status: 400 });
  }
  if (!items?.length) {
    return json({ error: "outfit items required on Atelier Look block" }, { status: 400 });
  }

  if (process.env.MYAIIRA_VTO_USE_MOCK === "true") {
    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      job_id: jobId,
      status: "completed",
      progress: 100,
      image_url: productImageUrl,
      created_at: new Date().toISOString(),
    });
    return json({ job_id: jobId, status: "completed" }, { status: 202 });
  }

  const jobId = crypto.randomUUID();
  jobs.set(jobId, {
    job_id: jobId,
    status: "queued",
    progress: 10,
    created_at: new Date().toISOString(),
  });

  void processJob(jobId, { items, photo });

  return json({ job_id: jobId, status: "queued" }, { status: 202 });
}

export async function vtoJobsLoader() {
  return json({ error: "Use POST" }, { status: 405 });
}

export async function vtoJobStatusLoader({ request, params }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);
  } catch (error) {
    if (error instanceof Response) throw error;
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = params.jobId;
  if (!jobId) return json({ error: "job_id required" }, { status: 400 });

  const job = jobs.get(jobId);
  if (!job) return json({ error: "Job not found" }, { status: 404 });

  return json(job);
}
