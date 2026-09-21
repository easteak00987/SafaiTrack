import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const tag = `FixAudit${Date.now()}`,
  password = "AuditPass123!",
  a = {},
  proof = { tag };
let browser;
const sql = s =>
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
      "-y",
      "8000",
      "-w",
      "65535",
      "-Q",
      `SET NOCOUNT ON; ${s}`,
    ],
    { encoding: "utf8" }
  ).trim();
const rows = s => JSON.parse(sql(s + " FOR JSON PATH") || "[]");
async function api(path, user, method = "GET", body, status = 200) {
  const r = await fetch("http://localhost:5281" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = await r.text();
  expect(r.status, `${method} ${path}: ${t}`).toBe(status);
  return t ? JSON.parse(t) : null;
}
async function login(page, name) {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email address").fill(a[name].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".ws-account")).toContainText(a[name].fullName);
}
try {
  const ward = Number(
    sql(
      `INSERT Wards(Name,Description) VALUES('${tag}','Isolated audit'); SELECT SCOPE_IDENTITY();`
    )
  );
  for (const [name, role] of [
    ["citizen", "Citizen"],
    ["other", "Citizen"],
    ["officer", "WardOfficer"],
    ["outside", "WardOfficer"],
    ["driver", "Driver"],
    ["admin", "Admin"],
  ]) {
    const email = `${tag}.${name}@safaitrack.local`;
    await api("/api/auth/register", null, "POST", {
      email,
      fullName: `${tag} ${name}`,
      password,
      role: "Citizen",
    });
    sql(
      `UPDATE AspNetUsers SET Role='${role}',WardId=${name === "outside" ? "NULL" : ward} WHERE Email='${email}'`
    );
    const auth = await api("/api/auth/login", null, "POST", {
      email,
      password,
    });
    a[name] = { ...auth, ...(await api("/api/auth/me", auth)), email };
  }
  proof.passwordRejections = [];
  for (const weak of [
    "aA1!",
    "AUDIT123!",
    "audit123!",
    "AuditPass!",
    "AuditPass123",
    "AuditPass123 ",
  ])
    proof.passwordRejections.push({
      password: weak,
      response: await api(
        "/api/auth/register",
        null,
        "POST",
        {
          email: `${tag}.weak@safaitrack.local`,
          fullName: "Weak test",
          password: weak,
          role: "Citizen",
        },
        400
      ),
    });
  const bin = await api(
      "/api/bins",
      a.admin,
      "POST",
      {
        wardId: ward,
        name: tag,
        latitude: 23.745,
        longitude: 90.374,
        currentFillPercent: 80,
      },
      201
    ),
    truck = await api(
      "/api/trucks",
      a.admin,
      "POST",
      { plateNumber: tag, status: "Available" },
      201
    );
  proof.complaintsBefore = await api("/api/complaints", a.officer);
  const c = await api(
      "/api/complaints",
      a.citizen,
      "POST",
      { binId: bin.binId, category: "Overflowing bin", description: tag },
      201
    ),
    cid = c.complaintId;
  proof.officerComplaintsAfter = await api("/api/complaints", a.officer);
  expect(proof.officerComplaintsAfter.some(x => x.complaintId === cid)).toBe(
    true
  );
  proof.outsideWardComplaints = await api("/api/complaints", a.outside);
  expect(proof.outsideWardComplaints.some(x => x.complaintId === cid)).toBe(
    false
  );
  proof.complaintDatabase = rows(
    `SELECT c.ComplaintId,c.CitizenId,c.Status,b.WardId FROM Complaints c JOIN Bins b ON b.BinId=c.BinId WHERE c.ComplaintId=${cid}`
  );
  expect(await api("/api/notifications", a.citizen)).toEqual([]);
  await api(`/api/complaints/${cid}/status`, a.officer, "PUT", {
    status: "InProgress",
    message: "Investigating",
  });
  const ns = await api("/api/notifications", a.citizen),
    nid = ns[0].notificationId;
  expect(ns[0].message).toBe(
    `Your complaint #${cid} status changed to InProgress`
  );
  await api(`/api/notifications/${nid}/read`, a.other, "PUT", null, 404);
  expect(await api("/api/notifications", a.other)).toEqual([]);
  await api("/api/notifications", null, "GET", null, 401);
  proof.notificationBeforeRead = rows(
    `SELECT * FROM Notifications WHERE NotificationId=${nid}`
  );
  await api(`/api/notifications/${nid}/read`, a.citizen, "PUT", null, 204);
  proof.notificationAfterRead = rows(
    `SELECT * FROM Notifications WHERE NotificationId=${nid}`
  );
  expect(proof.notificationAfterRead[0].IsRead).toBe(true);
  await api(`/api/complaints/${cid}/status`, a.officer, "PUT", {
    status: "InProgress",
    message: "Reply only",
  });
  expect((await api("/api/notifications", a.citizen)).length).toBe(1);
  await api(`/api/complaints/${cid}/status`, a.admin, "PUT", {
    status: "Resolved",
  });
  proof.notificationsNewestFirst = await api("/api/notifications", a.citizen);
  expect(proof.notificationsNewestFirst[0].message).toContain("Resolved");
  proof.routesBefore = await api("/api/routes", a.driver);
  const { routeId: rid } = await api(
    "/api/routes/generate",
    a.officer,
    "POST",
    {
      wardId: ward,
      driverId: a.driver.id,
      truckId: truck.truckId,
      algorithm: "nearest_neighbor",
    },
    201
  );
  proof.assignmentDatabase = rows(
    `SELECT RouteId,WardId,TruckId,DriverId,Status FROM Routes WHERE RouteId=${rid}`
  );
  proof.driverRoutes = await api("/api/routes", a.driver);
  expect(
    proof.driverRoutes.some(
      r => r.routeId === rid && r.driverId === a.driver.id
    )
  ).toBe(true);
  expect(proof.assignmentDatabase[0].TruckId).toBe(truck.truckId);
  await api(`/api/routes/${rid}/start`, a.driver, "PUT");
  const route = await api(`/api/routes/${rid}`, a.driver);
  for (const stop of route.stops)
    await api(
      `/api/routes/${rid}/stops/${stop.routeStopId}/collect`,
      a.driver,
      "PUT"
    );
  proof.beforeCompletion = rows(
    `SELECT RouteId,Status,TruckId,DriverId FROM Routes WHERE RouteId=${rid}`
  );
  await api(`/api/routes/${rid}/complete`, a.driver, "PUT");
  proof.afterCompletion = rows(
    `SELECT RouteId,Status,TruckId,DriverId FROM Routes WHERE RouteId=${rid}`
  );
  expect(proof.afterCompletion[0].Status).toBe("Completed");
  for (const name of ["admin", "officer"]) {
    proof[name + "CompletedRoute"] = (await api("/api/routes", a[name])).find(
      r => r.routeId === rid
    );
    expect(proof[name + "CompletedRoute"].status).toBe("Completed");
  }
  mkdirSync("test-results", { recursive: true });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto("http://localhost:3000/login");
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Toggle role dropdown" }).click();
  await page
    .locator(".role-dropdown-item")
    .filter({ hasText: "Ward Officer" })
    .click();
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page.goto("http://localhost:3000/register");
  await page.getByLabel("Password", { exact: true }).fill("weak");
  await expect(page.locator("#password-requirements")).toContainText(
    "an uppercase letter"
  );
  await expect(
    page.getByRole("button", { name: "Create account", exact: true })
  ).toBeDisabled();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await expect(
    page.getByRole("button", { name: "Create account", exact: true })
  ).toBeEnabled();
  proof.browserLogin =
    "Empty fields after load and role selection; weak registration blocked; strong enabled";
  for (const name of ["citizen", "driver", "officer", "admin"]) {
    await login(page, name);
    const path =
      name === "citizen"
        ? `/citizen/complaints/${cid}`
        : name === "driver"
          ? `/driver/route/${rid}`
          : `/operations/routes/${rid}`;
    await page.goto("http://localhost:3000" + path);
    await expect(page.locator(".ws-account")).toBeVisible();
    await page.route("**/api/auth/me", async r => {
      await new Promise(resolve => setTimeout(resolve, 600));
      await r.continue();
    });
    await page.reload();
    await expect(page.locator(".ws-account")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);
    await page.unroute("**/api/auth/me");
    if (name === "citizen") {
      await page
        .getByRole("button", { name: "Notifications", exact: true })
        .click();
      await expect(page.locator(".notif-card")).toHaveCount(2);
      await page.locator(".notif-card").filter({ hasText: "Resolved" }).click();
      await expect
        .poll(async () =>
          (await api("/api/notifications", a.citizen)).every(n => n.isRead)
        )
        .toBe(true);
      await page.reload();
      await expect(page.locator(".ws-account")).toBeVisible();
      await page
        .getByRole("button", { name: "Notifications", exact: true })
        .click();
      await expect(page.locator(".notif-card.unread")).toHaveCount(0);
      await expect(page.locator(".notif-drawer-popover")).toHaveCSS(
        "opacity",
        "1"
      );
      await page.screenshot({ path: `test-results/${tag}-notifications.png` });
      await page
        .getByRole("button", { name: "Notifications", exact: true })
        .click();
    }
    if (name === "officer" || name === "admin") {
      await page
        .getByRole("link", { name: "Dispatch & routes", exact: true })
        .click();
      await expect(
        page.locator(".ws-row").filter({ hasText: `Route #${rid}` })
      ).toContainText("Completed");
    }
    proof[name + "Refresh"] = {
      path,
      result: "Same URL after reload with delayed auth/me",
    };
    await page.screenshot({
      path: `test-results/${tag}-${name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sign out" }).click();
    expect(
      await page.evaluate(() => localStorage.getItem("safaitrack_token"))
    ).toBeNull();
  }
  for (const value of [
    "broken.token.value",
    `e30.${Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url")}.signature`,
  ]) {
    await page.evaluate(
      v => localStorage.setItem("safaitrack_token", v),
      value
    );
    await page.goto("http://localhost:3000/citizen/complaints");
    await expect(page).toHaveURL(/\/login$/);
    expect(
      await page.evaluate(() => localStorage.getItem("safaitrack_token"))
    ).toBeNull();
  }
  proof.invalidTokens = "Malformed and expired tokens cleared";
  proof.result = "PASS";
} catch (e) {
  proof.result = "FAIL";
  proof.error = String(e);
  throw e;
} finally {
  await browser?.close();
  sql(
    `DELETE FROM Notifications WHERE UserId IN (SELECT Id FROM AspNetUsers WHERE Email LIKE '${tag}.%@safaitrack.local'); DELETE FROM Routes WHERE WardId IN (SELECT WardId FROM Wards WHERE Name='${tag}'); DELETE FROM Complaints WHERE BinId IN (SELECT BinId FROM Bins WHERE Name='${tag}'); DELETE FROM Bins WHERE Name='${tag}'; DELETE FROM Trucks WHERE PlateNumber='${tag}'; DELETE FROM AspNetUsers WHERE Email LIKE '${tag}.%@safaitrack.local'; DELETE FROM Wards WHERE Name='${tag}';`
  );
  proof.cleanup = "Only isolated fixtures removed";
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/four-fixes-evidence.json",
    JSON.stringify(proof, null, 2)
  );
  console.log(JSON.stringify(proof, null, 2));
}
