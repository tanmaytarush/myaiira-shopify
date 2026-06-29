import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireAppProxyAdmin } from "../services/app-proxy-auth.server";
import { fetchCatalogBySlot } from "../services/vto-catalog.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = await requireAppProxyAdmin(request);
  if (!("admin" in auth)) return auth;

  const url = new URL(request.url);
  const slot = url.searchParams.get("slot") || "upperwear";
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Number(url.searchParams.get("limit") || 20);
  const q = url.searchParams.get("q") || undefined;

  try {
    const catalog = await fetchCatalogBySlot(auth.admin, { slot, page, limit, q });
    return json(catalog);
  } catch (error) {
    console.error("Catalog load failed", error);
    return json(
      { error: error instanceof Error ? error.message : "Could not load catalog" },
      { status: 500 },
    );
  }
}
