# Dev store setup (fix themeCreate 401)

If `shopify app dev` fails with:

```
GraphQL Error (Code: 401): [API] Service is not valid for authentication
... themeCreate ...
```

the CLI could not create a host theme. Fix it once in the **browser** (no theme CLI needed):

## 1. Add Dawn theme to the dev store

1. [partners.shopify.com](https://partners.shopify.com) → **Stores** → **tryitout-dev** → **Log in**
2. **Online Store** → **Themes**
3. **Add theme** → **Try with free theme** → **Dawn** → **Add**
4. (Optional) **Publish** Dawn, or leave it as an unpublished theme named **Dawn**

## 2. Fresh CLI login

```bash
cd /Users/tanmaydikshit/myaiira/tryitout
nvm use 20
npx shopify auth logout
npm run dev
```

Complete browser login when prompted. Use the **storefront password** from
**Online Store → Preferences → Password protection** (or disable protection).

## 3. Use the Dawn host theme

`npm run dev` already passes `--theme Dawn` so the CLI reuses Dawn instead of
calling `themeCreate`.

If your theme has a different name, run:

```bash
npx shopify app dev -s tryitout-dev.myshopify.com --theme "Your Theme Name"
```

## 4. Admin-only dev (skip theme extension preview)

If theme APIs still fail but you only need the embedded admin UI:

```bash
npm run dev:admin
```

## 5. Still failing?

Create a **new** development store under your Partner account (you as owner), then:

```bash
npx shopify app dev -s YOUR-NEW-STORE.myshopify.com --theme Dawn
```

Invited org members sometimes lack theme API access on stores they did not create.
