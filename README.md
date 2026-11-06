# Petrol Claim Tracker

A friendly Malaysia RON95 petrol calculator for recording petrol payments and preparing company claim figures.

The app lets a user sign in with only their name, keeps a RM300 starting balance, records petrol payments by date, and calculates litres, subsidised value, current RON95 pump value, remaining balance, and subsidy difference.

## Features

- Name-based login with a remembered last profile
- Per-user adjustable company starting balance (RM300 by default; saved in browser storage)
- Add petrol payments for a selected date
- Choose the price paid at: BUDI95, pump price, or SKPS
- Edit, delete, and reset payment records
- Payment preview before saving
- Records saved in the browser with optional Apache/PHP server storage
- Refresh latest published RON95, BUDI95 and SKPS prices from the official OpenDOSM API (correct `sort=-date` parameter)
- Cache the last successfully fetched official prices, with clear warning when only old fallback values are available
- Responsive layout for desktop, tablet, and phone

## How To Use

1. Open the website.
2. Enter your name, for example `Jason`.
3. Add a petrol payment:
   - Select the payment date.
   - Enter the amount paid in RM.
   - Select whether you paid using BUDI95, pump price, or SKPS.
4. Review the dashboard:
   - `Claim this amount` shows the actual subsidised amount used from the RM300 balance.
   - `Remaining at subsidised price` shows how much of the RM300 subsidised balance is left.
   - `Litres remaining` converts the remaining subsidised balance into litres.
   - `Remaining at pump price` shows the pump-price value of the remaining litres.
   - `Subsidy difference` shows the difference between pump value and subsidised value.
5. Use `Edit` or `Delete` beside any payment record if a receipt was entered wrongly.
6. Use `Reset user data` only when you want to clear all records for the current user.

## Price Data

The app tries to refresh prices from Malaysia's official OpenDOSM fuel price API:

```text
https://api.data.gov.my/data-catalogue?id=fuelprice&limit=1&sort=date:desc
```

If the API cannot be reached, the app uses verified fallback values for 27 Aug 2026 to 2 Sep 2026:

- RON95 pump price: RM3.82/L
- BUDI95: RM1.99/L
- SKPS: RM2.05/L

## Hosting

Upload these files and folders to the same directory on your domain:

```text
index.html
app.js
styles.css
api.php
favicon.svg
server-test.php
data/
```

The app works best on Apache or another PHP-enabled host. If PHP is unavailable, records still save in the user's browser through `localStorage`, but they will not sync across devices.

## Server Storage Setup

The `api.php` file stores user records in the `data/` folder. The folder must be writable by the web server.

To test PHP/server storage, open:

```text
https://YOUR-DOMAIN/server-test.php
```

You should see:

```text
PHP is working
data folder exists: YES
data folder writable: YES
```

If `data folder writable` says `NO`, update the folder permission on the server. On many Linux Apache servers:

```bash
sudo chown -R www-data:www-data data
sudo chmod -R 775 data
```

The repository tracks `data/.gitkeep` and `data/.htaccess`, but ignores saved JSON records so private user claim data is not committed.

## Files

- `index.html` - website structure
- `styles.css` - responsive visual design
- `app.js` - calculator, records, price refresh, browser/server sync
- `api.php` - optional server-side record storage
- `server-test.php` - quick PHP and `data/` folder test
- `favicon.svg` - browser tab icon
- `data/` - server-side record storage folder

## Public Domain

This project is dedicated to the public domain under the CC0 1.0 Universal license. See `LICENSE` for details.

## Cloudflare Workers static-asset deployment

The `petrol.theusefulhacker.my` deployment runs entirely in the browser:

- PHP `api.php` is **not deployed** to Workers.
- Browser payment records and user-specific starting balances are saved in `localStorage`.
- Records are not authenticated and **do not sync across devices**; do not use names as an access-control mechanism.
- The "Refresh prices" button requests the newest weekly published fuel prices from OpenDOSM using `sort=-date`, and caches the last successful response.
- Existing old records may be revalued when fuel prices change because the original app did not store historical prices per payment.
- If the price API is unavailable and no official price was cached previously, the old 2026-08-27 fallback values are displayed with a warning—not as live prices.

Deploy the four static files in `public/` (`index.html`, `app.js`, `styles.css`, and `favicon.svg`).

Source: https://developer.data.gov.my/request-query and https://open.dosm.gov.my/data-catalogue/fuelprice


## BUDI MADANI RON95 monthly quota (November 2026 update)

- Basic BUDI95 allowance for eligible Malaysian users: **300 litres per calendar month**, effective from 1 September 2026 (restored from 200 L).
- Historical April–August 2026 entries use the 200 L monthly basic limit; other tracked months use 300 L until policy changes.
- The app **does not connect to any government BUDI95 account**. It only estimates remaining allowance using **BUDI95-labelled receipts entered in this browser**.
- Pump-price and SKPS purchases are *not* counted as BUDI95 entitlement use.
- Newly entered receipts save the paid RM/L rate to keep litres accurate after refresh; older receipts without a snapshot are estimated using the currently displayed BUDI95 rate.
- The company starting cash balance (RM, editable per user) is **separate** from the 300 L government subsidy allowance.
- The monthly quota display rolls to the new calendar month automatically (old records remain available in history).
- If recorded usage goes over the monthly cap, the app warns the user; it does not claim to verify eligibility, handle partial-subsidy pump transactions or automatically switch prices.

MOF announcement (31 Aug 2026):
https://www.mof.gov.my/portal/ms/berita/siaran-media/had-kelayakan-asas-bulanan-budi-madani-dinaikkan-semula-kepada-300-liter-mulai-1-september-2026

The responsive CSS also aligns mobile dashboard cards, field gaps, navigation buttons, and the monthly BUDI95 panel with consistent spacing.
