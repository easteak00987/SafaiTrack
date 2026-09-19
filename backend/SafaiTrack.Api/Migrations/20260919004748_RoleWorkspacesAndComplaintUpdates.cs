using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafaiTrack.Api.Migrations
{
    /// <inheritdoc />
    public partial class RoleWorkspacesAndComplaintUpdates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WardId",
                table: "AspNetUsers",
                type: "int",
                nullable: true);

            migrationBuilder.Sql("UPDATE AspNetUsers SET WardId = (SELECT TOP 1 WardId FROM Wards WHERE Name = 'Ward 08 / Dhanmondi') WHERE Email IN ('officer08@safaitrack.local', 'driver01@safaitrack.local', 'driver@safaitrack.local') AND Role IN ('WardOfficer', 'Driver')");

            migrationBuilder.CreateTable(
                name: "ComplaintUpdates",
                columns: table => new
                {
                    ComplaintUpdateId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ComplaintId = table.Column<int>(type: "int", nullable: false),
                    AuthorId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AuthorName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplaintUpdates", x => x.ComplaintUpdateId);
                    table.ForeignKey(
                        name: "FK_ComplaintUpdates_Complaints_ComplaintId",
                        column: x => x.ComplaintId,
                        principalTable: "Complaints",
                        principalColumn: "ComplaintId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_WardId",
                table: "AspNetUsers",
                column: "WardId");

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintUpdates_ComplaintId",
                table: "ComplaintUpdates",
                column: "ComplaintId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Wards_WardId",
                table: "AspNetUsers",
                column: "WardId",
                principalTable: "Wards",
                principalColumn: "WardId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Wards_WardId",
                table: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "ComplaintUpdates");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_WardId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "WardId",
                table: "AspNetUsers");
        }
    }
}
