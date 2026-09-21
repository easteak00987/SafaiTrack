# Required only because Render has no native .NET runtime — it builds this image
# in the cloud, so Docker does not need to be installed or running locally.

# Build stage.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore as its own layer so dependencies are cached across source edits.
COPY SafaiTrack.Api.csproj ./
RUN dotnet restore SafaiTrack.Api.csproj

COPY . ./
RUN dotnet publish SafaiTrack.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage — ASP.NET runtime only, no SDK or source.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Run as the non-root user the base image already provides.
USER $APP_UID

COPY --from=build /app/publish ./

# Render supplies the port to bind through $PORT, which Program.cs reads. 8080 is
# the fallback for running this image anywhere else.
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SafaiTrack.Api.dll"]
