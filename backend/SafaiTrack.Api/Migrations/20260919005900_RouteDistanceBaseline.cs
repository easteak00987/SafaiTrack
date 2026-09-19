using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafaiTrack.Api.Migrations
{
    /// <inheritdoc />
    public partial class RouteDistanceBaseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "NaiveDistanceKm",
                table: "Routes",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NaiveDistanceKm",
                table: "Routes");
        }
    }
}
