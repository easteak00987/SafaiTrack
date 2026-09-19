import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const base = "http://localhost:5281";
const tag = `WorkspaceQA${Date.now()}`;
const password = "Password123";
const sql = statement =>
  execFileSync(
    "sqlcmd",
    [
      "-S",
      "localhost\\SQLEXPRESS",
      "-d",
      "SafaiTrackDb",
      "-E",
      "-I",
      "-b",
      "-h",
      "-1",
      "-W",
      "-Q",
      `SET NOCOUNT ON; ${statement}`,
    ],
    { encoding: "utf8" }
  ).trim();
const accounts = {};
let browser;
let activePage;
let checks = 0;
async function api(path, token, method = "GET", body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  expect(response.status, `${method} ${path}: ${text.slice(0, 180)}`).toBe(
    expected
  );
  checks++;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
async function login(page, account) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email address").fill(accounts[account].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".ws-account")).toContainText(
    accounts[account].name
  );
}
async function navigate(page, path) {
  await page.evaluate(path => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
try {
  const ward = Number(
    sql(
      `INSERT INTO Wards(Name,Description) VALUES('${tag}','Temporary automated test ward'); SELECT SCOPE_IDENTITY();`
    )
  );
  for (const [name, role] of [
    ["citizen", "Citizen"],
    ["other", "Citizen"],
    ["officer", "WardOfficer"],
    ["driver", "Driver"],
    ["secondDriver", "Driver"],
  ]) {
    const email = `${tag}.${name}@safaitrack.local`;
    await api("/api/auth/register", null, "POST", {
      email,
      fullName: `${tag} ${name}`,
      password,
      role: "Citizen",
    });
    sql(
      `UPDATE AspNetUsers SET Role='${role}', WardId=${ward} WHERE Email='${email}';`
    );
    const auth = await api("/api/auth/login", null, "POST", {
      email,
      password,
    });
    const me = await api("/api/auth/me", auth.token);
    accounts[name] = { ...auth, ...me, email, name: `${tag} ${name}` };
  }
  const admin = await api("/api/auth/login", null, "POST", {
    email: "admin@safaitrack.local",
    password,
  });
  const adminProfile = await api("/api/auth/me", admin.token);
  accounts.admin = { ...admin, ...adminProfile, name: adminProfile.fullName };
  await api(
    "/api/auth/register",
    null,
    "POST",
    {
      email: `${tag}.admin@safaitrack.local`,
      fullName: "Escalation test",
      password,
      role: "Admin",
    },
    400
  );
  await api("/api/routes", null, "GET", null, 401);
  await api("/api/routes", accounts.citizen.token, "GET", null, 403);
  await api("/api/trucks", accounts.citizen.token, "GET", null, 403);
  await api("/api/complaints", accounts.driver.token, "GET", null, 403);
  const bins = [];
  for (let i = 0; i < 3; i++)
    bins.push(
      await api(
        "/api/bins",
        admin.token,
        "POST",
        {
          wardId: ward,
          name: `${tag} bin ${i}`,
          latitude: 23.745 + i * 0.003,
          longitude: 90.374 + i * 0.002,
          currentFillPercent: i === 2 ? 20 : 80,
        },
        201
      )
    );
  const truck = await api(
    "/api/trucks",
    admin.token,
    "POST",
    { plateNumber: tag, status: "Available" },
    201
  );
  const complaint = await api(
    "/api/complaints",
    accounts.citizen.token,
    "POST",
    {
      binId: bins[0].binId,
      category: "Overflowing bin",
      description: `${tag} complaint`,
    },
    201
  );
  await api(
    `/api/complaints/${complaint.complaintId}`,
    accounts.other.token,
    "GET",
    null,
    403
  );
  await api(
    `/api/complaints/${complaint.complaintId}/updates`,
    accounts.other.token,
    "GET",
    null,
    403
  );
  const seededOfficer = await api("/api/auth/login", null, "POST", {
    email: "officer08@safaitrack.local",
    password,
  });
  await api(
    `/api/complaints/${complaint.complaintId}`,
    seededOfficer.token,
    "GET",
    null,
    403
  );
  await api(
    `/api/bins/${bins[0].binId}`,
    seededOfficer.token,
    "PUT",
    { currentFillPercent: 10 },
    403
  );
  await api(
    `/api/complaints/${complaint.complaintId}/status`,
    accounts.citizen.token,
    "PUT",
    { status: "InProgress" },
    403
  );
  await api(
    `/api/complaints/${complaint.complaintId}/status`,
    accounts.officer.token,
    "PUT",
    { status: "Resolved" },
    409
  );

  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  activePage = page;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  mkdirSync("test-results", { recursive: true });
  await login(page, "citizen");
  await expect(page.getByRole("navigation")).not.toContainText("Fleet");
  await expect(page.getByRole("navigation")).not.toContainText("routes");
  await navigate(page, "/driver/dashboard");
  await expect(page).toHaveURL(/citizen\/dashboard/);
  await navigate(page, "/operations/routes");
  await expect(page).toHaveURL(/citizen\/dashboard/);
  await page.screenshot({
    path: "test-results/citizen-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Report an issue" })
    .click();
  await page
    .getByLabel("Bin", { exact: true })
    .selectOption(String(bins[1].binId));
  await page
    .getByLabel("Description", { exact: true })
    .fill("Missed pickup reported through the citizen form.");
  await page.getByRole("button", { name: "Submit complaint" }).click();
  await expect(page.locator(".ws-heading .ws-status")).toHaveText("Pending");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goBack();
  await expect(page).toHaveURL(/login/);
  await page.goto("http://localhost:3000/home");
  await expect(page).toHaveURL(/login/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await login(page, "officer");
  await page.getByRole("link", { name: "Complaints", exact: true }).click();
  await page
    .getByRole("link", {
      name: new RegExp(`#${complaint.complaintId} Overflowing`),
    })
    .click();
  await page.getByLabel("Status", { exact: true }).selectOption("InProgress");
  await page
    .getByLabel("Reply to citizen")
    .fill("Collection has been assigned.");
  await page.getByRole("button", { name: "Send update" }).click();
  await expect(
    page.getByText("Collection has been assigned.", { exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: "Dispatch & routes" }).click();
  await page.getByLabel("Ward", { exact: true }).selectOption(String(ward));
  await page
    .getByLabel("Driver", { exact: true })
    .selectOption(accounts.driver.id);
  await page
    .getByLabel("Truck", { exact: true })
    .selectOption(String(truck.truckId));
  await page.getByRole("button", { name: "Generate & assign route" }).click();
  await expect(page).toHaveURL(/operations\/routes\/\d+/);
  const routeId = Number(page.url().split("/").pop());
  await expect(page.locator(".collection-marker")).toHaveCount(3);
  await expect(page.locator(".map-caption")).not.toContainText("Loading", {
    timeout: 18000,
  });
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/officer-route-desktop.png",
    fullPage: true,
  });
  const route = await api(`/api/routes/${routeId}`, accounts.driver.token);
  expect(route.stopsCount).toBe(2);
  await api(
    `/api/routes/${routeId}`,
    accounts.secondDriver.token,
    "GET",
    null,
    404
  );
  await api(`/api/routes/${routeId}`, seededOfficer.token, "GET", null, 404);
  await api(
    `/api/routes/${routeId}/start`,
    accounts.officer.token,
    "PUT",
    null,
    403
  );
  await api(
    `/api/routes/${routeId}/start`,
    accounts.secondDriver.token,
    "PUT",
    null,
    404
  );
  await api(
    `/api/routes/${routeId}/complete`,
    accounts.driver.token,
    "PUT",
    null,
    409
  );
  await api(
    `/api/routes/${routeId}/stops/${route.stops[0].routeStopId}/collect`,
    accounts.driver.token,
    "PUT",
    null,
    409
  );
  await api(
    "/api/routes/generate",
    accounts.officer.token,
    "POST",
    {
      wardId: ward,
      driverId: accounts.driver.id,
      truckId: truck.truckId,
      algorithm: "dijkstra",
    },
    409
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "driver");
  await page.getByRole("link", { name: "My routes", exact: true }).click();
  await page
    .getByRole("link", { name: new RegExp(`Route #${routeId} /`) })
    .click();
  await page.getByRole("button", { name: "Optimize stops" }).click();
  await expect(page.getByRole("button", { name: "Start route" })).toBeEnabled();
  await page.getByRole("button", { name: "Start route" }).click();
  await expect(
    page.getByRole("button", { name: "Collect", exact: true })
  ).toBeVisible();
  await api(
    `/api/routes/${routeId}/complete`,
    accounts.driver.token,
    "PUT",
    null,
    409
  );
  await api(
    `/api/routes/${routeId}/optimize`,
    accounts.driver.token,
    "PUT",
    null,
    409
  );
  await api(
    `/api/routes/${routeId}/stops/${route.stops[1].routeStopId}/collect`,
    accounts.driver.token,
    "PUT",
    null,
    409
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".map-caption")).not.toContainText("Loading", {
    timeout: 18000,
  });
  await page.screenshot({
    path: "test-results/driver-route-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  for (let i = 0; i < route.stopsCount; i++) {
    await page.getByRole("button", { name: "Collect", exact: true }).click();
    await expect(page.locator(".ws-list .ws-status.collected")).toHaveCount(
      i + 1
    );
  }
  await page
    .getByRole("button", { name: "Complete route", exact: true })
    .click();
  await expect(page.locator(".ws-heading .ws-status")).toHaveText("Completed");
  const finished = await api(`/api/routes/${routeId}`, accounts.driver.token);
  expect(finished.status).toBe("Completed");
  expect((await api(`/api/trucks/${truck.truckId}`, admin.token)).status).toBe(
    "Available"
  );
  expect(
    (await api(`/api/bins/${bins[0].binId}`, accounts.officer.token))
      .currentFillPercent
  ).toBe(0);
  await api(
    `/api/complaints/${complaint.complaintId}/status`,
    accounts.officer.token,
    "PUT",
    { status: "Resolved", message: "Collection completed." }
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "citizen");
  await page.getByRole("link", { name: "My complaints", exact: true }).click();
  await page
    .getByRole("link", {
      name: new RegExp(`#${complaint.complaintId} Overflowing`),
    })
    .click();
  await expect(
    page.getByText("Collection completed.", { exact: true })
  ).toBeVisible();
  await expect(page.locator(".ws-heading .ws-status")).toHaveText("Resolved");
  await page.screenshot({
    path: "test-results/citizen-progress-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "admin");
  await page.getByRole("link", { name: "Fleet", exact: true }).click();
  const truckRow = page.locator(".ws-row").filter({ hasText: tag });
  await truckRow.getByRole("button", { name: "Mark maintenance" }).click();
  await expect(truckRow.locator(".ws-status")).toHaveText("Maintenance");
  await truckRow.getByRole("button", { name: "Return to service" }).click();
  await expect(truckRow.locator(".ws-status")).toHaveText("Available");
  await navigate(page, "/citizen/dashboard");
  await expect(page).toHaveURL(/admin\/dashboard/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "driver");
  await page.route("**/route/v1/driving/**", route => route.abort());
  await navigate(page, `/driver/route/${routeId}`);
  await expect(page.locator(".map-caption")).toContainText(
    "Road directions unavailable"
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "citizen");
  await page.route("**/api/complaints", route => route.abort());
  await page.getByRole("link", { name: "My complaints", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot reach the API");
  await page.unroute("**/api/complaints");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByRole("link", {
      name: new RegExp(`#${complaint.complaintId} Overflowing`),
    })
  ).toBeVisible();
  await page.route("**/api/bins", route => route.fulfill({ status: 401 }));
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Report an issue" })
    .click();
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
  console.log(
    `PASS: ${checks} API assertions plus all four role workflows, logout/back, desktop/mobile maps, API failure/retry, expired session and road-service fallback.`
  );
} catch (error) {
  if (activePage) {
    console.log(
      "Failed at",
      activePage.url(),
      await activePage.locator("body").innerText()
    );
    await activePage.screenshot({
      path: "test-results/failure.png",
      fullPage: true,
    });
  }
  throw error;
} finally {
  await browser?.close();
  // Only this run's uniquely named fixtures are removed; existing records are untouched.
  sql(
    `DELETE FROM Routes WHERE WardId IN (SELECT WardId FROM Wards WHERE Name='${tag}'); DELETE FROM Complaints WHERE BinId IN (SELECT BinId FROM Bins WHERE Name LIKE '${tag}%'); DELETE FROM Bins WHERE Name LIKE '${tag}%'; DELETE FROM Trucks WHERE PlateNumber='${tag}'; DELETE FROM AspNetUsers WHERE Email LIKE '${tag}.%@safaitrack.local'; DELETE FROM Wards WHERE Name='${tag}';`
  );
}
