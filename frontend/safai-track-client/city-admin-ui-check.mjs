import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const evidence = JSON.parse(
  await fs.readFile("../../artifacts/city-admin-e2e.json", "utf8")
);
async function api(path, token, method = "GET", body) {
  const response = await fetch(`http://localhost:5283${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(
    response.ok,
    `${method} ${path}: ${response.status} ${await response.clone().text()}`
  );
  return response.json();
}
const adminPassword =
  process.env.SAFAITRACK_TEST_ADMIN_PASSWORD || "Password123";
const adminToken = (
  await api("/api/auth/city-admin/login", null, "POST", {
    email: "admin@safaitrack.local",
    password: adminPassword,
  })
).token;
const citizenName = `${evidence.fixture} Browser ${Date.now()}`;
const citizenEmail = `${citizenName.replaceAll(" ", "-")}@example.test`;
await api("/api/auth/register", null, "POST", {
  fullName: citizenName,
  email: citizenEmail,
  password: "CityCheck123!",
  role: "Citizen",
  phoneNumber: "01712345678",
  gender: "Female",
  wardId: evidence.browserFixture.wardId,
});
const pendingCitizen = (
  await api("/api/auth/pending-approvals", adminToken)
).find(u => u.email === citizenEmail);
await api(
  `/api/auth/pending-approvals/${pendingCitizen.id}/approve`,
  adminToken,
  "PUT",
  { wardId: evidence.browserFixture.wardId }
);
await api("/api/invoices/generate", adminToken, "POST", {});
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
// Forward to the real isolated API, preserving request bodies and real responses.
// No API data is mocked. The user-facing app remains connected to the working DB.
await context.route("**/api/**", async route => {
  const original = new URL(route.request().url());
  const response = await route.fetch({
    url: `http://localhost:5283${original.pathname}${original.search}`,
    maxRedirects: 0,
  });
  await route.fulfill({ response });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const output = "../../artifacts";
async function screenshot(name) {
  await page.waitForFunction(() =>
    [
      ...document.querySelectorAll(
        ".ca-person,.ca-wage,.auth-form,.auth-visual-copy,.auth-form-wrap > div"
      ),
    ].every(e => Number(getComputedStyle(e).opacity) >= 0.99)
  );
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
await page.goto("http://localhost:3000/login");
await page.getByRole("button", { name: "Toggle role dropdown" }).click();
assert.equal(
  await page
    .locator(".role-dropdown-item")
    .filter({ hasText: "City Admin" })
    .count(),
  0
);
await page.goto("http://localhost:3000/city-admin/login");
await page.getByRole("heading", { name: /City Admin/ }).waitFor();
assert.equal(await page.getByText("Access as", { exact: true }).count(), 0);
assert.equal(await page.getByText("Register here", { exact: true }).count(), 0);
await screenshot("city-admin-login");
await page.locator("#auth-email").fill("admin@safaitrack.local");
await page
  .locator("#auth-password")
  .fill(process.env.SAFAITRACK_TEST_ADMIN_PASSWORD || "Password123");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/admin/dashboard");
for (const [path, title] of [
  ["drivers", "Truck drivers"],
  ["officers", "Ward officers"],
  ["citizens", "Citizens"],
  ["payments-wages", "Payments & wages"],
  ["approvals", "Registration approvals"],
]) {
  await page.goto(`http://localhost:3000/admin/${path}`);
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  if (["drivers", "officers", "citizens"].includes(path)) {
    await page.getByRole("textbox", { name: /Search/ }).fill(evidence.fixture);
    await page.locator(".ca-person").first().waitFor();
  }
  if (path === "payments-wages") {
    const billRow = page.locator("tr").filter({ hasText: citizenName });
    await billRow.getByRole("button", { name: "Send bill" }).click();
    await page
      .getByText("Invoice issued and citizen notified.", { exact: true })
      .waitFor();
  }
  await screenshot(`city-admin-${path}`);
  assert.equal(
    await page.locator(".ws-error").count(),
    0,
    `API error on ${path}`
  );
}
await page.goto("http://localhost:3000/admin/drivers");
await page.getByRole("textbox", { name: /Search/ }).fill(evidence.fixture);
await page.setViewportSize({ width: 390, height: 844 });
await page.locator(".ca-person").first().waitFor();
await screenshot("city-admin-mobile");
assert.ok(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth
  ),
  "New directory overflows mobile viewport"
);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.evaluate(() => localStorage.clear());
await page.goto("http://localhost:3000/login");
await page
  .locator("#auth-email")
  .fill(`${evidence.fixture}-Driver@example.test`);
await page.locator("#auth-password").fill("CityCheck123!");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/driver/dashboard");
await page.getByRole("button", { name: "Notifications", exact: true }).click();
await page
  .getByText("Your daily wages are ready", { exact: true })
  .first()
  .click();
await page.waitForURL("**/driver/wages");
await page.getByRole("heading", { name: "My wages", exact: true }).waitFor();
await page.locator(".ca-wage").first().waitFor();
await page.getByRole("button", { name: "Collect later", exact: true }).click();
await page
  .getByText("Saved for later. Your wage remains available.", { exact: true })
  .waitFor();
await page
  .getByRole("button", { name: "Collect wages now", exact: true })
  .click();
await page.getByText("Wage collected successfully.", { exact: true }).waitFor();
assert.equal(
  (await api("/api/city-admin/wages", adminToken)).find(
    w => w.driverWageId === evidence.browserFixture.wageId
  ).status,
  "Collected"
);
await screenshot("driver-wages");
await page.reload();
await page.getByRole("heading", { name: "My wages", exact: true }).waitFor();
assert.ok(page.url().endsWith("/driver/wages"));
await page.evaluate(() => localStorage.clear());
await page.goto("http://localhost:3000/login");
await page.locator("#auth-email").fill(citizenEmail);
await page.locator("#auth-password").fill("CityCheck123!");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/citizen/dashboard");
await page.getByRole("button", { name: "Notifications", exact: true }).click();
await page.getByText("Your monthly bill is ready", { exact: true }).click();
await page.waitForURL("**/billing");
await page.getByRole("button", { name: "Pay now", exact: true }).click();
await page
  .getByRole("heading", { name: "Simulated payment gateway" })
  .waitFor();
await page
  .getByRole("button", { name: "Approve payment", exact: true })
  .click();
await page.getByRole("heading", { name: "Billing", exact: true }).waitFor();
await page
  .getByText("Payment successful, wait for City Admin confirmation.", {
    exact: true,
  })
  .waitFor();
assert.equal(
  await page.getByRole("button", { name: "Pay now", exact: true }).count(),
  0
);
await screenshot("citizen-payment-awaiting-approval");
await page.evaluate(() => localStorage.clear());
await page.goto("http://localhost:3000/city-admin/login");
await page.locator("#auth-email").fill("admin@safaitrack.local");
await page.locator("#auth-password").fill(adminPassword);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/admin/dashboard");
await page.goto("http://localhost:3000/admin/approvals");
const reviewRow = page.locator("tr").filter({ hasText: citizenName });
await reviewRow.getByRole("button", { name: "Approve", exact: true }).click();
await reviewRow.getByText("Approved", { exact: true }).waitFor();
const confirmedCitizen = (
  await api("/api/city-admin/people/Citizen", adminToken)
).find(u => u.id === pendingCitizen.id);
assert.equal(confirmedCitizen.bills[0].status, "Paid");
await screenshot("city-admin-payment-confirmed");
assert.deepEqual(errors, []);
await fs.writeFile(
  `${output}/city-admin-ui-checks.json`,
  JSON.stringify(
    {
      passed: true,
      checks: [
        "Separate City Admin login",
        "No Admin option in public login",
        "Existing Admin dashboard",
        "All 5 new/extended admin pages",
        "390px responsive directory without overflow",
        "Real notification navigates to driver wages",
        "Wage page survives refresh",
        "Browser wage defer and collect update real ledger",
        "Admin sends bill from browser",
        "Citizen notification opens billing",
        "Existing simulated checkout returns awaiting-confirmation message",
        "Admin approval in browser settles actual invoice",
        "No browser runtime errors",
      ],
    },
    null,
    2
  )
);
await browser.close();
console.log("13 browser checks passed; screenshots saved to artifacts/.");
