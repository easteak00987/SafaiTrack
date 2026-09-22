-- Additive upgrade for the existing SQL Server database. PostgreSQL uses EF migrations.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
BEGIN TRANSACTION;
IF COL_LENGTH('Routes','CompletedAt') IS NULL ALTER TABLE Routes ADD CompletedAt datetime2 NULL;
IF COL_LENGTH('Payments','ReviewStatus') IS NULL ALTER TABLE Payments ADD ReviewStatus nvarchar(20) NULL;
IF COL_LENGTH('Payments','ReviewedAt') IS NULL ALTER TABLE Payments ADD ReviewedAt datetime2 NULL;
IF COL_LENGTH('Payments','ReviewedById') IS NULL ALTER TABLE Payments ADD ReviewedById nvarchar(max) NULL;
IF OBJECT_ID('BillingDrafts','U') IS NULL
BEGIN
  CREATE TABLE BillingDrafts (
    BillingDraftId int IDENTITY PRIMARY KEY, CitizenId nvarchar(450) NOT NULL REFERENCES AspNetUsers(Id),
    WardId int NOT NULL REFERENCES Wards(WardId), PeriodStart datetime2 NOT NULL,
    Amount decimal(18,2) NOT NULL, Currency nvarchar(3) NOT NULL, CreatedAt datetime2 NOT NULL,
    SentAt datetime2 NULL, SentById nvarchar(max) NULL, InvoiceId int NULL REFERENCES Invoices(InvoiceId));
  CREATE UNIQUE INDEX IX_BillingDrafts_CitizenId_PeriodStart ON BillingDrafts(CitizenId,PeriodStart);
  CREATE INDEX IX_BillingDrafts_InvoiceId ON BillingDrafts(InvoiceId);
  CREATE INDEX IX_BillingDrafts_WardId ON BillingDrafts(WardId);
END;
IF OBJECT_ID('DriverWages','U') IS NULL
BEGIN
  CREATE TABLE DriverWages (
    DriverWageId int IDENTITY PRIMARY KEY, DriverId nvarchar(450) NOT NULL REFERENCES AspNetUsers(Id),
    PeriodStart datetime2 NOT NULL, PeriodEnd datetime2 NOT NULL,
    RoutesCompleted int NOT NULL, BinsCollected int NOT NULL, RequiredRoutes int NOT NULL, RequiredBins int NOT NULL,
    BaseAmount decimal(18,2) NOT NULL, PerBinAmount decimal(18,2) NOT NULL, BonusRate decimal(5,4) NOT NULL,
    BonusAmount decimal(18,2) NOT NULL, Amount decimal(18,2) NOT NULL, Status nvarchar(30) NOT NULL,
    ReleasedAt datetime2 NULL, ReleasedById nvarchar(max) NULL, DeferredAt datetime2 NULL, CollectedAt datetime2 NULL);
  CREATE UNIQUE INDEX IX_DriverWages_DriverId_PeriodStart ON DriverWages(DriverId,PeriodStart);
END;
IF OBJECT_ID('RouteActivities','U') IS NULL
BEGIN
  CREATE TABLE RouteActivities (
    RouteActivityId int IDENTITY PRIMARY KEY, RouteId int NOT NULL REFERENCES Routes(RouteId),
    ActorId nvarchar(450) NOT NULL REFERENCES AspNetUsers(Id), Action nvarchar(30) NOT NULL, CreatedAt datetime2 NOT NULL);
  CREATE INDEX IX_RouteActivities_ActorId_CreatedAt ON RouteActivities(ActorId,CreatedAt);
  CREATE INDEX IX_RouteActivities_RouteId ON RouteActivities(RouteId);
END;
IF OBJECT_ID('WageContributions','U') IS NULL
BEGIN
  CREATE TABLE WageContributions (
    WageContributionId int IDENTITY PRIMARY KEY, DriverWageId int NOT NULL REFERENCES DriverWages(DriverWageId),
    RouteId int NOT NULL REFERENCES Routes(RouteId), BinsCollected int NOT NULL, CompletedAt datetime2 NOT NULL);
  CREATE UNIQUE INDEX IX_WageContributions_RouteId ON WageContributions(RouteId);
  CREATE INDEX IX_WageContributions_DriverWageId ON WageContributions(DriverWageId);
END;
COMMIT;
