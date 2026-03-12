DO $$ BEGIN
  CREATE TYPE "PhotoUploadStatus" AS ENUM (
    'PENDING',
    'UPLOADING',
    'READY',
    'PROCESSING',
    'FAILED',
    'DELETED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PhotoAssetRole" AS ENUM (
    'ORIGINAL',
    'PROCESSED',
    'THUMBNAIL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Photo"
  ALTER COLUMN "url" DROP NOT NULL;

ALTER TABLE "Photo"
  ADD COLUMN IF NOT EXISTS "storageBucket" TEXT,
  ADD COLUMN IF NOT EXISTS "storageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "PhotoAssetRole" NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN IF NOT EXISTS "uploadStatus" "PhotoUploadStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "originalFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "mimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "width" INTEGER,
  ADD COLUMN IF NOT EXISTS "height" INTEGER,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "uploadedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

UPDATE "Photo"
SET
  "storageBucket" = COALESCE("storageBucket", 'omniseller-images'),
  "storageKey" = COALESCE("storageKey", CONCAT('legacy/', "id")),
  "uploadStatus" = CASE
    WHEN "deletedAt" IS NOT NULL THEN 'DELETED'::"PhotoUploadStatus"
    ELSE 'READY'::"PhotoUploadStatus"
  END,
  "uploadedAt" = COALESCE("uploadedAt", "createdAt")
WHERE
  "storageBucket" IS NULL
  OR "storageKey" IS NULL
  OR "uploadedAt" IS NULL
  OR "uploadStatus" <> 'READY'::"PhotoUploadStatus";

ALTER TABLE "Photo"
  ALTER COLUMN "storageBucket" SET NOT NULL,
  ALTER COLUMN "storageKey" SET NOT NULL;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "inventoryItemId"
      ORDER BY "sort" ASC, "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "Photo"
  WHERE "deletedAt" IS NULL
)
UPDATE "Photo" p
SET "isPrimary" = ranked.rn = 1
FROM ranked
WHERE p."id" = ranked."id";

CREATE UNIQUE INDEX IF NOT EXISTS "Photo_storageKey_key"
  ON "Photo"("storageKey");

CREATE INDEX IF NOT EXISTS "Photo_inventoryItemId_deletedAt_idx"
  ON "Photo"("inventoryItemId", "deletedAt");

CREATE INDEX IF NOT EXISTS "Photo_inventoryItemId_sort_idx"
  ON "Photo"("inventoryItemId", "sort");

CREATE INDEX IF NOT EXISTS "Photo_inventoryItemId_isPrimary_idx"
  ON "Photo"("inventoryItemId", "isPrimary");

CREATE INDEX IF NOT EXISTS "Photo_uploadStatus_idx"
  ON "Photo"("uploadStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "Photo_one_primary_per_item_idx"
  ON "Photo"("inventoryItemId")
  WHERE "isPrimary" = true AND "deletedAt" IS NULL;
