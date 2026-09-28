-- Organization logo (stored in the configured storage driver, e.g. S3)
-- and invoice defaults that are copied onto new invoices.
-- Additive only: no existing data is modified.

ALTER TABLE `Organization`
  ADD COLUMN `logoKey` VARCHAR(191) NULL,
  ADD COLUMN `logoMimeType` VARCHAR(191) NULL,
  ADD COLUMN `logoUpdatedAt` DATETIME(3) NULL,
  ADD COLUMN `invoicePaymentInstructions` TEXT NULL,
  ADD COLUMN `invoiceDefaultNotes` TEXT NULL,
  ADD COLUMN `invoiceDefaultTerms` TEXT NULL;
