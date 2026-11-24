-- Images move from the local filesystem (not served after build, read-only on serverless hosts) into Postgres.
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity guard in addition to the route's checks
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_size_range" CHECK ("size" > 0 AND "size" <= 5242880 AND octet_length("data") = "size");
