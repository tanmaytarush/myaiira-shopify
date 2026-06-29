import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";

type AppProxyAdmin = NonNullable<
  Awaited<ReturnType<typeof authenticate.public.appProxy>>["admin"]
>;

export async function requireAppProxy(request: Request) {
  try {
    const ctx = await authenticate.public.appProxy(request);
    return { session: ctx.session, admin: ctx.admin };
  } catch (error) {
    console.error("App proxy auth failed", error);
    return json(
      {
        error:
          "App proxy authentication failed. Reinstall the app on this store and confirm SHOPIFY_API_SECRET in .env matches Partner Dashboard (run: npx shopify app env pull).",
      },
      { status: 401 },
    );
  }
}

export async function requireAppProxyAdmin(request: Request) {
  const auth = await requireAppProxy(request);
  if (!("session" in auth)) return auth;

  if (!auth.admin) {
    return json(
      {
        error:
          "App session unavailable. Open the tryitout app once in Shopify Admin → Apps so this store can access the catalog API.",
      },
      { status: 503 },
    );
  }

  return { admin: auth.admin as AppProxyAdmin };
}
