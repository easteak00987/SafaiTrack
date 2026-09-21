using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;
using SafaiTrack.Api.Services;
using Microsoft.Extensions.Options;

namespace SafaiTrack.Api.Controllers;

[Authorize(Roles = "Citizen,Admin,WardOfficer")]
[ApiController]
[Route("api/[controller]")]
public class InvoicesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly InvoiceGenerationService _invoiceGeneration;
    private readonly BillingOptions _billing;

    public InvoicesController(
        ApplicationDbContext context,
        InvoiceGenerationService invoiceGeneration,
        IOptions<BillingOptions> billingOptions)
    {
        _context = context;
        _invoiceGeneration = invoiceGeneration;
        _billing = billingOptions.Value;
    }

    /// <summary>
    /// Citizens see their own collection-fee invoices; staff see their ward's.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<InvoiceResponseDto>>> GetInvoices([FromQuery] string? status)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isStaff = User.IsInRole("Admin") || User.IsInRole("WardOfficer");

        var query = _context.Invoices
            .Include(i => i.Citizen)
            .Include(i => i.Ward)
            .AsNoTracking();

        if (!isStaff)
        {
            query = query.Where(i => i.CitizenId == userId);
        }

        // A ward officer's remit is their own ward, matching how complaints are scoped.
        if (User.IsInRole("WardOfficer"))
        {
            var officer = await _context.Users.FindAsync(userId);
            query = query.Where(i => i.WardId == officer!.WardId);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!InvoiceStatus.All.Contains(status, StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    message = $"Status must be one of: {string.Join(", ", InvoiceStatus.All)}."
                });
            }

            query = query.Where(i => i.Status == status);
        }

        var now = DateTime.UtcNow;

        var invoices = await query
            .OrderByDescending(i => i.BillingPeriodStart)
            .ThenBy(i => i.InvoiceNumber)
            .Select(i => new InvoiceResponseDto
            {
                InvoiceId = i.InvoiceId,
                InvoiceNumber = i.InvoiceNumber,
                CitizenId = i.CitizenId,
                CitizenName = i.Citizen != null ? i.Citizen.FullName : null,
                WardId = i.WardId,
                WardName = i.Ward != null ? i.Ward.Name : null,
                BillingPeriodStart = i.BillingPeriodStart,
                BillingPeriodEnd = i.BillingPeriodEnd,
                Amount = i.Amount,
                Currency = i.Currency,
                IssuedAt = i.IssuedAt,
                DueAt = i.DueAt,
                Status = i.Status,
                IsOverdue = i.Status == InvoiceStatus.Unpaid && now > i.DueAt,
                PaidAt = i.PaidAt
            })
            .ToListAsync();

        return Ok(invoices);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<InvoiceResponseDto>> GetInvoice(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isStaff = User.IsInRole("Admin") || User.IsInRole("WardOfficer");

        var invoice = await _context.Invoices
            .Include(i => i.Citizen)
            .Include(i => i.Ward)
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.InvoiceId == id);

        if (invoice == null)
        {
            return NotFound(new { message = $"Invoice with ID {id} not found." });
        }

        if (!isStaff && invoice.CitizenId != userId)
        {
            return Forbid();
        }

        if (User.IsInRole("WardOfficer"))
        {
            var officer = await _context.Users.FindAsync(userId);
            if (invoice.WardId != officer!.WardId)
            {
                return Forbid();
            }
        }

        return Ok(ToDto(invoice, DateTime.UtcNow));
    }

    /// <summary>
    /// Revenue rollup for the analytics dashboard: how much of each ward's billed
    /// collection fee has actually been recovered.
    /// </summary>
    [Authorize(Roles = "Admin,WardOfficer")]
    [HttpGet("summary")]
    public async Task<ActionResult<BillingSummaryDto>> GetSummary()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var query = _context.Invoices.AsNoTracking();

        if (User.IsInRole("WardOfficer"))
        {
            var officer = await _context.Users.FindAsync(userId);
            query = query.Where(i => i.WardId == officer!.WardId);
        }

        var now = DateTime.UtcNow;

        var perWard = await query
            .GroupBy(i => new { i.WardId, WardName = i.Ward!.Name })
            .Select(g => new WardCollectionSummaryDto
            {
                WardId = g.Key.WardId,
                WardName = g.Key.WardName,
                TotalInvoices = g.Count(),
                PaidInvoices = g.Count(i => i.Status == InvoiceStatus.Paid),
                OverdueInvoices = g.Count(i => i.Status == InvoiceStatus.Unpaid && now > i.DueAt),
                AmountBilled = g.Sum(i => i.Amount),
                AmountCollected = g.Where(i => i.Status == InvoiceStatus.Paid).Sum(i => i.Amount)
            })
            .OrderBy(w => w.WardName)
            .ToListAsync();

        foreach (var ward in perWard)
        {
            ward.AmountOutstanding = ward.AmountBilled - ward.AmountCollected;
            ward.CollectionRate = ward.AmountBilled == 0
                ? 0
                : Math.Round((double)(ward.AmountCollected / ward.AmountBilled) * 100, 1);
        }

        var billed = perWard.Sum(w => w.AmountBilled);
        var collected = perWard.Sum(w => w.AmountCollected);

        return Ok(new BillingSummaryDto
        {
            AmountBilled = billed,
            AmountCollected = collected,
            AmountOutstanding = billed - collected,
            TotalInvoices = perWard.Sum(w => w.TotalInvoices),
            PaidInvoices = perWard.Sum(w => w.PaidInvoices),
            OverdueInvoices = perWard.Sum(w => w.OverdueInvoices),
            CollectionRate = billed == 0 ? 0 : Math.Round((double)(collected / billed) * 100, 1),
            Currency = _billing.Currency,
            Wards = perWard
        });
    }

    /// <summary>
    /// Runs the monthly billing pass on demand. The background service does this
    /// hourly; this endpoint exists so a demo does not have to wait for the timer.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("generate")]
    public async Task<ActionResult> GenerateInvoices(CancellationToken cancellationToken)
    {
        var created = await _invoiceGeneration.GenerateForCurrentPeriodAsync(cancellationToken);

        return Ok(new
        {
            created,
            message = created == 0
                ? "Every eligible household is already billed for the current period."
                : $"Issued {created} collection-fee invoice(s) for the current period."
        });
    }

    private static InvoiceResponseDto ToDto(Invoice invoice, DateTime now) => new()
    {
        InvoiceId = invoice.InvoiceId,
        InvoiceNumber = invoice.InvoiceNumber,
        CitizenId = invoice.CitizenId,
        CitizenName = invoice.Citizen?.FullName,
        WardId = invoice.WardId,
        WardName = invoice.Ward?.Name,
        BillingPeriodStart = invoice.BillingPeriodStart,
        BillingPeriodEnd = invoice.BillingPeriodEnd,
        Amount = invoice.Amount,
        Currency = invoice.Currency,
        IssuedAt = invoice.IssuedAt,
        DueAt = invoice.DueAt,
        Status = invoice.Status,
        IsOverdue = invoice.IsOverdue(now),
        PaidAt = invoice.PaidAt
    };
}
