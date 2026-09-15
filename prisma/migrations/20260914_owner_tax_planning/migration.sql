-- LedgerFlow owner-level tax planning migration.
--
-- This migration is additive only. It does NOT drop or alter existing
-- financial rows. All new columns are nullable or have safe defaults so
-- existing organizations keep working unchanged.
--
-- Run with:
--   npx prisma migrate deploy
-- or:
--   npx prisma migrate resolve --applied 20260914_owner_tax_planning

-- ---------------------------------------------------------
-- Owner: per-owner tax planning fields
-- ---------------------------------------------------------
ALTER TABLE `Owner`
  ADD COLUMN `stateReserveRate` DECIMAL(6,3) NULL,
  ADD COLUMN `residenceState` VARCHAR(191) NULL,
  ADD COLUMN `filingStatus` ENUM('SINGLE','MARRIED_JOINT','MARRIED_SEPARATE','HEAD_OF_HOUSEHOLD','QUALIFYING_SURVIVING_SPOUSE') NULL,
  ADD COLUMN `planningAssumptions` JSON NULL;

-- ---------------------------------------------------------
-- Organization: tax planning mode + earmarked reserve
-- ---------------------------------------------------------
ALTER TABLE `Organization`
  ADD COLUMN `taxPlanningMode` ENUM('SIMPLE','ADVANCED') NOT NULL DEFAULT 'SIMPLE',
  ADD COLUMN `taxPlanningYear` INT NOT NULL DEFAULT 2026,
  ADD COLUMN `taxReserveEarmarked` DECIMAL(18,2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------
-- TaxProfile: planning mode
-- ---------------------------------------------------------
ALTER TABLE `TaxProfile`
  ADD COLUMN `mode` ENUM('SIMPLE','ADVANCED') NOT NULL DEFAULT 'SIMPLE';

-- ---------------------------------------------------------
-- TaxPayment: optional owner + tax year + period
-- ---------------------------------------------------------
ALTER TABLE `TaxPayment`
  ADD COLUMN `ownerId` VARCHAR(191) NULL,
  ADD COLUMN `taxYear` INT NULL,
  ADD COLUMN `taxPeriod` VARCHAR(191) NULL;

CREATE INDEX `TaxPayment_organizationId_ownerId_idx` ON `TaxPayment`(`organizationId`, `ownerId`);
CREATE INDEX `TaxPayment_organizationId_taxYear_idx` ON `TaxPayment`(`organizationId`, `taxYear`);

ALTER TABLE `TaxPayment`
  ADD CONSTRAINT `TaxPayment_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------
-- TaxEstimate: replace basic estimate with historical snapshot model
-- ---------------------------------------------------------
-- Drop the unique constraint on (organizationId, year) so multiple snapshots
-- can exist for the same year. Old rows are preserved.
ALTER TABLE `TaxEstimate` DROP INDEX `TaxEstimate_organizationId_year_key`;

ALTER TABLE `TaxEstimate`
  ADD COLUMN `ownerId` VARCHAR(191) NULL,
  ADD COLUMN `asOfDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `allocatedOwnerProfit` DECIMAL(18,2) NULL,
  ADD COLUMN `federalEstimate` DECIMAL(18,2) NULL,
  ADD COLUMN `stateEstimate` DECIMAL(18,2) NULL,
  ADD COLUMN `seEstimate` DECIMAL(18,2) NULL,
  ADD COLUMN `otherEstimate` DECIMAL(18,2) NULL,
  ADD COLUMN `totalEstimate` DECIMAL(18,2) NULL,
  ADD COLUMN `assumptions` JSON NULL,
  ADD COLUMN `calculationVersion` VARCHAR(191) NOT NULL DEFAULT 'v1';

-- Preserve historical name compat: keep `estimatedProfit` column existing.
-- Application will read from either `estimatedBusinessProfit` (new) or fall
-- back gracefully. Alias by adding new column and copying old values.
ALTER TABLE `TaxEstimate`
  ADD COLUMN `estimatedBusinessProfit` DECIMAL(18,2) NOT NULL DEFAULT 0;

UPDATE `TaxEstimate` SET `estimatedBusinessProfit` = `estimatedProfit`;

ALTER TABLE `TaxEstimate` DROP COLUMN `estimatedProfit`;

CREATE INDEX `TaxEstimate_organizationId_year_idx` ON `TaxEstimate`(`organizationId`, `year`);
CREATE INDEX `TaxEstimate_organizationId_ownerId_year_idx` ON `TaxEstimate`(`organizationId`, `ownerId`, `year`);

ALTER TABLE `TaxEstimate`
  ADD CONSTRAINT `TaxEstimate_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------
-- FinancialAccount: lightweight account abstraction for tax reserve
-- balances and future bank sync.
-- ---------------------------------------------------------
CREATE TABLE `FinancialAccount` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `institution` VARCHAR(191) NULL,
  `type` ENUM('CHECKING','SAVINGS','CREDIT_CARD','LOAN','OTHER') NOT NULL DEFAULT 'CHECKING',
  `purpose` ENUM('OPERATING','TAX_RESERVE','SAVINGS','OTHER') NOT NULL DEFAULT 'OPERATING',
  `lastFour` VARCHAR(191) NULL,
  `currentManualBalance` DECIMAL(18,2) NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
  `externalProvider` VARCHAR(191) NULL,
  `externalAccountId` VARCHAR(191) NULL,
  `syncStatus` ENUM('MANUAL','PENDING','SYNCED','DISCONNECTED') NOT NULL DEFAULT 'MANUAL',
  `lastSyncedAt` DATETIME(3) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `FinancialAccount_organizationId_idx` (`organizationId`),
  INDEX `FinancialAccount_organizationId_purpose_idx` (`organizationId`, `purpose`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FinancialAccount`
  ADD CONSTRAINT `FinancialAccount_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
