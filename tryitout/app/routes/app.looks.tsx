import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { VTO_PIECE_TYPES } from "../constants/vto-piece-types";
import {
  fetchLookConfig,
  fetchProductGalleryMedia,
  listLookCandidates,
  saveLookConfig,
  splitGalleryIntoProducts,
  type LookPiece,
} from "../services/look-metafields.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const lookId = url.searchParams.get("lookId");

  const products = await listLookCandidates(admin);
  const look = lookId ? await fetchLookConfig(admin, lookId) : null;
  const gallery = lookId ? await fetchProductGalleryMedia(admin, lookId) : null;

  return json({
    products,
    look,
    lookId,
    galleryImageCount: gallery?.media.length || 0,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");
  const lookProductId = String(form.get("lookProductId") || "");

  if (!lookProductId) {
    return json({ error: "Select a look product first." }, { status: 400 });
  }

  if (intent === "load") {
    return redirect(`/app/looks?lookId=${encodeURIComponent(lookProductId)}`);
  }

  if (intent === "split-gallery") {
    try {
      const result = await splitGalleryIntoProducts(admin, lookProductId);
      return redirect(
        `/app/looks?lookId=${encodeURIComponent(lookProductId)}&split=${result.createdCount}`,
      );
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Split failed" },
        { status: 400 },
      );
    }
  }

  const pieceProductIds = form.getAll("pieceProductIds[]").map(String);
  const swapPoolProductIds = form.getAll("swapPoolProductIds[]").map(String);
  const pieceSubTypes: Record<string, string> = {};

  for (const [key, value] of form.entries()) {
    const match = key.match(/^pieceSubTypes\[(.+)\]$/);
    if (match) pieceSubTypes[match[1]] = String(value);
  }

  try {
    await saveLookConfig(admin, {
      lookProductId,
      pieceProductIds,
      swapPoolProductIds,
      pieceSubTypes,
    });
    return redirect(`/app/looks?lookId=${encodeURIComponent(lookProductId)}&saved=1`);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 400 },
    );
  }
};

function PieceRow({
  piece,
  subType,
  onSubTypeChange,
  onRemove,
}: {
  piece: LookPiece;
  subType: string;
  onSubTypeChange: (value: string) => void;
  onRemove: () => void;
}) {
  const options = VTO_PIECE_TYPES.map((type) => ({
    label: type.replace(/_/g, " "),
    value: type,
  }));

  return (
    <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
      <InlineStack align="space-between" blockAlign="center" gap="400">
        <InlineStack gap="300" blockAlign="center">
          <Thumbnail
            source={piece.imageUrl || ""}
            alt={piece.title}
            size="small"
          />
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {piece.title}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {piece.handle}
            </Text>
          </BlockStack>
        </InlineStack>
        <InlineStack gap="300" blockAlign="center">
          <div style={{ minWidth: "12rem" }}>
            <Select
              label="Garment slot"
              labelHidden
              options={options}
              value={subType}
              onChange={onSubTypeChange}
            />
          </div>
          <Button tone="critical" variant="plain" onClick={onRemove}>
            Remove
          </Button>
        </InlineStack>
      </InlineStack>
    </Box>
  );
}

export default function LooksPage() {
  const { products, look, lookId, galleryImageCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const isSaving = navigation.state === "submitting";

  const [selectedLookId, setSelectedLookId] = useState(lookId || "");
  const [pieces, setPieces] = useState<LookPiece[]>(look?.pieces || []);
  const [swapPool, setSwapPool] = useState<LookPiece[]>(look?.swapPool || []);
  const [subTypes, setSubTypes] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedLookId(lookId || "");
    setPieces(look?.pieces || []);
    setSwapPool(look?.swapPool || []);
    const next: Record<string, string> = {};
    for (const piece of [...(look?.pieces || []), ...(look?.swapPool || [])]) {
      next[piece.id] = piece.subType || "default";
    }
    setSubTypes(next);
  }, [look, lookId]);

  const lookOptions = useMemo(
    () => [
      { label: "Select a look product…", value: "" },
      ...products.map((product) => ({
        label: product.title,
        value: product.id,
      })),
    ],
    [products],
  );

  const pickProducts = useCallback(async () => {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: pieces.map((piece) => ({ id: piece.id })),
    });
    if (!selection) return;

    const picked: LookPiece[] = selection.map((item) => {
      const image = item.images?.[0] as { originalSrc?: string; url?: string } | undefined;
      return {
        id: item.id,
        title: item.title,
        handle: item.handle,
        imageUrl: image?.originalSrc || image?.url || null,
        subType: subTypes[item.id] || "default",
      };
    });

    setPieces(picked);
    setSubTypes((current) => {
      const next = { ...current };
      for (const piece of picked) {
        if (!next[piece.id]) next[piece.id] = piece.subType || "default";
      }
      return next;
    });
  }, [pieces, shopify, subTypes]);

  const pickSwapPool = useCallback(async () => {
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: swapPool.map((piece) => ({ id: piece.id })),
    });
    if (!selection) return;

    const picked: LookPiece[] = selection.map((item) => {
      const image = item.images?.[0] as { originalSrc?: string; url?: string } | undefined;
      return {
        id: item.id,
        title: item.title,
        handle: item.handle,
        imageUrl: image?.originalSrc || image?.url || null,
        subType: subTypes[item.id] || "default",
      };
    });

    setSwapPool(picked);
    setSubTypes((current) => {
      const next = { ...current };
      for (const piece of picked) {
        if (!next[piece.id]) next[piece.id] = piece.subType || "default";
      }
      return next;
    });
  }, [shopify, subTypes, swapPool]);

  const saved = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("saved") === "1";
  const splitCount = typeof window !== "undefined"
    ? Number(new URLSearchParams(window.location.search).get("split") || 0)
    : 0;

  const canSplitGallery = galleryImageCount >= 2;

  return (
    <Page>
      <TitleBar title="Look builder" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {splitCount > 0 && (
              <Banner tone="success" title="Gallery split complete">
                Created {splitCount} catalog products from gallery images and linked
                them to this look via <code>vto_outfit_products</code>.
              </Banner>
            )}
            {saved && (
              <Banner tone="success" title="Look saved">
                Metafields updated on the look product. Shoppers can mix pieces in
                Try-on → Change Pieces.
              </Banner>
            )}
            {actionData && "error" in actionData && (
              <Banner tone="critical" title="Something went wrong">
                {actionData.error}
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  1. Choose the look product
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  This is the product page shoppers land on (e.g. chick-minimal).
                  Link upperwear, lowerwear, footwear, jewelry, etc. as separate
                  Admin products.
                </Text>
                <Form method="get" action="/app/looks">
                  <InlineStack gap="300" blockAlign="end">
                    <div style={{ flex: 1 }}>
                      <Select
                        label="Look product"
                        options={lookOptions}
                        value={selectedLookId}
                        onChange={setSelectedLookId}
                      />
                      <input type="hidden" name="lookId" value={selectedLookId} />
                    </div>
                    <Button submit disabled={!selectedLookId}>
                      Load
                    </Button>
                  </InlineStack>
                </Form>
              </BlockStack>
            </Card>

            {look && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Split gallery into products
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Creates one Admin product per gallery image on{" "}
                    <strong>{look.title}</strong>, assigns garment slots
                    (upperwear, earrings, bracelet, footwear…), and links them
                    as look pieces. Existing look pieces are replaced; swap pool
                    is kept.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Gallery images found: {galleryImageCount}
                    {canSplitGallery
                      ? " — ready to split."
                      : " — need at least 2 images on the look product."}
                  </Text>
                  <Form method="post">
                    <input type="hidden" name="lookProductId" value={look.productId} />
                    <input type="hidden" name="intent" value="split-gallery" />
                    <Button
                      submit
                      variant="primary"
                      tone="success"
                      loading={isSaving && navigation.formData?.get("intent") === "split-gallery"}
                      disabled={!canSplitGallery}
                    >
                      Split gallery into products
                    </Button>
                  </Form>
                </BlockStack>
              </Card>
            )}

            {look && (
              <Form method="post">
                <input type="hidden" name="lookProductId" value={look.productId} />
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          2. Active look pieces
                        </Text>
                        <Button onClick={pickProducts}>Add / edit pieces</Button>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Default combination shown in virtual try-on. Assign each
                        product a garment slot (upperwear, lowerwear, footwear…).
                      </Text>
                      {pieces.length === 0 ? (
                        <Banner tone="info">
                          No pieces linked yet. Pick catalog products from Admin.
                        </Banner>
                      ) : (
                        <BlockStack gap="200">
                          {pieces.map((piece) => (
                            <div key={piece.id}>
                              <input
                                type="hidden"
                                name="pieceProductIds[]"
                                value={piece.id}
                              />
                              <input
                                type="hidden"
                                name={`pieceSubTypes[${piece.id}]`}
                                value={subTypes[piece.id] || "default"}
                              />
                              <PieceRow
                                piece={piece}
                                subType={subTypes[piece.id] || "default"}
                                onSubTypeChange={(value) =>
                                  setSubTypes((current) => ({
                                    ...current,
                                    [piece.id]: value,
                                  }))
                                }
                                onRemove={() =>
                                  setPieces((current) =>
                                    current.filter((row) => row.id !== piece.id),
                                  )
                                }
                              />
                            </div>
                          ))}
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          3. Swap pool (optional)
                        </Text>
                        <Button onClick={pickSwapPool}>Add / edit swap pool</Button>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Extra catalog products shoppers can swap in by slot —
                        any upperwear with any lowerwear, footwear, bracelet, etc.
                      </Text>
                      {swapPool.length === 0 ? (
                        <Text as="p" variant="bodySm" tone="subdued">
                          No swap pool yet. Add alternatives for each garment type.
                        </Text>
                      ) : (
                        <BlockStack gap="200">
                          {swapPool.map((piece) => (
                            <div key={piece.id}>
                              <input
                                type="hidden"
                                name="swapPoolProductIds[]"
                                value={piece.id}
                              />
                              <input
                                type="hidden"
                                name={`pieceSubTypes[${piece.id}]`}
                                value={subTypes[piece.id] || "default"}
                              />
                              <PieceRow
                                piece={piece}
                                subType={subTypes[piece.id] || "default"}
                                onSubTypeChange={(value) =>
                                  setSubTypes((current) => ({
                                    ...current,
                                    [piece.id]: value,
                                  }))
                                }
                                onRemove={() =>
                                  setSwapPool((current) =>
                                    current.filter((row) => row.id !== piece.id),
                                  )
                                }
                              />
                            </div>
                          ))}
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Card>

                  <InlineStack align="end">
                    <Button variant="primary" submit loading={isSaving}>
                      Save look to Admin
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            )}
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Storefront setup
              </Text>
              <Text as="p" variant="bodyMd">
                After saving, open{" "}
                <strong>Online Store → Customize → Product page → Atelier Look</strong>{" "}
                and connect <strong>Look pieces</strong> to the{" "}
                <strong>VTO look pieces</strong> metafield (dynamic source).
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Metafields: <code>custom.vto_outfit_products</code>,{" "}
                <code>custom.vto_swap_pool</code>,{" "}
                <code>custom.vto_sub_type</code> on each piece.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
