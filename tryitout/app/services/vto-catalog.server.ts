import {
  VTO_METAFIELD_NAMESPACE,
  VTO_METAFIELDS,
  VTO_PIECE_TYPES,
} from "../constants/vto-piece-types";

export type VtoItem = {
  item_image_url: string;
  sub_type: string;
};

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

function normalizeSubType(raw: string | null | undefined) {
  const value = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!value) return "";
  if ((VTO_PIECE_TYPES as readonly string[]).includes(value)) return value;
  return value;
}

async function listCatalogProductsWithMedia(
  admin: AdminGraphql,
  options: { limit?: number; searchQuery?: string } = {},
) {
  const limit = Math.min(250, Math.max(1, options.limit ?? 250));
  const searchQuery = options.searchQuery?.trim() || null;

  const response = await admin.graphql(
    `#graphql
      query VtoCatalogMedia($first: Int!, $query: String) {
        products(first: $first, query: $query, sortKey: RELEVANCE) {
          nodes {
            id
            title
            handle
            productType
            featuredImage { url }
            subType: metafield(namespace: "${VTO_METAFIELD_NAMESPACE}", key: "${VTO_METAFIELDS.subType}") {
              value
            }
          }
        }
      }`,
    { variables: { first: limit, query: searchQuery } },
  );

  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Could not load catalog products");
  }
  return (json.data?.products?.nodes || []) as Array<{
    id: string;
    title: string;
    handle: string;
    productType?: string | null;
    tags?: string[];
    featuredImage?: { url?: string } | null;
    subType?: { value?: string } | null;
    media?: {
      nodes?: Array<{
        mediaContentType?: string;
        image?: { url?: string; altText?: string | null };
      }>;
    };
  }>;
}

/** Slots shown in the storefront look builder sidebar. */
export const BUILDER_SLOTS = [
  {
    sub_type: "upperwear",
    label: "Upperwear",
    match: ["upperwear", "dress", "top", "saree", "kurta", "kurti", "blouse", "lehenga", "dupatta"],
  },
  { sub_type: "lowerwear", label: "Lowerwear", match: ["lowerwear", "bottom"] },
  { sub_type: "earrings", label: "Earrings", match: ["earrings"] },
  { sub_type: "necklace", label: "Necklace", match: ["necklace"] },
  { sub_type: "footwear", label: "Footwear", match: ["footwear"] },
  { sub_type: "handbag", label: "Handbag", match: ["handbag", "bracelet"] },
] as const;

export type CatalogEntry = VtoItem & {
  title: string;
  product_id: string;
  handle: string;
  product_type: string;
  tags: string[];
  search_text: string;
};

/** Maps Shopify Admin Product type / common merchant labels → VTO sub_type. */
const ADMIN_KEYWORD_TO_SUB_TYPE: Record<string, string> = {
  dress: "dress",
  dresses: "dress",
  gown: "dress",
  top: "top",
  tops: "top",
  upperwear: "upperwear",
  upperware: "upperwear",
  saree: "saree",
  sari: "saree",
  lehenga: "lehenga",
  kurta: "kurta",
  kurti: "kurti",
  blouse: "blouse",
  dupatta: "dupatta",
  lower: "lowerwear",
  lowerwear: "lowerwear",
  bottom: "bottom",
  bottoms: "bottom",
  pant: "lowerwear",
  pants: "lowerwear",
  footwear: "footwear",
  footwears: "footwear",
  footware: "footwear",
  shoe: "footwear",
  shoes: "footwear",
  heel: "footwear",
  heels: "footwear",
  sandal: "footwear",
  sandals: "footwear",
  handbag: "handbag",
  handbags: "handbag",
  bag: "handbag",
  bags: "handbag",
  clutch: "handbag",
  earring: "earrings",
  earrings: "earrings",
  necklace: "necklace",
  necklaces: "necklace",
  bracelet: "bracelet",
  bracelets: "bracelet",
};

const TITLE_KEYWORD_RULES: Array<{ pattern: RegExp; subType: string }> = [
  { pattern: /\bsaree?s?\b/i, subType: "saree" },
  { pattern: /\blehenga?s?\b/i, subType: "lehenga" },
  { pattern: /\bgown?s?\b/i, subType: "dress" },
  { pattern: /\bdress(es)?\b/i, subType: "dress" },
  { pattern: /\bfootwear?s?\b/i, subType: "footwear" },
  { pattern: /\b(heel|shoe|sandal)s?\b/i, subType: "footwear" },
  { pattern: /\bhandbag?s?\b/i, subType: "handbag" },
  { pattern: /\b(clutch|baguette)\b/i, subType: "handbag" },
  { pattern: /\blowerwear?\b/i, subType: "lowerwear" },
  { pattern: /\b(underpant|pant)s?\b/i, subType: "lowerwear" },
  { pattern: /\bupperwear?\b/i, subType: "upperwear" },
  { pattern: /\bupperware?\b/i, subType: "upperwear" },
  { pattern: /\btops?\b/i, subType: "top" },
  { pattern: /\bearring?s?\b/i, subType: "earrings" },
  { pattern: /\bnecklace?s?\b/i, subType: "necklace" },
  { pattern: /\bbracelet?s?\b/i, subType: "bracelet" },
];

function mapAdminKeyword(raw: string | null | undefined) {
  const value = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!value) return "";

  if (ADMIN_KEYWORD_TO_SUB_TYPE[value]) return ADMIN_KEYWORD_TO_SUB_TYPE[value];

  const underscored = value.replace(/\s+/g, "_");
  if (ADMIN_KEYWORD_TO_SUB_TYPE[underscored]) return ADMIN_KEYWORD_TO_SUB_TYPE[underscored];

  const normalized = normalizeSubType(value);
  if ((VTO_PIECE_TYPES as readonly string[]).includes(normalized)) return normalized;

  for (const [keyword, subType] of Object.entries(ADMIN_KEYWORD_TO_SUB_TYPE)) {
    if (value.includes(keyword)) return subType;
  }

  return "";
}

function inferFromTitleAndHandle(title: string, handle: string) {
  const text = `${title} ${handle.replace(/-/g, " ")}`;
  for (const rule of TITLE_KEYWORD_RULES) {
    if (rule.pattern.test(text)) return rule.subType;
  }
  return "";
}

type CatalogProductNode = Awaited<ReturnType<typeof listCatalogProductsWithMedia>>[number];

function inferCatalogSubType(product: CatalogProductNode) {
  const fromMetafield = normalizeSubType(product.subType?.value);
  if (fromMetafield && fromMetafield !== "default") {
    return mapAdminKeyword(fromMetafield) || fromMetafield;
  }

  const fromProductType = mapAdminKeyword(product.productType);
  if (fromProductType) return fromProductType;

  const fromTitle = inferFromTitleAndHandle(product.title, product.handle);
  if (fromTitle) return fromTitle;

  for (const tag of product.tags || []) {
    const fromTag = mapAdminKeyword(tag);
    if (fromTag) return fromTag;
  }

  return "";
}

function buildSearchText(
  product: CatalogProductNode,
  subType: string,
  slotLabels: string[],
) {
  return [
    product.title,
    product.handle.replace(/-/g, " "),
    product.productType || "",
    ...(product.tags || []),
    product.subType?.value || "",
    subType,
    ...slotLabels,
  ]
    .join(" ")
    .toLowerCase();
}

function slotLabelsForSubType(subType: string) {
  const slot = BUILDER_SLOTS.find((entry) => slotMatchesSubType(entry.sub_type, subType));
  if (!slot) return [subType];
  return [slot.label, slot.sub_type, ...(slot.match as readonly string[])];
}

function expandSearchQuery(raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return [] as string[];

  const tokens = q.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>([q, ...tokens]);

  if (q.includes("upperware") || q.includes("upperwear")) {
    expanded.add("upperwear");
    expanded.add("dress");
    expanded.add("top");
    expanded.add("saree");
    expanded.add("gown");
  }
  if (q.includes("footwear") || q.includes("footware") || q.includes("shoe")) {
    expanded.add("footwear");
    expanded.add("heel");
  }
  if (q.includes("handbag") || q.includes("bag")) {
    expanded.add("handbag");
  }
  if (q.includes("lower")) {
    expanded.add("lowerwear");
  }

  return [...expanded];
}

function buildAdminSearchQuery(raw: string) {
  const needles = expandSearchQuery(raw);
  if (needles.length === 0) return "";
  return needles.map((needle) => `*${needle}*`).join(" OR ");
}

function entryMatchesSearch(entry: CatalogEntry, q: string) {
  const needles = expandSearchQuery(q);
  if (needles.length === 0) return true;
  return needles.some(
    (needle) => entry.search_text.includes(needle) || entry.title.toLowerCase().includes(needle),
  );
}

function slotMatchesSubType(slotSubType: string, itemSubType: string) {
  if (!itemSubType) return false;
  const slot = BUILDER_SLOTS.find((entry) => entry.sub_type === slotSubType);
  if (!slot) return slotSubType === itemSubType;
  return (slot.match as readonly string[]).includes(itemSubType);
}

function flattenCatalogEntries(
  products: Awaited<ReturnType<typeof listCatalogProductsWithMedia>>,
): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  const seenProducts = new Set<string>();

  for (const product of products) {
    if (seenProducts.has(product.id)) continue;

    const subType = inferCatalogSubType(product);
    const labels = slotLabelsForSubType(subType);

    let imageUrl = product.featuredImage?.url || "";
    if (!imageUrl) {
      for (const node of product.media?.nodes || []) {
        if (node.mediaContentType === "IMAGE" && node.image?.url) {
          imageUrl = node.image.url;
          break;
        }
      }
    }
    if (!imageUrl) continue;

    seenProducts.add(product.id);
    entries.push({
      item_image_url: imageUrl,
      sub_type: subType || "default",
      title: product.title,
      product_id: product.id,
      handle: product.handle,
      product_type: product.productType || "",
      tags: [...(product.tags || [])],
      search_text: buildSearchText(product, subType, labels),
    });
  }

  return entries;
}

export async function fetchCatalogBySlot(
  admin: AdminGraphql,
  options: {
    slot: string;
    page?: number;
    limit?: number;
    q?: string;
  },
) {
  const slot = normalizeSubType(options.slot) || "default";
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(48, Math.max(1, options.limit ?? 24));
  const q = options.q?.trim().toLowerCase() || "";

  const products = await listCatalogProductsWithMedia(admin, {
    limit: 250,
    searchQuery: q ? buildAdminSearchQuery(q) : undefined,
  });
  const allEntries = flattenCatalogEntries(products);

  let entries = allEntries;

  if (q) {
    entries = allEntries.filter((entry) => entryMatchesSearch(entry, q));
  }

  entries.sort((a, b) => {
    const aSlot = slot && slot !== "default" && slotMatchesSubType(slot, a.sub_type) ? 0 : 1;
    const bSlot = slot && slot !== "default" && slotMatchesSubType(slot, b.sub_type) ? 0 : 1;
    if (aSlot !== bSlot) return aSlot - bSlot;
    return a.title.localeCompare(b.title);
  });

  const total = entries.length;
  const start = (page - 1) * limit;
  const items = entries.slice(start, start + limit);

  return {
    items,
    total,
    page,
    limit,
    has_more: start + limit < total,
    slot,
    facets: BUILDER_SLOTS.map((entry) => ({
      sub_type: entry.sub_type,
      label: entry.label,
    })),
  };
}
