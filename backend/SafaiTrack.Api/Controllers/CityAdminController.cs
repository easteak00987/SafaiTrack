using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;
using SafaiTrack.Api.Services;

namespace SafaiTrack.Api.Controllers;

[ApiController, Authorize(Roles = "Admin"), Route("api/city-admin")]
public class CityAdminController(ApplicationDbContext db, IOptions<BillingOptions> billing) : ControllerBase
{
    private string ActorId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("people/{role}")]
    public async Task<IActionResult> People(string role)
    {
        if (role is not ("Driver" or "WardOfficer" or "Citizen")) return BadRequest();
        var since = DateTime.UtcNow.AddHours(-24);
        var users = await db.Users.AsNoTracking().Where(u => u.Role == role)
            .Select(u => new {
                u.Id, u.FullName, u.Email, u.PhoneNumber, u.Gender, u.Status, u.WardId,
                WardName = u.Ward != null ? u.Ward.Name : null,
                CompletedRoutes = db.Routes.Count(r => r.DriverId == u.Id && r.Status == "Completed"),
                CollectedBins = db.RouteStops.Count(s => s.Route!.DriverId == u.Id && s.Route.Status == "Completed" && s.CollectedAt != null),
                ComplaintsFiled = db.Complaints.Count(c => c.CitizenId == u.Id),
                ComplaintsHandled = db.ComplaintUpdates.Where(c => c.AuthorId == u.Id && c.Status == "Resolved").Select(c => c.ComplaintId).Distinct().Count(),
                WardResolved = db.Complaints.Count(c => c.Bin!.WardId == u.WardId && c.Status == "Resolved"),
                WardPending = db.Complaints.Count(c => c.Bin!.WardId == u.WardId && c.Status == "Pending"),
                WardInProgress = db.Complaints.Count(c => c.Bin!.WardId == u.WardId && c.Status == "InProgress"),
                Assignments24h = db.RouteActivities.Count(a => a.ActorId == u.Id && a.Action == "Assigned" && a.CreatedAt >= since),
                Optimizations24h = db.RouteActivities.Count(a => a.ActorId == u.Id && a.Action == "Optimized" && a.CreatedAt >= since),
                Bills = db.Invoices.Where(i => i.CitizenId == u.Id).OrderByDescending(i => i.BillingPeriodStart)
                    .Select(i => new { i.InvoiceId, i.InvoiceNumber, i.BillingPeriodStart, i.Status, i.Amount }).ToList(),
                Wages = db.DriverWages.Where(w => w.DriverId == u.Id).OrderByDescending(w => w.PeriodStart)
                    .Select(w => new { w.DriverWageId, w.Amount, w.BonusAmount, w.Status, w.CollectedAt, w.ReleasedAt, w.PeriodEnd }).ToList()
            }).OrderBy(u => u.FullName).ToListAsync();
        return Ok(users);
    }

    [HttpGet("billing-drafts")]
    public async Task<IActionResult> Drafts() => Ok(await db.BillingDrafts.AsNoTracking().Where(d => d.SentAt == null)
        .OrderBy(d => d.PeriodStart).Select(d => new { d.BillingDraftId, d.CitizenId,
            CitizenName = d.Citizen.FullName, d.Citizen.PhoneNumber, WardName = d.Ward.Name,
            d.PeriodStart, d.Amount, d.Currency }).ToListAsync());

    [HttpPost("billing-drafts/{id:int}/send")]
    public async Task<IActionResult> Send(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var draft = await db.BillingDrafts.Include(d => d.Citizen).FirstOrDefaultAsync(d => d.BillingDraftId == id);
        if (draft == null) return NotFound();
        if (draft.SentAt != null) return Ok(new { message = "Bill already sent.", draft.InvoiceId });
        if (draft.Citizen.Status != "Active") return Conflict(new { message = "This citizen is not active." });
        if (await db.Invoices.AnyAsync(i => i.CitizenId == draft.CitizenId && i.BillingPeriodStart == draft.PeriodStart))
            return Conflict(new { message = "An invoice already exists for this month." });
        var now = DateTime.UtcNow;
        var invoice = new Invoice {
            InvoiceNumber = $"INV-{draft.PeriodStart:yyyyMM}-D{draft.BillingDraftId:D6}",
            CitizenId = draft.CitizenId, WardId = draft.WardId, BillingPeriodStart = draft.PeriodStart,
            BillingPeriodEnd = draft.PeriodStart.AddMonths(1).AddTicks(-1), Amount = draft.Amount,
            Currency = draft.Currency, IssuedAt = now, DueAt = now.AddDays(billing.Value.DueAfterDays)
        };
        db.Invoices.Add(invoice);
        draft.Invoice = invoice; draft.SentAt = now; draft.SentById = ActorId;
        Notify(draft.CitizenId, "Your monthly bill is ready", $"Your {draft.PeriodStart:MMMM yyyy} collection bill is {draft.Amount:0.##} {draft.Currency}. Due {invoice.DueAt:dd MMM yyyy}.", "/billing");
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { message = "Invoice issued and citizen notified.", invoice.InvoiceId });
    }

    [HttpGet("payment-approvals")]
    public async Task<IActionResult> PaymentApprovals() => Ok(await db.Payments.AsNoTracking()
        .Where(p => p.ReviewStatus != null).OrderByDescending(p => p.CompletedAt)
        .Select(p => new { p.PaymentId, CitizenName = p.Citizen!.FullName, p.Citizen.PhoneNumber,
            p.Amount, p.Currency, p.Gateway, p.PaymentMethod, p.TransactionRef,
            InvoiceNumber = p.Invoice!.InvoiceNumber, p.ReviewStatus, p.CompletedAt, p.ReviewedAt }).ToListAsync());

    public record ReviewRequest(bool Approve);
    [HttpPut("payment-approvals/{id:int}")]
    public async Task<IActionResult> ReviewPayment(int id, ReviewRequest request)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var payment = await db.Payments.Include(p => p.Invoice).FirstOrDefaultAsync(p => p.PaymentId == id);
        if (payment == null) return NotFound();
        if (payment.Status != PaymentStatus.Success || payment.ReviewStatus is not ("Pending" or "Rejected"))
            return Conflict(new { message = "Only a verified payment awaiting review can be reviewed." });
        if (!request.Approve && payment.ReviewStatus == "Rejected") return Ok(new { message = "Payment already held for review." });
        payment.ReviewStatus = request.Approve ? "Approved" : "Rejected";
        payment.ReviewedAt = DateTime.UtcNow; payment.ReviewedById = ActorId;
        payment.Invoice!.Status = request.Approve ? InvoiceStatus.Paid : InvoiceStatus.ReviewHold;
        payment.Invoice.PaidAt = request.Approve ? DateTime.UtcNow : null;
        Notify(payment.CitizenId, request.Approve ? "Payment confirmed" : "Payment needs review",
            request.Approve ? $"City Admin confirmed payment for {payment.Invoice.InvoiceNumber}. Your bill is paid."
            : $"City Admin declined confirmation for {payment.Invoice.InvoiceNumber}. Contact the city office. Do not pay again; this action does not issue a refund.", "/billing");
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { payment.ReviewStatus, InvoiceStatus = payment.Invoice.Status });
    }

    [HttpGet("wages")]
    public async Task<IActionResult> Wages() => Ok((await db.DriverWages.Include(w => w.Driver).AsNoTracking()
        .OrderByDescending(w => w.PeriodStart).ToListAsync()).Select(PayrollService.View));

    [HttpPut("wages/{id:int}/release")]
    public async Task<IActionResult> Release(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var wage = await db.DriverWages.FindAsync(id);
        if (wage == null) return NotFound();
        if (wage.ReleasedAt != null) return Ok(new { message = "This wage has already been released." });
        if (!PayrollService.Eligible(wage, DateTime.UtcNow)) return Conflict(new { message = "The work quota must be completed first." });
        wage.Status = "ReadyForCollection"; wage.ReleasedAt = DateTime.UtcNow; wage.ReleasedById = ActorId;
        Notify(wage.DriverId, "Your daily wages are ready", $"City Admin released {wage.Amount:0.##} BDT, including {wage.BonusAmount:0.##} BDT bonus. Open Wages to collect now or later.", "/driver/wages");
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { message = "Wage released. Driver collection is pending." });
    }

    private void Notify(string userId, string title, string message, string link) => db.Notifications.Add(new Notification {
        UserId = userId, Title = title, Message = message, Link = link, Category = "info"
    });
}

[ApiController, Authorize(Roles = "Driver"), Route("api/wages")]
public class WagesController(ApplicationDbContext db) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    [HttpGet]
    public async Task<IActionResult> List() => Ok((await db.DriverWages.AsNoTracking().Where(w => w.DriverId == UserId)
        .OrderByDescending(w => w.PeriodStart).ToListAsync()).Select(PayrollService.View));

    [HttpPut("{id:int}/{actionName}")]
    public async Task<IActionResult> Collect(int id, string actionName)
    {
        if (actionName is not ("collect" or "defer")) return NotFound();
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var wage = await db.DriverWages.FirstOrDefaultAsync(w => w.DriverWageId == id && w.DriverId == UserId);
        if (wage == null) return NotFound();
        if (wage.Status == "Collected") return Ok(new { message = "Wage already collected successfully." });
        if (wage.Status != "ReadyForCollection") return Conflict(new { message = "City Admin has not released this wage yet." });
        if (actionName == "defer") wage.DeferredAt = DateTime.UtcNow;
        else {
            wage.Status = "Collected"; wage.CollectedAt = DateTime.UtcNow;
            var name = await db.Users.Where(u => u.Id == UserId).Select(u => u.FullName).SingleAsync();
            var admins = await db.Users.Where(u => u.Role == "Admin" && u.Status == "Active").Select(u => u.Id).ToListAsync();
            db.Notifications.AddRange(admins.Select(id => new Notification {
                UserId = id, Title = "Driver collected wages", Category = "success", Link = "/admin/payments-wages",
                Message = $"{name} acknowledged collection of {wage.Amount:0.##} BDT for wage #{wage.DriverWageId}."
            }));
        }
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(new { message = actionName == "collect" ? "Wage collected successfully." : "Saved for later. Your wage remains available." });
    }
}
