// Live operational activity generator using real API calls against SafaiTrack.Api
const API = "http://localhost:5281";

async function request(path, options = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

async function login(email, password = "Password123") {
  const path = email === "admin@safaitrack.local" ? "/api/auth/city-admin/login" : "/api/auth/login";
  const res = await request(path, {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}


async function main() {
  console.log("=== STEP 1: Registering 3 New Test Users (PendingApproval) ===");
  const testUsers = [
    {
      fullName: "Mahir Faysal",
      email: "mahir.citizen@safaitrack.local",
      phoneNumber: "+8801912345001",
      gender: "Male",
      role: "Citizen",
      password: "Pass1234!",
      wardId: 1
    },
    {
      fullName: "Rafiqul Islam Babul",
      email: "rafiq.driver@safaitrack.local",
      phoneNumber: "+8801712345002",
      gender: "Male",
      role: "Driver",
      password: "Pass1234!"
    },
    {
      fullName: "Nusrat Jahan Chowdhury",
      email: "nusrat.officer@safaitrack.local",
      phoneNumber: "+8801812345003",
      gender: "Female",
      role: "WardOfficer",
      password: "Pass1234!",
      requestedWardId: 1
    }
  ];

  for (const u of testUsers) {
    const res = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(u)
    });
    console.log(`Registered ${u.fullName} (${u.role}): Status ${res.status} - ${JSON.stringify(res.data?.status || res.data?.message || res.data)}`);
  }

  console.log("\n=== STEP 2: Authenticating as City Admin & Fetching Resources ===");
  const admin = await login("admin@safaitrack.local", "Password123");
  console.log(`Logged in as City Admin: ${admin.fullName}`);

  const wardsRes = await request("/api/workspace/wards", { token: admin.token });
  const wards = wardsRes.data || [];
  console.log(`Found ${wards.length} wards.`);

  const binsRes = await request("/api/workspace/bins", { token: admin.token });
  const allBins = binsRes.data || [];
  console.log(`Found ${allBins.length} bins.`);

  const trucksRes = await request("/api/workspace/trucks", { token: admin.token });
  const allTrucks = trucksRes.data || [];
  console.log(`Found ${allTrucks.length} trucks.`);

  const driversRes = await request("/api/city-admin/people/Driver", { token: admin.token });
  const allDrivers = driversRes.data || [];
  console.log(`Found ${allDrivers.length} drivers.`);

  const officersRes = await request("/api/city-admin/people/WardOfficer", { token: admin.token });
  const allOfficers = officersRes.data || [];
  console.log(`Found ${allOfficers.length} ward officers.`);

  console.log("\n=== STEP 3: Citizens Filing Real Grievances Across Wards ===");
  const citizenLogins = [
    { email: "citizen@safaitrack.local", pass: "Password123" },
    { email: "citizen01@safaitrack.local", pass: "Password123" },
    { email: "citizen02@safaitrack.local", pass: "Password123" },
    { email: "easteak00987@gmail.com", pass: "Password123" }
  ];

  const citizenTokens = [];
  for (const c of citizenLogins) {
    try {
      const res = await login(c.email, c.pass);
      citizenTokens.push(res);
      console.log(`Citizen authenticated: ${res.fullName}`);
    } catch (e) {
      console.warn(`Could not log in ${c.email}: ${e.message}`);
    }
  }

  const complaintCategories = ["Overflowing", "Odor / Hazard", "Missed Collection", "Damaged Bin"];
  const complaintDescriptions = [
    "Severe bin overflow after evening market rush; waste spilling onto the sidewalk.",
    "Unpleasant odor spreading across neighborhood street; urgent clearing requested.",
    "Municipal collection missed this scheduled cycle; bin is at full capacity.",
    "Cracked lid and waste scattered around container base; needs immediate cleanup."
  ];

  // File complaints for bins in various wards
  let cIdx = 0;
  for (const bin of allBins.slice(0, 45)) {
    const citizen = citizenTokens[cIdx % citizenTokens.length];
    cIdx++;
    const cat = complaintCategories[cIdx % complaintCategories.length];
    const desc = complaintDescriptions[cIdx % complaintDescriptions.length];
    const postRes = await request("/api/complaints", {
      method: "POST",
      token: citizen.token,
      body: JSON.stringify({
        binId: bin.binId,
        category: cat,
        description: desc
      })
    });
    if (postRes.ok) {
      console.log(`Complaint logged for ${bin.name} in Ward ${bin.wardId} by ${citizen.fullName}: #${postRes.data.complaintId}`);
    }
  }

  console.log("\n=== STEP 4: Ward Officers Resolving Complaints & Dispatching Routes ===");
  for (let i = 0; i < allOfficers.length; i++) {
    const off = allOfficers[i];
    try {
      const offSession = await login(off.email, "Password123");
      const complaintsRes = await request("/api/complaints", { token: offSession.token });
      const wardComplaints = complaintsRes.data || [];

      // Update complaints: InProgress then Resolved
      for (const comp of wardComplaints.slice(0, 2)) {
        if (comp.status === "Pending") {
          await request(`/api/complaints/${comp.complaintId}/status`, {
            method: "PUT",
            token: offSession.token,
            body: JSON.stringify({ status: "InProgress", message: "Ward team dispatched for inspection." })
          });
          await request(`/api/complaints/${comp.complaintId}/status`, {
            method: "PUT",
            token: offSession.token,
            body: JSON.stringify({ status: "Resolved", message: "Waste collected and area sanitized." })
          });
          console.log(`Officer ${off.fullName} resolved complaint #${comp.complaintId} in Ward ${off.wardId}`);
        }
      }

      // Check if this ward can dispatch a route
      const driver = allDrivers[i % allDrivers.length];
      const truck = allTrucks[i % allTrucks.length];

      if (off.wardId && driver && truck) {
        const dispatchRes = await request("/api/routes/dispatch", {
          method: "POST",
          token: offSession.token,
          body: JSON.stringify({
            wardId: off.wardId,
            driverId: driver.id,
            truckId: truck.truckId,
            algorithm: "dijkstra"
          })
        });

        if (dispatchRes.ok) {
          console.log(`Officer ${off.fullName} dispatched Route #${dispatchRes.data.routeId} to Driver ${driver.fullName}`);
        }
      }
    } catch (e) {
      console.warn(`Officer ${off.email} error: ${e.message}`);
    }
  }

  console.log("\n=== STEP 5: Drivers Accepting Routes, Collecting Bins & Completing Quotas ===");
  for (const drv of allDrivers) {
    try {
      const drvSession = await login(drv.email, "Password123");
      // Get driver routes
      const routesRes = await request("/api/routes", { token: drvSession.token });
      const routes = routesRes.data || [];
      const assigned = routes.filter(r => r.driverId === drv.id && (r.status === "AwaitingAcceptance" || r.status === "Planned" || r.status === "InProgress"));

      for (const r of assigned) {
        // Accept/Start route
        if (r.status === "AwaitingAcceptance" || r.status === "Planned") {
          const startRes = await request(`/api/routes/${r.routeId}/start`, {
            method: "PUT",
            token: drvSession.token
          });
          if (!startRes.ok) continue;
        }

        // Fetch stops
        const detailRes = await request(`/api/routes/${r.routeId}`, { token: drvSession.token });
        const stops = detailRes.data?.routeStops || [];

        // Collect every stop in sequence
        for (const stop of stops) {
          if (!stop.collectedAt) {
            await request(`/api/routes/${r.routeId}/stops/${stop.routeStopId}/collect`, {
              method: "PUT",
              token: drvSession.token
            });
          }
        }

        // Complete the route
        const compRes = await request(`/api/routes/${r.routeId}/complete`, {
          method: "PUT",
          token: drvSession.token
        });

        if (compRes.ok) {
          console.log(`Driver ${drv.fullName} successfully completed Route #${r.routeId} (${stops.length} bins cleared). Daily wage quota accrued!`);
        }
      }
    } catch (e) {
      console.warn(`Driver ${drv.email} error: ${e.message}`);
    }
  }

  console.log("\n=== STEP 6: City Admin Issuing Real Invoices to Citizens ===");
  const draftsRes = await request("/api/city-admin/billing-drafts", { token: admin.token });
  const drafts = draftsRes.data || [];
  console.log(`Found ${drafts.length} billing proposals ready to issue.`);

  let issuedCount = 0;
  for (const d of drafts) {
    const sendRes = await request(`/api/city-admin/billing-drafts/${d.billingDraftId}/send`, {
      method: "POST",
      token: admin.token
    });
    if (sendRes.ok) {
      issuedCount++;
      console.log(`City Admin issued invoice for ${d.citizenName} (Ward: ${d.wardName}, Period: ${d.periodStart}): Invoice #${sendRes.data.invoiceId}`);
    }
  }
  console.log(`Total invoices issued: ${issuedCount}`);

  console.log("\n=== Operational activity generation complete! ===");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
