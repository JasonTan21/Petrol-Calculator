const DEFAULT_INITIAL_BALANCE = 300;
// Basic BUDI95 entitlement was restored to 300 L/month on 2026-09-01.
// This tracks only receipts entered here. It is NOT the official MyKad balance.
const BUDI95_MONTHLY_LITRE_CAP = 300;
const BALANCE_STORAGE_PREFIX = "petrol-claim-tracker:starting-balance:";
const FUEL_PRICE_CACHE_KEY = "petrol-claim-tracker:last-official-prices";
// This Cloudflare Workers deployment uses browser-only records. No unauthenticated PHP API.
const SERVER_STORAGE_ENABLED = false;
const STORAGE_PREFIX = "petrol-claim-tracker:";
const API_URL = "./api.php";
const LAST_USER_KEY = "petrol-claim-tracker:last-user";

const FALLBACK_PRICES = {
  pump: 3.82,
  budi95: 1.99,
  skps: 2.05,
  date: "2026-08-27",
  source: "MOF/OpenDOSM fallback",
};

const PRICE_API =
  "https://api.data.gov.my/data-catalogue?id=fuelprice&limit=5&sort=-date";

const state = {
  userName: "",
  initialBalance: DEFAULT_INITIAL_BALANCE,
  prices: { ...FALLBACK_PRICES },
  records: [],
};

const els = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  nameInput: document.querySelector("#nameInput"),
  welcomeTitle: document.querySelector("#welcomeTitle"),
  priceStatus: document.querySelector("#priceStatus"),
  saveStatus: document.querySelector("#saveStatus"),
  loginPumpPrice: document.querySelector("#loginPumpPrice"),
  loginSubsidyPrice: document.querySelector("#loginSubsidyPrice"),
  loginSKPSPrice: document.querySelector("#loginSKPSPrice"),
  refreshPricesBtn: document.querySelector("#refreshPricesBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),

  entryForm: document.querySelector("#entryForm"),
  entryFormTitle: document.querySelector("#entryFormTitle"),
  editingId: document.querySelector("#editingId"),
  dateInput: document.querySelector("#dateInput"),
  dateDisplay: document.querySelector("#dateDisplay"),
  amountInput: document.querySelector("#amountInput"),
  entryError: document.querySelector("#entryError"),
  paymentPreview: document.querySelector("#paymentPreview"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),

  recordsBody: document.querySelector("#recordsBody"),
  emptyState: document.querySelector("#emptyState"),
  recordCount: document.querySelector("#recordCount"),
  resetBtn: document.querySelector("#resetBtn"),

  initialBalance: document.querySelector("#initialBalance"),
  budiQuotaMonth: document.querySelector("#budiQuotaMonth"),
  budiQuotaLimit: document.querySelector("#budiQuotaLimit"),
  budiQuotaUsed: document.querySelector("#budiQuotaUsed"),
  budiQuotaRemaining: document.querySelector("#budiQuotaRemaining"),
  budiQuotaMeter: document.querySelector("#budiQuotaMeter"),
  budiQuotaFill: document.querySelector("#budiQuotaFill"),
  budiQuotaNote: document.querySelector("#budiQuotaNote"),
  balanceInput: document.querySelector("#balanceInput"),
  saveBalanceBtn: document.querySelector("#saveBalanceBtn"),
  balanceStatus: document.querySelector("#balanceStatus"),
  initialEntitlement: document.querySelector("#initialEntitlement"),
  pumpRemaining: document.querySelector("#pumpRemaining"),
  pumpBasisNote: document.querySelector("#pumpBasisNote"),
  companyPriceMath: document.querySelector("#companyPriceMath"),
  claimAmount: document.querySelector("#claimAmount"),
  subsidyDifference: document.querySelector("#subsidyDifference"),
};

function money(value) {
  const n = Number(value);
  return `RM${(Number.isFinite(n) ? n : 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function litres(value) {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} L`;
}

function pricePerLitre(value) {
  return `${money(value)}/L`;
}

function storageKey(name = state.userName) {
  return `${STORAGE_PREFIX}${name.trim().toLowerCase()}`;
}

function balanceStorageKey(name) {
  return `${BALANCE_STORAGE_PREFIX}${name.trim().toLowerCase()}`;
}

function readInitialBalance(name) {
  try {
    const raw = localStorage.getItem(balanceStorageKey(name));
    if (raw === null) return DEFAULT_INITIAL_BALANCE;
    const amount = Number(raw);
    if (Number.isFinite(amount) && amount >= 0 && amount <= 100000) return amount;
  } catch (error) {
    console.warn("Unable to load starting balance:", error);
  }
  return DEFAULT_INITIAL_BALANCE;
}

function persistInitialBalance(name, amount) {
  try {
    localStorage.setItem(balanceStorageKey(name), amount.toFixed(2));
    return true;
  } catch (error) {
    console.warn("Unable to save starting balance:", error);
    return false;
  }
}

function validFuelPrices(record) {
  if (!record || typeof record !== "object") return null;
  const pump = Number(record.ron95 ?? record.pump);
  const budi95 = Number(record.ron95_budi95 ?? record.budi95);
  const skps = Number(record.ron95_skps ?? record.skps);
  const date = String(record.date || "");
  if (![pump, budi95, skps].every((n) => Number.isFinite(n) && n > 0 && n < 20)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return null;
  return { pump, budi95, skps, date, source: "OpenDOSM official API" };
}

function readCachedFuelPrices() {
  try {
    const raw = localStorage.getItem(FUEL_PRICE_CACHE_KEY);
    return raw ? validFuelPrices(JSON.parse(raw)) : null;
  } catch (error) {
    return null;
  }
}

function cacheFuelPrices(prices) {
  try {
    localStorage.setItem(FUEL_PRICE_CACHE_KEY, JSON.stringify(prices));
  } catch (error) {
    console.warn("Could not cache fuel prices:", error);
  }
}

function priceSummary(prices) {
  return `RON95 ${money(prices.pump)}/L · BUDI95 ${money(prices.budi95)}/L · SKPS ${money(prices.skps)}/L`;
}

function budiMonthlyLimit(isoDate) {
  const month = String(isoDate || "").slice(0, 7);
  // Historical MOF reduction applied 1 Apr to 31 Aug 2026.
  return month >= "2026-04" && month <= "2026-08" ? 200 : BUDI95_MONTHLY_LITRE_CAP;
}

function budiLitresForRecord(record) {
  if (!record || record.rateType !== "budi95") return 0;
  const amount = Number(record.amount);
  const snapshotRate = Number(record.paidPricePerLitre);
  const paidRate = Number.isFinite(snapshotRate) && snapshotRate > 0
    ? snapshotRate : state.prices.budi95;
  return Number.isFinite(amount) && amount > 0 && paidRate > 0
    ? amount / paidRate : 0;
}

function loggedBudiLitresForMonth(month, records = state.records) {
  return records.reduce((total, record) => {
    return String(record.date || "").slice(0, 7) === month
      ? total + budiLitresForRecord(record) : total;
  }, 0);
}

function budiMonthLabel(month) {
  const parts = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(parts[0], parts[1] - 1, 1)));
}

function renderBudiQuota() {
  if (!els.budiQuotaRemaining) return;
  const month = today().slice(0, 7);
  const limit = budiMonthlyLimit(month);
  const used = loggedBudiLitresForMonth(month);
  const remaining = Math.max(0, limit - used);
  const overLimit = used > limit + 0.001;
  els.budiQuotaMonth.textContent = budiMonthLabel(month);
  els.budiQuotaLimit.textContent = `${limit} L`;
  els.budiQuotaUsed.textContent = litres(used);
  els.budiQuotaRemaining.textContent = litres(remaining);
  els.budiQuotaRemaining.classList.toggle("negative", overLimit);
  els.budiQuotaFill.style.width = `${Math.min(100, Math.max(0, used / limit * 100))}%`;
  els.budiQuotaMeter.setAttribute("aria-valuemax", String(limit));
  els.budiQuotaMeter.setAttribute("aria-valuenow", String(Math.min(limit, Math.round(used * 100) / 100)));
  const hasLegacy = state.records.some((record) =>
    record.rateType === "budi95" && String(record.date || "").startsWith(month) &&
    !(Number(record.paidPricePerLitre) > 0));
  els.budiQuotaNote.textContent = overLimit
    ? "Logged BUDI95 receipts exceed the basic monthly limit. Check eligibility and actual pump transactions."
    : hasLegacy
      ? "Estimated from this browser's BUDI95 receipts; older entries use the currently shown price. Not an official quota balance."
      : "Estimated from BUDI95 receipts saved in this browser only, not the government's actual entitlement balance.";
}

function chosenPaymentRate() {
  const selectedType = getPaidRate();
  const editingId = els.editingId?.value || "";
  const existing = editingId ? state.records.find((record) => record.id === editingId) : null;
  if (existing && existing.rateType === selectedType &&
      Number(existing.paidPricePerLitre) > 0) {
    return Number(existing.paidPricePerLitre);
  }
  return state.prices[selectedType] || state.prices.budi95;
}

function today() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function updateDateDisplay() {
  if (!els.dateDisplay || !els.dateInput) return;
  const iso = els.dateInput.value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    els.dateDisplay.textContent = "Select payment date";
    return;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  els.dateDisplay.textContent = new Intl.DateTimeFormat("en-MY", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
  }).format(date);
}

function getPaidRate() {
  return document.querySelector('input[name="paidRate"]:checked')?.value || "budi95";
}

function setPaidRate(value) {
  const input = document.querySelector(`input[name="paidRate"][value="${value}"]`);
  if (input) input.checked = true;
}

function createRecordId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSavedRecord(record, index) {
  if (!record || typeof record !== "object") return null;

  const amount = Number(record.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const rateType = ["budi95", "pump", "skps"].includes(record.rateType)
    ? record.rateType
    : "budi95";

  const cleanDate =
    typeof record.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.date)
      ? record.date
      : today();

  return {
    id: record.id || `${cleanDate}-${amount}-${index}`,
    date: cleanDate,
    amount: Math.round(amount * 100) / 100,
    rateType,
    // For NEW receipts, preserve the rate at the time of logging.
    // Legacy receipts have no saved price and remain approximate.
    paidPricePerLitre: Number.isFinite(Number(record.paidPricePerLitre)) &&
      Number(record.paidPricePerLitre) > 0 && Number(record.paidPricePerLitre) < 20
        ? Number(record.paidPricePerLitre) : null,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || null,
  };
}

/* ---------- Local browser storage ---------- */

function readLocalProfile(name) {
  try {
    const raw = localStorage.getItem(storageKey(name));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.records)) return [];

    return parsed.records.map(normalizeSavedRecord).filter(Boolean);
  } catch (error) {
    console.warn("Unable to read local storage:", error);
    return [];
  }
}

function saveLocalProfile() {
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({
        userName: state.userName,
        records: state.records,
        updatedAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch (error) {
    console.warn("Unable to save local storage:", error);
    return false;
  }
}

/* ---------- Optional Apache/PHP server storage ---------- */

async function serverRequest(action, extra = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      action,
      userName: state.userName,
      ...extra,
    }),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "Server save failed.");
  }
  return data;
}

async function loadServerProfile() {
  if (!SERVER_STORAGE_ENABLED) return false;
  try {
    const data = await serverRequest("load");
    if (!Array.isArray(data.records)) return false;

    state.records = data.records.map(normalizeSavedRecord).filter(Boolean);
    saveLocalProfile();

    els.saveStatus.textContent =
      `Records loaded from server (${state.records.length}).`;
    els.saveStatus.className = "save-status success";
    return true;
  } catch (error) {
    console.warn("Server profile unavailable:", error);
    return false;
  }
}

async function syncRecordsToServer() {
  if (!SERVER_STORAGE_ENABLED) {
    const saved = saveLocalProfile();
    els.saveStatus.textContent = saved
      ? "Payment records saved in this browser."
      : "Could not save locally. Check browser storage settings.";
    els.saveStatus.className = saved ? "save-status success" : "save-status error";
    return saved;
  }
  try {
    await serverRequest("saveAll", { records: state.records });
    els.saveStatus.textContent = "Payment records saved on server.";
    els.saveStatus.className = "save-status success";
    return true;
  } catch (error) {
    const localOk = saveLocalProfile();
    els.saveStatus.textContent = localOk
      ? "Server save unavailable — record is saved in this browser."
      : `Unable to save record: ${error.message}`;
    els.saveStatus.className = localOk
      ? "save-status warning"
      : "save-status error";
    return false;
  }
}

/* ---------- Fuel price refresh: kept from your original feature ---------- */

function normalizePriceRecord(record) {
  const prices = validFuelPrices(record);
  if (!prices) throw new Error("Price service returned invalid or incomplete fuel prices.");
  return prices;
}

async function refreshPrices(showSuccess = false) {
  els.priceStatus.textContent = "Checking latest published official fuel prices...";
  if (els.refreshPricesBtn) els.refreshPricesBtn.disabled = true;
  try {
    const response = await fetch(PRICE_API, { cache: "no-store" });
    if (!response.ok) throw new Error(`Fuel price service returned HTTP ${response.status}.`);
    const json = await response.json();
    const records = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    const valid = records.map(validFuelPrices).filter(Boolean).sort((a,b) => b.date.localeCompare(a.date));
    if (!valid.length) throw new Error("No complete fuel price record returned.");

    const newest = valid[0];
    const cached = readCachedFuelPrices();
    // Protect against an out-of-date API response replacing a newer saved record.
    const prices = cached && cached.date > newest.date ? cached : newest;
    state.prices = prices;
    cacheFuelPrices(prices);
    updatePriceLabels();
    const prefix = prices.date > newest.date
      ? "The API returned older data; retained newer cached official prices."
      : (showSuccess ? "Prices refreshed. " : "");
    els.priceStatus.textContent = `${prefix} Official rates effective ${prices.date}: ${priceSummary(prices)}.`;
  } catch (error) {
    console.warn("Official price refresh unavailable:", error);
    const cached = readCachedFuelPrices();
    if (cached) {
      state.prices = cached;
      els.priceStatus.textContent = `Could not refresh; using saved official rates effective ${cached.date}: ${priceSummary(cached)}.`;
    } else {
      // Do not call the 2026-08-27 fallback rates current or verified today.
      state.prices = { ...FALLBACK_PRICES };
      els.priceStatus.textContent = `Live price refresh unavailable. Using OLD fallback rates dated ${FALLBACK_PRICES.date}: ${priceSummary(state.prices)}. Check official prices before claiming.`;
    }
    updatePriceLabels();
  } finally {
    if (els.refreshPricesBtn) els.refreshPricesBtn.disabled = false;
    render();
  }
}

function updatePriceLabels() {
  els.loginPumpPrice.textContent = `${money(state.prices.pump)}/L`;
  els.loginSubsidyPrice.textContent = `${money(state.prices.budi95)}/L`;
  if (els.loginSKPSPrice) els.loginSKPSPrice.textContent = `${money(state.prices.skps)}/L`;
}

/* ---------- Calculations ---------- */

function rateLabel(rateType) {
  return {
    pump: "Pump",
    budi95: "BUDI95",
    skps: "SKPS",
  }[rateType] || "BUDI95";
}

function recordMath(record) {
  const snapshotRate = Number(record.paidPricePerLitre);
  const paidRate = Number.isFinite(snapshotRate) && snapshotRate > 0
    ? snapshotRate : (state.prices[record.rateType] || state.prices.budi95);
  const amount = Number(record.amount) || 0;
  const volume = paidRate > 0 ? amount / paidRate : 0;

  const pumpValue = volume * state.prices.pump;
  const subsidyValue = volume * state.prices.budi95;

  return {
    paidRate,
    volume,
    pumpValue,
    subsidyValue,
    subsidyDifference: Math.max(0, pumpValue - subsidyValue),
  };
}

function totals(records = state.records) {
  return records.reduce(
    (acc, record) => {
      const calc = recordMath(record);
      acc.paid += Number(record.amount) || 0;
      acc.litres += calc.volume;
      acc.pump += calc.pumpValue;
      acc.subsidy += calc.subsidyValue;
      acc.subsidyDifference += calc.subsidyDifference;
      return acc;
    },
    {
      paid: 0,
      litres: 0,
      pump: 0,
      subsidy: 0,
      subsidyDifference: 0,
    },
  );
}

function balanceSnapshot(records) {
  const total = totals(records);

  const initialLitres =
    state.prices.budi95 > 0
      ? state.initialBalance / state.prices.budi95
      : 0;

  const subsidyRemaining = state.initialBalance - total.subsidy;
  const litresRemaining =
    state.prices.budi95 > 0
      ? subsidyRemaining / state.prices.budi95
      : 0;

  const pumpRemaining =
    Math.max(0, litresRemaining) * state.prices.pump;

  return {
    ...total,
    initialLitres,
    subsidyRemaining,
    litresRemaining,
    pumpRemaining,
  };
}

/* ---------- Rendering ---------- */

function render() {
  if (!state.userName) return;

  els.welcomeTitle.textContent = `Welcome back, ${state.userName}.`;
  els.initialBalance.textContent = money(state.initialBalance);

  const summary = balanceSnapshot(state.records);

  els.initialEntitlement.textContent =
    `${litres(summary.initialLitres)} estimated from company balance at ${pricePerLitre(state.prices.budi95)}`;

  els.pumpRemaining.textContent = money(summary.pumpRemaining);

  els.pumpRemaining.classList.toggle("negative", summary.litresRemaining < 0);

  if (els.pumpBasisNote) {
    els.pumpBasisNote.textContent = `${litres(summary.litresRemaining)} × RON95 ${pricePerLitre(state.prices.pump)}`;
  }
  if (els.companyPriceMath) {
    els.companyPriceMath.textContent = `Est. company litres left = ${money(summary.subsidyRemaining)} remaining company balance ÷ BUDI95 ${pricePerLitre(state.prices.budi95)} = ${litres(summary.litresRemaining)}. Pump-price equivalent uses RON95 ${pricePerLitre(state.prices.pump)}. This is separate from the government 300 L monthly BUDI95 allowance.`;
  }

  els.claimAmount.textContent = money(summary.subsidy);
  els.subsidyDifference.textContent = money(summary.subsidyDifference);

  renderBudiQuota();
  renderRecords();
  updatePaymentPreview();
}

function renderRecords() {
  const chronological = [...state.records].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });

  const snapshots = [];
  const running = [];

  for (const record of chronological) {
    running.push(record);
    snapshots.push({
      record,
      calc: recordMath(record),
      balance: balanceSnapshot(running),
    });
  }

  els.recordsBody.innerHTML = "";
  els.emptyState.classList.toggle("hidden", snapshots.length > 0);

  els.recordCount.textContent =
    snapshots.length === 0
      ? "No entries yet"
      : `${snapshots.length} payment${snapshots.length === 1 ? "" : "s"} saved`;

  snapshots.reverse().forEach(({ record, calc, balance }) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td data-label="Date">${escapeHtml(record.date)}</td>
      <td data-label="Paid">${money(record.amount)} <span class="muted">(${rateLabel(record.rateType)})</span></td>
      <td data-label="RM/L">${pricePerLitre(calc.paidRate)}</td>
      <td data-label="Litres">${litres(calc.volume)}</td>
      <td data-label="Pump value">${money(calc.pumpValue)}</td>
      <td data-label="Subsidised">${money(calc.subsidyValue)}</td>
      <td data-label="Est. company litres left (BUDI95)" class="${balance.litresRemaining < 0 ? "negative" : ""}">
        ${litres(balance.litresRemaining)}
      </td>
      <td data-label="Pump value left">${money(balance.pumpRemaining)}</td>
      <td data-label="Subsidy diff.">${money(calc.subsidyDifference)}</td>
      <td data-label="Actions">
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${escapeHtml(record.id)}">Edit</button>
          <button type="button" data-action="delete" data-id="${escapeHtml(record.id)}">Delete</button>
        </div>
      </td>
    `;

    els.recordsBody.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updatePaymentPreview() {
  const amount = Number(els.amountInput.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    els.paymentPreview.textContent =
      "Enter an amount to preview the litres and remaining balance.";
    return;
  }

  const rateType = getPaidRate();
  const paidRate = chosenPaymentRate();
  const volume = amount / paidRate;
  const subsidyUsed = volume * state.prices.budi95;

  const current = balanceSnapshot(state.records);
  const subsidyLeft = current.subsidyRemaining - subsidyUsed;
  const litresLeft = subsidyLeft / state.prices.budi95;
  const pumpLeft = Math.max(0, litresLeft) * state.prices.pump;

  els.paymentPreview.innerHTML = `
    <b>${money(amount)}</b> at <b>${pricePerLitre(paidRate)}</b>
    = <b>${litres(volume)}</b><br>
    Company allowance used (BUDI95 equivalent): <b>${money(subsidyUsed)}</b><br>
    Company balance left: <b>${money(subsidyLeft)}</b><br>
    Estimated company litres left: <b>${litres(litresLeft)}</b><br>
    Remaining pump-price equivalent: <b>${money(pumpLeft)}</b>.
  `;
  if (rateType === "budi95") {
    const month = String(els.dateInput.value || today()).slice(0, 7);
    const limit = budiMonthlyLimit(month);
    const editingId = els.editingId?.value || "";
    const previous = state.records.filter((record) => record.id !== editingId);
    const estimatedAfter = loggedBudiLitresForMonth(month, previous) + volume;
    const left = Math.max(0, limit - estimatedAfter);
    const note = estimatedAfter > limit + 0.001
      ? "Warning: this would exceed the basic monthly BUDI95 allowance. Confirm your actual entitlement."
      : `Estimated remaining BUDI95 quota for ${budiMonthLabel(month)}: ${litres(left)} of ${limit} L.`;
    const line = document.createElement("p");
    line.className = "budi-preview-note";
    line.textContent = note;
    els.paymentPreview.appendChild(line);
  }
}

/* ---------- Forms ---------- */

function clearEntryForm() {
  els.editingId.value = "";
  els.entryFormTitle.textContent = "Add petrol payment";
  els.dateInput.value = today();
  updateDateDisplay();
  els.amountInput.value = "";
  setPaidRate("budi95");
  els.entryError.textContent = "";
  els.cancelEditBtn.classList.add("hidden");
  els.entryForm.querySelector(".primary-button").textContent = "Save payment";
  updatePaymentPreview();
}

function validateName(value) {
  const clean = value.trim().replace(/\s+/g, " ");

  if (!clean) {
    return { error: "Please enter your name to continue." };
  }

  if (!/^[a-zA-Z0-9 .'-]+$/.test(clean)) {
    return {
      error:
        "Use letters, numbers, spaces, apostrophes, full stops, or hyphens only.",
    };
  }

  return { value: clean };
}

function validateEntry() {
  const date = els.dateInput.value;
  const amount = Number(els.amountInput.value);

  if (!date) {
    return { error: "Please select a payment date." };
  }

  if (Number.isNaN(amount) || amount <= 0) {
    return { error: "Enter an amount greater than RM0.00." };
  }

  if (amount > 1000) {
    return {
      error: "That amount looks too high. Please check the receipt value.",
    };
  }

  return {
    value: {
      date,
      amount: Math.round(amount * 100) / 100,
      rateType: getPaidRate(),
      paidPricePerLitre: chosenPaymentRate(),
    },
  };
}

/* ---------- Events ---------- */

async function enterProfile(userName, options = {}) {
  state.userName = userName;
  state.initialBalance = readInitialBalance(userName);
  if (els.balanceInput) els.balanceInput.value = state.initialBalance.toFixed(2);
  if (els.balanceStatus) els.balanceStatus.textContent = "";
  state.records = readLocalProfile(state.userName);

  els.loginError.textContent = "";
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");

  localStorage.setItem(LAST_USER_KEY, state.userName);
  els.nameInput.value = state.userName;

  clearEntryForm();
  render();

  const loadedFromServer = await loadServerProfile();

  if (loadedFromServer) {
    render();
  } else {
    els.saveStatus.textContent = SERVER_STORAGE_ENABLED
      ? "Using browser records. Server storage will be retried when you save."
      : "Your records are saved in this browser only (no cross-device sync).";
    els.saveStatus.className = SERVER_STORAGE_ENABLED ? "save-status warning" : "save-status";
  }

  if (!options.skipPriceRefresh) {
    refreshPrices();
  }
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const result = validateName(els.nameInput.value);

  if (result.error) {
    els.loginError.textContent = result.error;
    return;
  }

  await enterProfile(result.value);
});

els.saveBalanceBtn?.addEventListener("click", () => {
  const raw = els.balanceInput?.value?.trim() || "";
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value < 0 || value > 100000 || !/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    els.balanceStatus.textContent = "Enter a balance from RM0 to RM100,000, with up to two decimals.";
    return;
  }
  const rounded = Math.round(value * 100) / 100;
  if (!persistInitialBalance(state.userName, rounded)) {
    els.balanceStatus.textContent = "Couldn't save the balance in this browser.";
    return;
  }
  state.initialBalance = rounded;
  els.balanceInput.value = rounded.toFixed(2);
  els.balanceStatus.textContent = `Starting balance saved: ${money(rounded)} (this browser).`;
  render();
});

els.entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const result = validateEntry();

  if (result.error) {
    els.entryError.textContent = result.error;
    return;
  }

  const editingId = els.editingId.value;

  if (editingId) {
    state.records = state.records.map((record) =>
      record.id === editingId
        ? {
            ...record,
            ...result.value,
            updatedAt: new Date().toISOString(),
          }
        : record,
    );
  } else {
    state.records.push({
      id: createRecordId(),
      ...result.value,
      createdAt: new Date().toISOString(),
    });
  }

  /*
    IMPORTANT FIX:
    Render BEFORE storage/network work.
    Even if localStorage or PHP fails, the new payment row appears immediately.
  */
  els.entryError.textContent = "";
  render();

  const localSaved = saveLocalProfile();

  clearEntryForm();

  els.saveStatus.textContent = localSaved
    ? "Payment added. Saving to server..."
    : "Payment added. Browser storage is unavailable; trying server...";

  els.saveStatus.className = localSaved
    ? "save-status"
    : "save-status warning";

  await syncRecordsToServer();
});

els.recordsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const record = state.records.find(
    (item) => item.id === button.dataset.id,
  );

  if (!record) return;

  if (button.dataset.action === "edit") {
    els.editingId.value = record.id;
    els.entryFormTitle.textContent = "Edit petrol payment";
    els.dateInput.value = record.date;
    updateDateDisplay();
    els.amountInput.value = Number(record.amount).toFixed(2);
    setPaidRate(record.rateType);
    els.cancelEditBtn.classList.remove("hidden");
    els.entryForm.querySelector(".primary-button").textContent =
      "Update payment";
    updatePaymentPreview();
    els.amountInput.focus();
    return;
  }

  if (button.dataset.action === "delete") {
    const ok = window.confirm("Delete this petrol payment record?");
    if (!ok) return;

    state.records = state.records.filter(
      (item) => item.id !== record.id,
    );

    render();
    saveLocalProfile();
    await syncRecordsToServer();
  }
});

els.cancelEditBtn.addEventListener("click", clearEntryForm);

els.resetBtn.addEventListener("click", async () => {
  const ok = window.confirm(
    `Reset all petrol records for ${state.userName}?`,
  );

  if (!ok) return;

  state.records = [];
  render();
  saveLocalProfile();
  clearEntryForm();
  await syncRecordsToServer();
});

els.logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(LAST_USER_KEY);
  state.userName = "";
  state.records = [];
  els.nameInput.value = "";
  els.appView.classList.add("hidden");
  els.loginView.classList.remove("hidden");
  els.nameInput.focus();
});

els.refreshPricesBtn.addEventListener("click", () =>
  refreshPrices(true),
);

els.amountInput.addEventListener("input", updatePaymentPreview);

document
  .querySelectorAll('input[name="paidRate"]')
  .forEach((radio) =>
    radio.addEventListener("change", updatePaymentPreview),
  );

els.dateInput.value = today();
updateDateDisplay();
els.dateInput.addEventListener("change", () => {
  updateDateDisplay();
  updatePaymentPreview();
});
els.dateInput.addEventListener("input", updateDateDisplay);
// A real native date input overlays the visible date control. Keep iOS/desktop
// date-picker behaviour, and use showPicker when supported on a direct click.
document.querySelector(".date-picker-shell")?.addEventListener("click", () => {
  if (typeof els.dateInput.showPicker === "function") {
    try { els.dateInput.showPicker(); } catch (_) { /* browser default picker */ }
  }
});
const cachedPrices = readCachedFuelPrices();
if (cachedPrices) state.prices = cachedPrices;
updatePriceLabels();

// Refresh the BUDI95 panel if the current month changes while the app stays open.
let lastBudiQuotaMonth = today().slice(0, 7);
setInterval(() => {
  const thisMonth = today().slice(0, 7);
  if (thisMonth !== lastBudiQuotaMonth) {
    lastBudiQuotaMonth = thisMonth;
    if (state.userName) renderBudiQuota();
  }
}, 60000);

const rememberedUser = localStorage.getItem(LAST_USER_KEY);
if (rememberedUser) {
  els.nameInput.value = rememberedUser;
  enterProfile(rememberedUser);
}
