-- The init migration omitted these foreign keys although the schema declares the relations (found with prisma migrate diff).
-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

