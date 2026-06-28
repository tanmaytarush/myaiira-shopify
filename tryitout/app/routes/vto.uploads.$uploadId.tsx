import type { LoaderFunctionArgs } from "@remix-run/node";
import { getCachedShopperPhoto } from "../services/vto.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const entry = params.uploadId ? getCachedShopperPhoto(params.uploadId) : null;
  if (!entry) return new Response("Not found", { status: 404 });

  return new Response(entry.body, {
    headers: {
      "Content-Type": entry.mime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
