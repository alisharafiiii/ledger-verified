# ledger secured

privacy-respecting profile attestation for ledger users.
handle in → ledger tap → badge out. nothing public except a lock.

> hardware-anchored identity. one device tap, one badge.

## flow

1. landing page collects an x handle.
2. `POST /api/nonce` mints a unique message: `i am @{handle}, verified by ledger on {date}, nonce: {random}` and stashes the nonce in upstash for ~5 min.
3. **client-side**: the browser uses webhid + the ledger device-management-kit to sign the message via `personal_sign` (eip-191).
4. user taps approve on the device.
5. `POST /api/verify` recovers the signer with viem, burns the nonce, stores `{handle, address, timestamp, nonce}` in upstash.
6. `/verify/[handle]`, `/api/badge/[handle].svg`, and `/api/og/[handle].png` show only `handle + date + lock`. the address and signature are never returned to the public.

## stack

- next.js 14 (app router) + tailwind, ledger orange (`#ff7900`)
- ledger device-management-kit (`@ledgerhq/device-management-kit` + `@ledgerhq/device-signer-kit-ethereum` + `@ledgerhq/device-transport-kit-web-hid`) — runs **fully in the browser**, no backend signer
- upstash redis (rest) for the handle → record map and short-lived nonces
- viem for signature recovery on the server
- `next/og` for png share-card generation
- `unavatar.io` (proxied through `/api/pfp/[handle]`) to embed the user's x avatar in the badge — no x api, no oauth

## browser support

webhid is chromium-only. that means **chrome, edge, brave, arc, opera**. no safari, no firefox, no mobile. the landing page detects this and shows a friendly hint if the user is on an unsupported browser.

## run locally

```bash
cp .env.example .env.local   # fill in upstash creds
npm install
npm run dev                  # http://localhost:3000
```

with your ledger plugged in, unlocked, and the ethereum app open, type a handle and click verify.

### derivation path

defaults to `44'/60'/0'/0/0`. override with `NEXT_PUBLIC_LEDGER_DERIVATION_PATH`.

## routes

| route                      | purpose                                                                 |
|----------------------------|-------------------------------------------------------------------------|
| `/`                        | landing page + verify flow                                              |
| `/verify/[handle]`         | public proof page (handle + date + lock + share buttons + og:image meta) |
| `/api/nonce`               | mint a one-time signing message + stash nonce                           |
| `/api/verify`              | recover signer, burn nonce, store record                                |
| `/api/badge/[handle]`      | terminal-style svg badge (with embedded pfp as base64)                  |
| `/api/og/[handle]`         | 1200×630 png for social-share previews (x, discord, slack…)             |
| `/api/pfp/[handle]`        | proxied x avatar from unavatar.io                                       |

## share kit

every verified badge ships with three actions:

- **download png** — 1200×675, twitter-card-friendly, rendered client-side via `<canvas>`
- **download svg** — vector, sharp at any size, pfp embedded as base64 so it works offline
- **copy image** — copies the png to the clipboard so users can paste straight into a tweet/discord

paste the verify link anywhere and it auto-renders as a card via the og:image meta tags.

## deploy to vercel

one-click, no special config:

1. push the repo to github.
2. import in vercel.
3. set env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_APP_URL` (your prod url, used as the `metadataBase` for og tags), optional `NEXT_PUBLIC_LEDGER_DERIVATION_PATH`.
4. deploy.

vercel only serves the html/js — the actual usb conversation happens in the user's browser, on their machine. nothing native runs server-side.

## privacy rules (enforced in code)

- the recovered address is stored server-side only. it is never returned by `/api/verify`, `/api/badge/[handle]`, `/api/og/[handle]`, or `/verify/[handle]`.
- the raw signature is consumed inside `/api/verify` and never persisted.
- public surfaces (badge svg, og png, verify page) only render `handle + date + opaque serial + lock`.
- the nonce-derived `serial` shows only the last 6 chars of the (already random) nonce — purely cosmetic.
- nonces are single-use and expire after 5 minutes.

## post-mvp todos

- [ ] leaderboard of earliest secured handles (sorted set keyed on `timestamp`)
- [ ] nebulines tier unlock for secured users (gate role assignment on `getVerified(handle)`)
- [ ] nft badge on base (mint sbt to `record.address` on first secure)
- [ ] eip-712 domain pinning to the deployed origin (replay protection across instances)
- [ ] rate-limit `/api/nonce` per ip + per handle
- [ ] safari / firefox fallback (e.g. ledger live deeplink) since webhid is chromium-only
- [ ] light theme variant (`/api/badge/[handle]?theme=light`)
