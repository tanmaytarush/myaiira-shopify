# Dev store setup

## Error: `Could not find or create a host theme for theme app extensions`

Your store has **Horizon** (not Dawn). The dev script now uses Horizon theme ID `189132800281`.

### Fix (run once in your terminal)

```bash
cd /Users/tanmaydikshit/myaiira/tryitout
nvm use 20
npm run setup:theme-host
```

This pulls Horizon locally and creates a **development** host theme on the store.

Then:

```bash
npm run dev
```

Enter the **storefront password** when prompted (from **Online Store → Preferences → Password protection**, or disable protection).

### If setup:theme-host fails

Use admin-only dev (no theme extension hot-reload):

```bash
npm run dev:admin
```

You can still add the **Virtual Try-On** block manually in **Online Store → Themes → Customize** on Horizon.

### Themes on tryitout-dev

| Name | Role | ID |
|------|------|-----|
| test-data | live | 189132833049 |
| Horizon | unpublished | **189132800281** ← dev script uses this |
| App Ext Host | unpublished | 189665607961 |

### Other errors

**themeCreate 401** — run `npx shopify auth logout`, then `npm run dev` and log in again.

**No Dawn** — do not use `--theme Dawn`; use Horizon ID above or run `setup:theme-host`.

## End-to-end try-on (local Remix, live Shopify storefront)

**Root cause of `Job submit failed (404)`:** the Shopify CLI was not starting Remix because `shopify.web.toml` was missing (only `shopify.web.toml.liquid` existed). Without Remix, App Proxy kept forwarding to `ai.talentool.in`, which does not have the VTO POST route yet.

Default `npm run dev` keeps the app proxy on **production** when using `shopify.app.toml` alone. Use the local config below.

### 1. Stop the current dev server

Press `q` in the terminal running `npm run dev` (must fully quit — port 9293 must be free).

### 2. Start storefront-local dev

```bash
cd /Users/tanmaydikshit/myaiira/tryitout
nvm use 20
npm run dev
```

Uses `shopify.app.local.toml` (tunnel + local app proxy). Remix uses **port 3010** (`PORT=3010`) so it does not conflict with other apps on 3000.

**Do not use `--localhost-port`** — that enables localhost-only mode, which breaks App Proxy (try-on POST).

If port 3010 is in use: `lsof -i :3010` and stop that process.

### 3. Confirm the proxy points at your tunnel

In the dev terminal, look for lines like:

```text
remix      │ …
app_proxy  │ Using URL: https://<something>.trycloudflare.com/apps/myaiira
```

You must see a **`remix`** process starting (via `shopify.web.toml`). If you only see `vto-widget` and `app_proxy` pointing at `ai.talentool.in`, Remix is not running.

If you still see `ai.talentool.in` or `shopify.dev/apps/default-app-home`, stop and restart `dev:storefront`.

### 4. Run the shopper flow

1. Open https://tryitout-dev.myshopify.com/products/chick-minimal (password: `detoh`)
2. Click **Try this look**
3. Upload a person photo (JPG/PNG)
4. Wait ~5 seconds — mock backend returns the product image as the result
5. In DevTools → Network, confirm:
   - `POST /apps/myaiira/vto/jobs` → **202** with `{ job_id, status }`
   - `GET /apps/myaiira/vto/jobs/<id>` → **200** until `status: "completed"`

Mock mode is used when `MYAIIRA_API_BASE` and `MYAIIRA_API_KEY` are unset in `.env`.

### 5. When finished testing

While `dev:storefront` is running, Partner Dashboard URLs point at the tunnel. After you quit dev, restore production URLs with:

```bash
npm run deploy
```

That pushes `shopify.app.toml` (`ai.talentool.in`, fixed proxy) back to Shopify.
