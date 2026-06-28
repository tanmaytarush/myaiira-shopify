/** Garment slots sent to the VTO engine as `sub_type`. */
export const VTO_PIECE_TYPES = [
  "upperwear",
  "lowerwear",
  "footwear",
  "bracelet",
  "handbag",
  "earrings",
  "necklace",
  "dress",
  "top",
  "bottom",
  "saree",
  "kurta",
  "kurti",
  "lehenga",
  "dupatta",
  "blouse",
  "default",
] as const;

export type VtoPieceType = (typeof VTO_PIECE_TYPES)[number];

export const VTO_METAFIELD_NAMESPACE = "custom";

export const VTO_METAFIELDS = {
  lookPieces: "vto_outfit_products",
  swapPool: "vto_swap_pool",
  subType: "vto_sub_type",
} as const;

/** Default garment slot per gallery image index (image 1 = upperwear, etc.). */
export const GALLERY_SPLIT_SLOTS = [
  "upperwear",
  "earrings",
  "necklace",
  "bracelet",
  "handbag",
  "footwear",
  "lowerwear",
  "default",
] as const;

export type GalleryMediaItem = {
  url: string;
  altText: string | null;
};

export type SplitGalleryResult = {
  createdCount: number;
  pieceProductIds: string[];
  pieceSubTypes: Record<string, string>;
};
