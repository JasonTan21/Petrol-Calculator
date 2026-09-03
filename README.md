# Petrol Claim Tracker

A friendly Malaysia RON95 petrol calculator for recording petrol payments and preparing company claim figures.

The app lets a user sign in with only their name, keeps a RM300 starting balance, records petrol payments by date, and calculates litres, subsidised value, current RON95 pump value, remaining balance, and subsidy difference.

## Features

- Name-based login with a remembered last profile
- RM300 initial company balance
- Add petrol payments for a selected date
- Choose the price paid at: BUDI95, pump price, or SKPS
- Edit, delete, and reset payment records
- Payment preview before saving
- Records saved in the browser with optional Apache/PHP server storage
- Current RON95 price refresh from Malaysia's official OpenDOSM fuel price API
- Verified fallback prices included when the API is unavailable
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
