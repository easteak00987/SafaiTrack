using System.Data;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;
using SafaiTrack.Api.Services;

namespace SafaiTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPaymentGateway _gateway;
    private readonly SslCommerzOptions _gatewayOptions;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        ApplicationDbContext context,
        IPaymentGateway gateway,
        IOptions<SslCommerzOptions> gatewayOptions,
        ILogger<PaymentsController> logger)
    {
        _context = context;
        _gateway = gateway;
        _gatewayOptions = gatewayOptions.Value;
        _logger = logger;
    }

    /// <summary>Payment attempts — a citizen's own, or a ward's for staff.</summary>
    [Authorize(Roles = "Citizen,Admin,WardOfficer")]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PaymentResponseDto>>> GetPayments()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isStaff = User.IsInRole("Admin") || User.IsInRole("WardOfficer");

        var query = _context.Payments
            .Include(p => p.Invoice)
            .AsNoTracking();

        if (!isStaff)
        {
            query = query.Where(p => p.CitizenId == userId);
        }

        if (User.IsInRole("WardOfficer"))
        {
            var officer = await _context.Users.FindAsync(userId);
            query = query.Where(p => p.Invoice!.WardId == officer!.WardId);
        }

        var payments = await query
            .OrderByDescending(p => p.InitiatedAt)
            .Select(p => new PaymentResponseDto
            {
                PaymentId = p.PaymentId,
                ReviewStatus = p.ReviewStatus,
                InvoiceId = p.InvoiceId,
                InvoiceNumber = p.Invoice != null ? p.Invoice.InvoiceNumber : null,
                TransactionRef = p.TransactionRef,
                Gateway = p.Gateway,
                Amount = p.Amount,
                Currency = p.Currency,
                Status = p.Status,
                PaymentMethod = p.PaymentMethod,
                GatewayTransactionId = p.GatewayTransactionId,
                FailureReason = p.FailureReason,
                InitiatedAt = p.InitiatedAt,
                CompletedAt = p.CompletedAt
            })
            .ToListAsync();

        return Ok(payments);
    }

    /// <summary>
    /// Opens a gateway checkout session for one unpaid invoice and returns the URL
    /// the citizen should be redirected to.
    /// </summary>
    [Authorize(Roles = "Citizen")]
    [HttpPost("initiate")]
    public async Task<ActionResult<InitiatePaymentResponseDto>> Initiate(
        InitiatePaymentDto dto,
        CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var user = await _context.Users.FindAsync([userId], cancellationToken);
        if (user == null)
        {
            return Unauthorized(new { message = "Your account could not be resolved." });
        }

        // Serializable so two tabs cannot open two sessions against the same invoice.
        await using var tx = await _context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);

        var invoice = await _context.Invoices
            .FirstOrDefaultAsync(i => i.InvoiceId == dto.InvoiceId, cancellationToken);

        if (invoice == null)
        {
            return NotFound(new { message = $"Invoice with ID {dto.InvoiceId} not found." });
        }

        if (invoice.CitizenId != userId)
        {
            return Forbid();
        }

        if (await _context.Payments.AnyAsync(p => p.InvoiceId == invoice.InvoiceId && p.Status == PaymentStatus.Success, cancellationToken))
            return Conflict(new { message = "A successful payment already exists. Wait for City Admin confirmation; do not pay again." });
        if (invoice.Status == InvoiceStatus.Paid)
        {
            return BadRequest(new { message = "This invoice has already been paid." });
        }

        if (invoice.Status == InvoiceStatus.Cancelled)
        {
            return BadRequest(new { message = "This invoice has been cancelled." });
        }

        // Abandon any earlier attempt still sitting open, so one invoice has at most
        // one live checkout session at a time.
        var stale = await _context.Payments
            .Where(p => p.InvoiceId == invoice.InvoiceId && p.Status == PaymentStatus.Initiated)
            .ToListAsync(cancellationToken);

        foreach (var attempt in stale)
        {
            attempt.Status = PaymentStatus.Cancelled;
            attempt.FailureReason = "Superseded by a newer payment attempt.";
            attempt.CompletedAt = DateTime.UtcNow;
        }

        var transactionRef = $"ST-{invoice.InvoiceId}-{Guid.NewGuid():N}"[..32];

        var payment = new Payment
        {
            InvoiceId = invoice.InvoiceId,
            CitizenId = invoice.CitizenId,
            TransactionRef = transactionRef,
            Gateway = _gateway.Name,
            Amount = invoice.Amount,
            Currency = invoice.Currency,
            Status = PaymentStatus.Initiated,
            InitiatedAt = DateTime.UtcNow
        };

        _context.Payments.Add(payment);

        invoice.Status = InvoiceStatus.Processing;

        await _context.SaveChangesAsync(cancellationToken);

        var apiBase = _gatewayOptions.ApiBaseUrl.TrimEnd('/');

        var result = await _gateway.InitiateAsync(new GatewayInitiationRequest
        {
            TransactionRef = transactionRef,
            Amount = invoice.Amount,
            Currency = invoice.Currency,
            CustomerName = user.FullName,
            CustomerEmail = user.Email ?? "citizen@safaitrack.local",
            CustomerPhone = user.PhoneNumber,
            ProductDescription =
                $"Waste collection fee {invoice.BillingPeriodStart:MMMM yyyy} ({invoice.InvoiceNumber})",
            SuccessUrl = $"{apiBase}/api/payments/callback/success",
            FailUrl = $"{apiBase}/api/payments/callback/fail",
            CancelUrl = $"{apiBase}/api/payments/callback/cancel",
            IpnUrl = $"{apiBase}/api/payments/ipn"
        }, cancellationToken);

        if (!result.Succeeded || string.IsNullOrWhiteSpace(result.RedirectUrl))
        {
            // The gateway never opened a session, so release the invoice rather than
            // stranding it in Processing.
            payment.Status = PaymentStatus.Failed;
            payment.FailureReason = result.ErrorMessage;
            payment.CompletedAt = DateTime.UtcNow;
            invoice.Status = InvoiceStatus.Unpaid;

            await _context.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                message = result.ErrorMessage ?? "The payment gateway could not start this transaction."
            });
        }

        payment.GatewaySessionKey = result.SessionKey;
        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return Ok(new InitiatePaymentResponseDto
        {
            RedirectUrl = result.RedirectUrl,
            TransactionRef = transactionRef,
            Gateway = _gateway.Name,
            Amount = invoice.Amount,
            Currency = invoice.Currency
        });
    }

    /// <summary>
    /// Browser redirect target after a successful checkout. The posted values are not
    /// trusted — settlement is confirmed against the gateway before anything is marked paid.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("callback/success")]
    [HttpGet("callback/success")]
    public async Task<IActionResult> CallbackSuccess(CancellationToken cancellationToken)
    {
        var (transactionRef, validationId) = ReadCallbackValues();
        var outcome = await SettleAsync(transactionRef, validationId, cancellationToken);

        return RedirectToClient(outcome.Redirect, transactionRef, outcome.Message);
    }

    [AllowAnonymous]
    [HttpPost("callback/fail")]
    [HttpGet("callback/fail")]
    public async Task<IActionResult> CallbackFail(CancellationToken cancellationToken)
    {
        var (transactionRef, _) = ReadCallbackValues();
        await MarkUnsuccessfulAsync(
            transactionRef, PaymentStatus.Failed,
            "The gateway reported the payment as failed.", cancellationToken);

        return RedirectToClient("failed", transactionRef, "The payment did not go through.");
    }

    [AllowAnonymous]
    [HttpPost("callback/cancel")]
    [HttpGet("callback/cancel")]
    public async Task<IActionResult> CallbackCancel(CancellationToken cancellationToken)
    {
        var (transactionRef, _) = ReadCallbackValues();
        await MarkUnsuccessfulAsync(
            transactionRef, PaymentStatus.Cancelled,
            "The citizen cancelled the payment.", cancellationToken);

        return RedirectToClient("cancelled", transactionRef, "The payment was cancelled.");
    }

    /// <summary>
    /// Server-to-server notification. This is the authoritative signal — a citizen who
    /// closes the browser before the redirect still gets their invoice settled here.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("ipn")]
    public async Task<IActionResult> InstantPaymentNotification(CancellationToken cancellationToken)
    {
        var (transactionRef, validationId) = ReadCallbackValues();
        var status = ReadValue("status");

        if (string.Equals(status, "VALID", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "VALIDATED", StringComparison.OrdinalIgnoreCase))
        {
            var outcome = await SettleAsync(transactionRef, validationId, cancellationToken);
            return Ok(new { received = true, settled = outcome.Redirect == "success" });
        }

        await MarkUnsuccessfulAsync(
            transactionRef, PaymentStatus.Failed,
            $"The gateway notified status '{status}'.", cancellationToken);

        return Ok(new { received = true, settled = false });
    }

    /// <summary>
    /// Confirms a transaction with the gateway and, only if it checks out, marks the
    /// invoice paid. Safe to call more than once — the browser redirect and the IPN
    /// commonly both arrive.
    /// </summary>
    private async Task<(string Redirect, string Message)> SettleAsync(
        string? transactionRef,
        string? validationId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(transactionRef))
        {
            return ("failed", "The gateway callback did not identify a transaction.");
        }

        await using var tx = await _context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);

        var payment = await _context.Payments
            .Include(p => p.Invoice)
            .FirstOrDefaultAsync(p => p.TransactionRef == transactionRef, cancellationToken);

        if (payment?.Invoice == null)
        {
            _logger.LogWarning(
                "Gateway callback referenced unknown transaction {TransactionRef}.", transactionRef);
            return ("failed", "This transaction is not recognised.");
        }

        // Already settled by whichever of the redirect or the IPN arrived first.
        if (payment.Status == PaymentStatus.Success)
        {
            return ("success", "This payment has already been recorded.");
        }

        var validation = await _gateway.ValidateAsync(new GatewayValidationRequest
        {
            TransactionRef = transactionRef,
            ValidationId = validationId,
            ExpectedAmount = payment.Amount,
            ExpectedCurrency = payment.Currency
        }, cancellationToken);

        payment.ValidationId = validationId;
        payment.GatewayPayload = Truncate(validation.RawPayload, 4000);
        payment.CompletedAt = DateTime.UtcNow;

        if (!validation.IsValid)
        {
            payment.Status = PaymentStatus.Failed;
            payment.FailureReason = Truncate(validation.ErrorMessage, 500);
            if (!await _context.Payments.AnyAsync(p => p.InvoiceId == payment.InvoiceId && p.Status == PaymentStatus.Success, cancellationToken))
                payment.Invoice.Status = InvoiceStatus.Unpaid;

            await _context.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            _logger.LogWarning(
                "Rejected settlement for {TransactionRef}: {Reason}",
                transactionRef, validation.ErrorMessage);

            return ("failed", validation.ErrorMessage ?? "The payment could not be verified.");
        }

        payment.Status = PaymentStatus.Success;
        payment.GatewayTransactionId = validation.GatewayTransactionId;
        payment.PaymentMethod = validation.PaymentMethod;

        // A late callback from an older checkout must not reopen an already funded invoice.
        if (await _context.Payments.AnyAsync(p => p.InvoiceId == payment.InvoiceId && p.PaymentId != payment.PaymentId && p.Status == PaymentStatus.Success, cancellationToken))
        {
            payment.ReviewStatus = "Duplicate";
            await _context.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return ("success", "Payment received. Another payment exists for this invoice; contact City Admin for reconciliation. Do not pay again.");
        }

        var admins = await _context.Users.Where(u => u.Role == "Admin" && u.Status == "Active").Select(u => u.Id).ToListAsync(cancellationToken);
        _context.Notifications.AddRange(admins.Select(id => new Notification {
            UserId = id, Title = "Payment approval requested", Category = "info", Link = "/admin/approvals",
            Message = $"Invoice {payment.Invoice.InvoiceNumber}: {payment.Amount:0.##} {payment.Currency} payment is ready for review."
        }));
        payment.ReviewStatus = "Pending";
        payment.Invoice.Status = InvoiceStatus.AwaitingApproval;

        _context.Notifications.Add(new Notification
        {
            UserId = payment.CitizenId,
            Message =
                $"Payment received: {payment.Amount:0.##} {payment.Currency} for invoice " +
                $"{payment.Invoice.InvoiceNumber}. Payment successful, wait for City Admin confirmation.",
            Title = "Payment awaiting confirmation", Link = "/billing", Category = "info",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        _logger.LogInformation(
            "Settled {Amount} {Currency} for invoice {InvoiceNumber} via {Gateway}.",
            payment.Amount, payment.Currency, payment.Invoice.InvoiceNumber, payment.Gateway);

        return ("success", "Payment successful, wait for City Admin confirmation.");
    }

    private async Task MarkUnsuccessfulAsync(
        string? transactionRef,
        string status,
        string reason,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(transactionRef))
        {
            return;
        }

        await using var tx = await _context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);

        var payment = await _context.Payments
            .Include(p => p.Invoice)
            .FirstOrDefaultAsync(p => p.TransactionRef == transactionRef, cancellationToken);

        // Never walk back a payment the gateway already confirmed.
        if (payment == null || payment.Status == PaymentStatus.Success)
        {
            return;
        }

        payment.Status = status;
        payment.FailureReason = reason;
        payment.CompletedAt = DateTime.UtcNow;

        if (payment.Invoice is { Status: InvoiceStatus.Processing })
        {
            payment.Invoice.Status = InvoiceStatus.Unpaid;
        }

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    /// <summary>
    /// Reads the transaction reference and validation id from either the posted form
    /// (how gateways normally call back) or the query string.
    /// </summary>
    private (string? TransactionRef, string? ValidationId) ReadCallbackValues() =>
        (ReadValue("tran_id"), ReadValue("val_id"));

    private string? ReadValue(string key)
    {
        if (Request.HasFormContentType && Request.Form.TryGetValue(key, out var formValue))
        {
            return formValue.ToString();
        }

        return Request.Query.TryGetValue(key, out var queryValue) ? queryValue.ToString() : null;
    }

    private IActionResult RedirectToClient(string outcome, string? transactionRef, string message)
    {
        var target =
            $"{_gatewayOptions.ClientBaseUrl.TrimEnd('/')}/billing" +
            $"?payment={Uri.EscapeDataString(outcome)}" +
            $"&ref={Uri.EscapeDataString(transactionRef ?? string.Empty)}" +
            $"&message={Uri.EscapeDataString(message)}";

        return Redirect(target);
    }

    private static string? Truncate(string? value, int maxLength) =>
        value is { Length: > 0 } && value.Length > maxLength ? value[..maxLength] : value;

    // ---------------------------------------------------------------------
    // Simulated gateway checkout — only reachable when no SSLCommerz merchant
    // credentials are configured, so the billing flow stays demonstrable offline.
    // ---------------------------------------------------------------------

    [AllowAnonymous]
    [HttpGet("simulated-checkout")]
    public IActionResult SimulatedCheckout([FromQuery(Name = "tran_id")] string? tranId)
    {
        if (_gatewayOptions.IsConfigured)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(tranId))
        {
            return BadRequest("Missing transaction reference.");
        }

        var apiBase = _gatewayOptions.ApiBaseUrl.TrimEnd('/');
        var safeRef = System.Net.WebUtility.HtmlEncode(tranId);

        var html = $$"""
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>SafaiTrack — Simulated Checkout</title>
              <style>
                body { font-family: system-ui, sans-serif; background: #0f1a14; color: #e8f0ea;
                       display: grid; place-items: center; min-height: 100vh; margin: 0; }
                .card { background: #16241c; border: 1px solid #27402f; border-radius: 12px;
                        padding: 32px; width: min(420px, 90vw); }
                h1 { font-size: 1.15rem; margin: 0 0 4px; }
                p.sub { color: #9db3a5; font-size: .85rem; margin: 0 0 20px; }
                code { background: #0f1a14; padding: 2px 6px; border-radius: 4px; font-size: .78rem; }
                label { display: block; font-size: .8rem; color: #9db3a5; margin: 16px 0 6px; }
                select, button { width: 100%; padding: 11px; border-radius: 8px; font-size: .9rem; }
                select { background: #0f1a14; color: #e8f0ea; border: 1px solid #27402f; }
                button { border: 0; cursor: pointer; font-weight: 600; margin-top: 10px; }
                .pay { background: #b6e14a; color: #14251a; }
                .fail { background: #2a3a30; color: #e8f0ea; }
                .cancel { background: transparent; color: #9db3a5; }
                .note { margin-top: 18px; font-size: .72rem; color: #6f8578; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Simulated payment gateway</h1>
                <p class="sub">Stands in for SSLCommerz while no merchant credentials are set.</p>
                <p style="font-size:.8rem;color:#9db3a5;margin:0">Transaction <code>{{safeRef}}</code></p>
                <form method="post" action="{{apiBase}}/api/payments/simulated-checkout/complete">
                  <input type="hidden" name="tran_id" value="{{safeRef}}">
                  <label for="method">Pay with</label>
                  <select id="method" name="method">
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Rocket">Rocket</option>
                    <option value="VISA">VISA card</option>
                  </select>
                  <button class="pay" type="submit" name="outcome" value="success">Approve payment</button>
                  <button class="fail" type="submit" name="outcome" value="fail">Simulate failure</button>
                  <button class="cancel" type="submit" name="outcome" value="cancel">Cancel</button>
                </form>
                <p class="note">
                  Configure <code>SslCommerz:StoreId</code> and <code>SslCommerz:StorePassword</code>
                  to route this through the real SSLCommerz sandbox instead.
                </p>
              </div>
            </body>
            </html>
            """;

        return Content(html, "text/html", Encoding.UTF8);
    }

    [AllowAnonymous]
    [HttpPost("simulated-checkout/complete")]
    public async Task<IActionResult> SimulatedCheckoutComplete(CancellationToken cancellationToken)
    {
        if (_gatewayOptions.IsConfigured)
        {
            return NotFound();
        }

        var transactionRef = ReadValue("tran_id");
        var outcome = ReadValue("outcome");
        var method = ReadValue("method") ?? "Simulated";

        if (string.IsNullOrWhiteSpace(transactionRef))
        {
            return BadRequest("Missing transaction reference.");
        }

        switch (outcome)
        {
            case "success":
                SimulatedPaymentGateway.Approve(transactionRef, method);
                var settled = await SettleAsync(
                    transactionRef, $"SIM-VAL-{transactionRef}", cancellationToken);
                return RedirectToClient(settled.Redirect, transactionRef, settled.Message);

            case "cancel":
                SimulatedPaymentGateway.Discard(transactionRef);
                await MarkUnsuccessfulAsync(
                    transactionRef, PaymentStatus.Cancelled,
                    "The citizen cancelled the payment.", cancellationToken);
                return RedirectToClient("cancelled", transactionRef, "The payment was cancelled.");

            default:
                SimulatedPaymentGateway.Discard(transactionRef);
                await MarkUnsuccessfulAsync(
                    transactionRef, PaymentStatus.Failed,
                    "The simulated gateway declined the payment.", cancellationToken);
                return RedirectToClient("failed", transactionRef, "The payment did not go through.");
        }
    }
}
