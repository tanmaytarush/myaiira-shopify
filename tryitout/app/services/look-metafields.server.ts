import {
  GALLERY_SPLIT_SLOTS,
  VTO_METAFIELD_NAMESPACE,
  VTO_METAFIELDS,
  VTO_PIECE_TYPES,
  type GalleryMediaItem,
  type SplitGalleryResult,
} from "../constants/vto-piece-types";

export type LookPiece = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  subType: string;
};

export type LookConfig = {
  productId: string;
  title: string;
  handle: string;
  pieces: LookPiece[];
  swapPool: LookPiece[];
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
  if (!value) return "default";
  if ((VTO_PIECE_TYPES as readonly string[]).includes(value)) return value;
  return value;
}

function mapProductNode(node: Record<string, unknown>): LookPiece {
  const featuredImage = node.featuredImage as { url?: string } | null | undefined;
  const subTypeField = node.subType as { value?: string } | null | undefined;
  return {
    id: String(node.id),
    title: String(node.title || ""),
    handle: String(node.handle || ""),
    imageUrl: featuredImage?.url || null,
    subType: normalizeSubType(
      subTypeField?.value || (node.productType as string | undefined),
    ),
  };
}

function inferGallerySubType(index: number, altText: string | null | undefined) {
  if (altText?.trim()) {
    const fromAlt = normalizeSubType(altText);
    if (fromAlt !== "default") return fromAlt;
  }
  return GALLERY_SPLIT_SLOTS[index] || "default";
}

function formatSubTypeLabel(subType: string) {
  return subType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchProductGalleryMedia(
  admin: AdminGraphql,
  productId: string,
): Promise<{ title: string; handle: string; vendor: string | null; price: string; media: GalleryMediaItem[] } | null> {
  const response = await admin.graphql(
    `#graphql
      query ProductGallery($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          vendor
          variants(first: 1) {
            nodes { price }
          }
          media(first: 20) {
            nodes {
              mediaContentType
              ... on MediaImage {
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }`,
    { variables: { id: productId } },
  );

  const json = await response.json();
  const product = json.data?.product;
  if (!product) return null;

  const media: GalleryMediaItem[] = (product.media?.nodes || [])
    .filter((node: { mediaContentType?: string }) => node.mediaContentType === "IMAGE")
    .map((node: { image?: { url?: string; altText?: string | null } }) => ({
      url: String(node.image?.url || ""),
      altText: node.image?.altText || null,
    }))
    .filter((item: GalleryMediaItem) => item.url);

  return {
    title: product.title,
    handle: product.handle,
    vendor: product.vendor || null,
    price: product.variants?.nodes?.[0]?.price || "0.00",
    media,
  };
}

async function createPieceProduct(
  admin: AdminGraphql,
  input: {
    title: string;
    subType: string;
    imageUrl: string;
    altText: string | null;
    vendor: string | null;
    price: string;
  },
): Promise<string> {
  const response = await admin.graphql(
    `#graphql
      mutation CreatePieceProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product { id }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        product: {
          title: input.title,
          productType: formatSubTypeLabel(input.subType),
          vendor: input.vendor || undefined,
          status: "ACTIVE",
          metafields: [
            {
              namespace: VTO_METAFIELD_NAMESPACE,
              key: VTO_METAFIELDS.subType,
              type: "single_line_text_field",
              value: normalizeSubType(input.subType),
            },
          ],
        },
        media: [
          {
            originalSource: input.imageUrl,
            alt: input.altText || input.title,
            mediaContentType: "IMAGE",
          },
        ],
      },
    },
  );

  const json = await response.json();
  const userErrors = json.data?.productCreate?.userErrors || [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
  }

  const productId = json.data?.productCreate?.product?.id;
  if (!productId) throw new Error(`Failed to create product "${input.title}"`);

  const variantQuery = await admin.graphql(
    `#graphql
      query PieceVariant($id: ID!) {
        product(id: $id) {
          variants(first: 1) { nodes { id } }
        }
      }`,
    { variables: { id: productId } },
  );
  const variantJson = await variantQuery.json();
  const variantId = variantJson.data?.product?.variants?.nodes?.[0]?.id as
    | string
    | undefined;

  if (variantId) {
    const priceResponse = await admin.graphql(
      `#graphql
        mutation SetPiecePrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { field message }
          }
        }`,
      {
        variables: {
          productId,
          variants: [{ id: variantId, price: input.price }],
        },
      },
    );
    const priceJson = await priceResponse.json();
    const priceErrors = priceJson.data?.productVariantsBulkUpdate?.userErrors || [];
    if (priceErrors.length > 0) {
      throw new Error(
        priceErrors.map((e: { message: string }) => e.message).join(", "),
      );
    }
  }

  return productId;
}

export async function splitGalleryIntoProducts(
  admin: AdminGraphql,
  lookProductId: string,
): Promise<SplitGalleryResult> {
  const source = await fetchProductGalleryMedia(admin, lookProductId);
  if (!source) throw new Error("Look product not found.");
  if (source.media.length < 2) {
    throw new Error(
      "This product needs at least 2 gallery images to split (one per look piece).",
    );
  }

  const pieceProductIds: string[] = [];
  const pieceSubTypes: Record<string, string> = {};

  for (let index = 0; index < source.media.length; index++) {
    const item = source.media[index];
    const subType = inferGallerySubType(index, item.altText);
    const title = `${source.title} — ${formatSubTypeLabel(subType)}`;

    const productId = await createPieceProduct(admin, {
      title,
      subType,
      imageUrl: item.url,
      altText: item.altText,
      vendor: source.vendor,
      price: source.price,
    });

    pieceProductIds.push(productId);
    pieceSubTypes[productId] = subType;
  }

  const existing = await fetchLookConfig(admin, lookProductId);
  const swapPoolIds = existing?.swapPool.map((piece) => piece.id) || [];

  await saveLookConfig(admin, {
    lookProductId,
    pieceProductIds,
    swapPoolProductIds: swapPoolIds,
    pieceSubTypes,
  });

  return {
    createdCount: pieceProductIds.length,
    pieceProductIds,
    pieceSubTypes,
  };
}

export async function fetchLookConfig(
  admin: AdminGraphql,
  productId: string,
): Promise<LookConfig | null> {
  const response = await admin.graphql(
    `#graphql
      query LookConfig($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          lookPieces: metafield(namespace: "${VTO_METAFIELD_NAMESPACE}", key: "${VTO_METAFIELDS.lookPieces}") {
            references(first: 25) {
              nodes {
                ... on Product {
                  id
                  title
                  handle
                  productType
                  featuredImage { url }
                  subType: metafield(namespace: "${VTO_METAFIELD_NAMESPACE}", key: "${VTO_METAFIELDS.subType}") { value }
                }
              }
            }
          }
          swapPool: metafield(namespace: "${VTO_METAFIELD_NAMESPACE}", key: "${VTO_METAFIELDS.swapPool}") {
            references(first: 50) {
              nodes {
                ... on Product {
                  id
                  title
                  handle
                  productType
                  featuredImage { url }
                  subType: metafield(namespace: "${VTO_METAFIELD_NAMESPACE}", key: "${VTO_METAFIELDS.subType}") { value }
                }
              }
            }
          }
        }
      }`,
    { variables: { id: productId } },
  );

  const json = await response.json();
  const product = json.data?.product;
  if (!product) return null;

  const pieces =
    product.lookPieces?.references?.nodes?.map((node: Record<string, unknown>) =>
      mapProductNode(node),
    ) || [];
  const swapPool =
    product.swapPool?.references?.nodes?.map((node: Record<string, unknown>) =>
      mapProductNode(node),
    ) || [];

  return {
    productId: product.id,
    title: product.title,
    handle: product.handle,
    pieces,
    swapPool,
  };
}

export async function listLookCandidates(admin: AdminGraphql, limit = 50) {
  const response = await admin.graphql(
    `#graphql
      query LookCandidates($first: Int!) {
        products(first: $first, sortKey: UPDATED_AT, reverse: true) {
          nodes {
            id
            title
            handle
            featuredImage { url }
          }
        }
      }`,
    { variables: { first: limit } },
  );
  const json = await response.json();
  return (json.data?.products?.nodes || []) as Array<{
    id: string;
    title: string;
    handle: string;
    featuredImage?: { url?: string } | null;
  }>;
}

export async function saveLookConfig(
  admin: AdminGraphql,
  input: {
    lookProductId: string;
    pieceProductIds: string[];
    swapPoolProductIds: string[];
    pieceSubTypes?: Record<string, string>;
  },
) {
  const lookMetafields = [
    {
      ownerId: input.lookProductId,
      namespace: VTO_METAFIELD_NAMESPACE,
      key: VTO_METAFIELDS.lookPieces,
      type: "list.product_reference",
      value: JSON.stringify(input.pieceProductIds),
    },
    {
      ownerId: input.lookProductId,
      namespace: VTO_METAFIELD_NAMESPACE,
      key: VTO_METAFIELDS.swapPool,
      type: "list.product_reference",
      value: JSON.stringify(input.swapPoolProductIds),
    },
  ];

  const pieceMetafields = Object.entries(input.pieceSubTypes || {})
    .filter(([, subType]) => subType.trim())
    .map(([productId, subType]) => ({
      ownerId: productId,
      namespace: VTO_METAFIELD_NAMESPACE,
      key: VTO_METAFIELDS.subType,
      type: "single_line_text_field",
      value: normalizeSubType(subType),
    }));

  const response = await admin.graphql(
    `#graphql
      mutation SaveLookMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        metafields: [...lookMetafields, ...pieceMetafields],
      },
    },
  );

  const json = await response.json();
  const userErrors = json.data?.metafieldsSet?.userErrors || [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
  }
}
