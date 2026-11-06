### ⛽️ Petrol Claim Tracker

A responsive Malaysia RON95 petrol-payment calculator for tracking petrol receipts, estimating company claim values, and reviewing BUDI95 usage. Built with HTML, CSS and JavaScript.

**Live:** https://petrol.theusefulhacker.my

## Getting started

1. Open https://petrol.theusefulhacker.my
2. Enter a name to open a browser-local profile. This is **not a secure login**; entering a name does not authenticate an identity.
3. Adjust your starting company balance if needed and click **Save**.
4. Under **Add petrol payment**, choose a payment date, input the amount paid, and select the price type.
5. Save the receipt. The dashboard and **Payment records** update immediately.
6. Use **Edit**, **Delete**, or **Reset user data** as needed. Resetting records can be destructive.
7. Use **Refresh prices** to attempt an update from the published dataset.

## Features

- **Personal starting balance:** Set an initial company balance in RM (default **RM300**) for each name-based browser profile.
- **Payment records:** Add, edit, or delete dated petrol payments, choosing **BUDI95**, **RON95 pump price**, or **SKPS**.
- **Dashboard:** View the starting balance, **Claim this amount**, **Pump-price equivalent**, and **Subsidy difference** without a separate company-claim explanation panel.
- **Estimated company litres left:** See the remaining company balance expressed in litres in each payment record, based on the displayed BUDI95 price.
- **BUDI95 monthly tracker:** Estimate how much of the basic **300 L monthly allowance** has been used based on BUDI95-labelled receipts entered in this browser. This is **not** an official government entitlement or balance lookup.
- **Latest published prices:** Refresh RON95, BUDI95 and SKPS prices through the official OpenDOSM fuel-price dataset. Previously fetched rates are cached for offline/API-error fallback.
- **Responsive design:** Compact desktop summary cards, a mobile-friendly Add petrol payment form with an iPhone date-picker wrapper, and phone-sized payment record cards.
- **Browser-only storage:** Payments and per-user starting balances remain in this browser; they do not sync across devices.

## How the calculations work

The **starting company balance** and the government's **BUDI95 monthly litre allowance** are different things.

| Metric | How it is estimated |
| --- | --- |
| **Initial company balance** | Your editable starting RM amount for the chosen browser profile |
| **Claim this amount** | Total BUDI95-equivalent value of recorded petrol litres (using the current displayed BUDI95 rate) |
| **Estimated company litres left** | (Starting RM balance − BUDI95-equivalent value of recorded litres) ÷ displayed BUDI95 RM/L |
| **Pump-price equivalent** | Estimated company litres left × displayed unsubsidised RON95 pump RM/L (with negative remaining litres capped at zero for this value) |
| **Subsidy difference** | Difference between the pump value and BUDI95-equivalent value of purchased litres |
| **Monthly BUDI95 quota remaining** | Monthly basic litre allowance − BUDI95-labelled litres entered for that calendar month |

**Example:** If your starting company balance is RM200, no payments have been recorded, the displayed BUDI95 rate is RM1.99/L and RON95 pump is RM4.27/L:

- Estimated company litres: RM200 ÷ RM1.99/L ≈ **100.50 L**.
- Pump-price equivalent: (RM200 ÷ RM1.99) × RM4.27 ≈ **RM429.15**.

These are estimated figures, not guaranteed reimbursements or live government balances. Recorded petrol-payment volume is based on the paid RM/L price; new receipts store their paid price for consistent litre calculations. Older records without a stored price may be recalculated using current rates.

## BUDI MADANI RON95

- For eligible users, the basic monthly BUDI95 allowance is **300 L from September 2026**, following the announced restoration from 200 L.
- The tracker uses **200 L** for the historical April–August 2026 months and **300 L** for its other currently supported months, pending future policy changes.
- Only receipts marked **BUDI95** count towards the estimated BUDI95 litres used. Pump-price and SKPS entries do not reduce this tracker.
- The tracker is based solely on entries saved in **this browser**. It does **not** verify eligibility, read MyKad usage, include receipts not entered here, or handle every partial-subsidy scenario.
- The estimated monthly count rolls over with each calendar month; earlier receipts remain in your records.

Official announcement: [Ministry of Finance Malaysia — BUDI95 basic allowance](https://www.mof.gov.my/portal/ms/berita/siaran-media/had-kelayakan-asas-bulanan-budi-madani-dinaikkan-semula-kepada-300-liter-mulai-1-september-2026).

## Fuel price updates

The app requests the latest published weekly data from OpenDOSM using:

```text
https://api.data.gov.my/data-catalogue?id=fuelprice&limit=5&sort=-date
```

The interface shows the effective date and fetched rates. **Refresh prices** does not guarantee a change every day because fuel prices are published periodically.

If the API is unavailable, the app uses the last successfully cached rates. If none are available, it shows older fallback values from 27 August 2026 to 2 September 2026 with a warning:

- RON95 pump: RM3.82/L
- BUDI95: RM1.99/L
- SKPS: RM2.05/L

**Do not treat fallback prices as current.**

Source: [OpenDOSM Fuel Price Data](https://open.dosm.gov.my/data-catalogue/fuelprice).

### Browser data caution

The live Workers version stores records and starting balances in `localStorage`. Data is specific to the browser/device and can be erased by clearing site data. **Keep your own backups of important claim receipts.** Do not use the name field as a security or access-control boundary.

## Privacy and limitations

- The name field is not an authenticated account.
- Records do not synchronize between devices.
- The BUDI95 quota is an **estimate based only on logged transactions**; it is not a government statement.
- Company claims and remaining litres are **estimates**, not guaranteed reimbursement amounts.
- Historical payment calculations may differ if an old receipt has no saved paid-price snapshot.

## License

Released under the **CC0 1.0 Universal** public-domain dedication. See [LICENSE](LICENSE).
