using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SafaiTrack.Api.Migrations
{
    /// <inheritdoc />
    public partial class CityAdministration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "Routes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewStatus",
                table: "Payments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "Payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedById",
                table: "Payments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Notifications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Link",
                table: "Notifications",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RelatedRouteId",
                table: "Notifications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "Notifications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                table: "Complaints",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "AspNetUsers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RequestedWardId",
                table: "AspNetUsers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "AspNetUsers",
                type: "text",
                nullable: false,
                defaultValue: "Active");

            migrationBuilder.CreateTable(
                name: "BillingDrafts",
                columns: table => new
                {
                    BillingDraftId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CitizenId = table.Column<string>(type: "text", nullable: false),
                    WardId = table.Column<int>(type: "integer", nullable: false),
                    PeriodStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SentById = table.Column<string>(type: "text", nullable: true),
                    InvoiceId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingDrafts", x => x.BillingDraftId);
                    table.ForeignKey(
                        name: "FK_BillingDrafts_AspNetUsers_CitizenId",
                        column: x => x.CitizenId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BillingDrafts_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "InvoiceId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BillingDrafts_Wards_WardId",
                        column: x => x.WardId,
                        principalTable: "Wards",
                        principalColumn: "WardId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DriverWages",
                columns: table => new
                {
                    DriverWageId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DriverId = table.Column<string>(type: "text", nullable: false),
                    PeriodStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PeriodEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RoutesCompleted = table.Column<int>(type: "integer", nullable: false),
                    BinsCollected = table.Column<int>(type: "integer", nullable: false),
                    RequiredRoutes = table.Column<int>(type: "integer", nullable: false),
                    RequiredBins = table.Column<int>(type: "integer", nullable: false),
                    BaseAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PerBinAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BonusRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    BonusAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ReleasedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReleasedById = table.Column<string>(type: "text", nullable: true),
                    DeferredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CollectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DriverWages", x => x.DriverWageId);
                    table.ForeignKey(
                        name: "FK_DriverWages_AspNetUsers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RouteActivities",
                columns: table => new
                {
                    RouteActivityId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RouteId = table.Column<int>(type: "integer", nullable: false),
                    ActorId = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RouteActivities", x => x.RouteActivityId);
                    table.ForeignKey(
                        name: "FK_RouteActivities_AspNetUsers_ActorId",
                        column: x => x.ActorId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RouteActivities_Routes_RouteId",
                        column: x => x.RouteId,
                        principalTable: "Routes",
                        principalColumn: "RouteId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WageContributions",
                columns: table => new
                {
                    WageContributionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DriverWageId = table.Column<int>(type: "integer", nullable: false),
                    RouteId = table.Column<int>(type: "integer", nullable: false),
                    BinsCollected = table.Column<int>(type: "integer", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WageContributions", x => x.WageContributionId);
                    table.ForeignKey(
                        name: "FK_WageContributions_DriverWages_DriverWageId",
                        column: x => x.DriverWageId,
                        principalTable: "DriverWages",
                        principalColumn: "DriverWageId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WageContributions_Routes_RouteId",
                        column: x => x.RouteId,
                        principalTable: "Routes",
                        principalColumn: "RouteId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_RelatedRouteId",
                table: "Notifications",
                column: "RelatedRouteId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_RequestedWardId",
                table: "AspNetUsers",
                column: "RequestedWardId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingDrafts_CitizenId_PeriodStart",
                table: "BillingDrafts",
                columns: new[] { "CitizenId", "PeriodStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BillingDrafts_InvoiceId",
                table: "BillingDrafts",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingDrafts_WardId",
                table: "BillingDrafts",
                column: "WardId");

            migrationBuilder.CreateIndex(
                name: "IX_DriverWages_DriverId_PeriodStart",
                table: "DriverWages",
                columns: new[] { "DriverId", "PeriodStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RouteActivities_ActorId_CreatedAt",
                table: "RouteActivities",
                columns: new[] { "ActorId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RouteActivities_RouteId",
                table: "RouteActivities",
                column: "RouteId");

            migrationBuilder.CreateIndex(
                name: "IX_WageContributions_DriverWageId",
                table: "WageContributions",
                column: "DriverWageId");

            migrationBuilder.CreateIndex(
                name: "IX_WageContributions_RouteId",
                table: "WageContributions",
                column: "RouteId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Wards_RequestedWardId",
                table: "AspNetUsers",
                column: "RequestedWardId",
                principalTable: "Wards",
                principalColumn: "WardId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Routes_RelatedRouteId",
                table: "Notifications",
                column: "RelatedRouteId",
                principalTable: "Routes",
                principalColumn: "RouteId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Wards_RequestedWardId",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Routes_RelatedRouteId",
                table: "Notifications");

            migrationBuilder.DropTable(
                name: "BillingDrafts");

            migrationBuilder.DropTable(
                name: "RouteActivities");

            migrationBuilder.DropTable(
                name: "WageContributions");

            migrationBuilder.DropTable(
                name: "DriverWages");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_RelatedRouteId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_RequestedWardId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Routes");

            migrationBuilder.DropColumn(
                name: "ReviewStatus",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReviewedById",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "Link",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "RelatedRouteId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "RequestedWardId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "AspNetUsers");
        }
    }
}
