CREATE TYPE "Role" AS ENUM ('SYSTEM_ADMIN', 'EMERGENCY_COORDINATOR', 'RELIEF_ORGANIZATION', 'VOLUNTEER', 'SHELTER_MANAGER');

CREATE TYPE "IncidentCategory" AS ENUM ('FLOOD', 'CYCLONE', 'EARTHQUAKE', 'FIRE', 'LANDSLIDE', 'INFRASTRUCTURE_FAILURE');

CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "RequestType" AS ENUM ('FOOD', 'WATER', 'MEDICAL', 'SHELTER', 'RESCUE', 'TRANSPORT');

CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'VERIFIED', 'ASSIGNED', 'COMPLETED', 'REJECTED');

CREATE TYPE "ResourceCategory" AS ENUM ('FOOD', 'WATER', 'MEDICAL', 'EMERGENCY_KIT', 'BLANKET', 'RESCUE_EQUIPMENT', 'TRANSPORT');

CREATE TYPE "MovementType" AS ENUM ('REGISTER', 'RESTOCK', 'ALLOCATE', 'RELEASE', 'ADJUST', 'TRANSFER_IN', 'TRANSFER_OUT');

CREATE TYPE "AllocationStatus" AS ENUM ('ALLOCATED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

CREATE TYPE "ShelterStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED');

CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'DEPLOYED', 'UNAVAILABLE');

CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "contact" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "organizationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "IncidentCategory" NOT NULL,
  "location" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "severity" INTEGER NOT NULL,
  "locationRisk" INTEGER NOT NULL DEFAULT 3,
  "affectedPopulation" INTEGER NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
  "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "priorityLevel" "PriorityLevel" NOT NULL DEFAULT 'LOW',
  "priorityOverride" "PriorityLevel",
  "imageUrl" TEXT,
  "coordinatorId" TEXT,
  "reportedById" TEXT,
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "firstResponseAt" TIMESTAMP(3),
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyRequest" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT,
  "organizationId" TEXT,
  "type" "RequestType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'units',
  "location" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "urgency" INTEGER NOT NULL,
  "affectedPeople" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "requesterName" TEXT NOT NULL,
  "requesterContact" TEXT,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "priorityLevel" "PriorityLevel" NOT NULL DEFAULT 'LOW',
  "dedupeKey" TEXT NOT NULL,
  "verifiedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "firstResponseAt" TIMESTAMP(3),
  CONSTRAINT "EmergencyRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Resource" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "ResourceCategory" NOT NULL,
  "unit" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "totalReceived" INTEGER NOT NULL DEFAULT 0,
  "storageLocation" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "type" "MovementType" NOT NULL,
  "delta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reason" TEXT,
  "fromLocation" TEXT,
  "toLocation" TEXT,
  "allocationId" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Allocation" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "AllocationStatus" NOT NULL DEFAULT 'ALLOCATED',
  "qrToken" TEXT NOT NULL,
  "allocatedById" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributionRecord" (
  "id" TEXT NOT NULL,
  "allocationId" TEXT NOT NULL,
  "status" "AllocationStatus" NOT NULL,
  "deliveredQty" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "submittedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DistributionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shelter" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "totalCapacity" INTEGER NOT NULL,
  "occupancy" INTEGER NOT NULL DEFAULT 0,
  "facilities" TEXT[] NOT NULL,
  "status" "ShelterStatus" NOT NULL DEFAULT 'OPEN',
  "managerId" TEXT,
  "organizationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shelter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShelterOccupancyLog" (
  "id" TEXT NOT NULL,
  "shelterId" TEXT NOT NULL,
  "previous" INTEGER NOT NULL,
  "current" INTEGER NOT NULL,
  "capacity" INTEGER NOT NULL,
  "note" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShelterOccupancyLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Volunteer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "skills" TEXT[] NOT NULL,
  "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "teamId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "organizationId" TEXT,
  "incidentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'STANDBY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
  "incidentId" TEXT,
  "requestId" TEXT,
  "teamId" TEXT,
  "volunteerId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldReport" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "volunteerId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "photoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

CREATE INDEX "User_role_idx" ON "User"("role");

CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE INDEX "Incident_status_priorityScore_idx" ON "Incident"("status", "priorityScore" DESC);

CREATE INDEX "Incident_category_idx" ON "Incident"("category");

CREATE INDEX "Incident_reportedAt_idx" ON "Incident"("reportedAt");

CREATE INDEX "Incident_coordinatorId_idx" ON "Incident"("coordinatorId");

CREATE INDEX "EmergencyRequest_status_priorityScore_idx" ON "EmergencyRequest"("status", "priorityScore" DESC);

CREATE INDEX "EmergencyRequest_type_idx" ON "EmergencyRequest"("type");

CREATE INDEX "EmergencyRequest_incidentId_idx" ON "EmergencyRequest"("incidentId");

CREATE INDEX "EmergencyRequest_dedupeKey_idx" ON "EmergencyRequest"("dedupeKey");

CREATE INDEX "EmergencyRequest_createdAt_idx" ON "EmergencyRequest"("createdAt");

CREATE INDEX "Resource_organizationId_category_idx" ON "Resource"("organizationId", "category");

CREATE INDEX "Resource_category_quantity_idx" ON "Resource"("category", "quantity");

CREATE INDEX "StockMovement_resourceId_createdAt_idx" ON "StockMovement"("resourceId", "createdAt");

CREATE INDEX "Allocation_requestId_idx" ON "Allocation"("requestId");

CREATE INDEX "Allocation_resourceId_idx" ON "Allocation"("resourceId");

CREATE INDEX "Allocation_organizationId_status_idx" ON "Allocation"("organizationId", "status");

CREATE UNIQUE INDEX "Allocation_qrToken_key" ON "Allocation"("qrToken");

CREATE INDEX "DistributionRecord_allocationId_createdAt_idx" ON "DistributionRecord"("allocationId", "createdAt");

CREATE INDEX "Shelter_status_idx" ON "Shelter"("status");

CREATE INDEX "Shelter_managerId_idx" ON "Shelter"("managerId");

CREATE INDEX "ShelterOccupancyLog_shelterId_createdAt_idx" ON "ShelterOccupancyLog"("shelterId", "createdAt");

CREATE INDEX "Volunteer_availability_idx" ON "Volunteer"("availability");

CREATE INDEX "Volunteer_teamId_idx" ON "Volunteer"("teamId");

CREATE UNIQUE INDEX "Volunteer_userId_key" ON "Volunteer"("userId");

CREATE INDEX "Task_volunteerId_status_idx" ON "Task"("volunteerId", "status");

CREATE INDEX "Task_incidentId_idx" ON "Task"("incidentId");

CREATE INDEX "FieldReport_taskId_idx" ON "FieldReport"("taskId");

CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Resource" ADD CONSTRAINT "Resource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EmergencyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributionRecord" ADD CONSTRAINT "DistributionRecord_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shelter" ADD CONSTRAINT "Shelter_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Shelter" ADD CONSTRAINT "Shelter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShelterOccupancyLog" ADD CONSTRAINT "ShelterOccupancyLog_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "Shelter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Team" ADD CONSTRAINT "Team_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EmergencyRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data-integrity guards enforced by the database itself (defence in depth)
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_quantity_nonneg" CHECK ("quantity" >= 0);
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_quantity_pos" CHECK ("quantity" > 0);
ALTER TABLE "Shelter" ADD CONSTRAINT "Shelter_capacity_pos" CHECK ("totalCapacity" > 0);
ALTER TABLE "Shelter" ADD CONSTRAINT "Shelter_occupancy_range" CHECK ("occupancy" >= 0 AND "occupancy" <= "totalCapacity");
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_severity_range" CHECK ("severity" BETWEEN 1 AND 5);
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "Request_urgency_range" CHECK ("urgency" BETWEEN 1 AND 5);

-- Distribution records are an immutable ledger
CREATE OR REPLACE FUNCTION reliefgrid_block_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'DistributionRecord is immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DistributionRecord_immutable" BEFORE UPDATE OR DELETE ON "DistributionRecord"
  FOR EACH ROW EXECUTE FUNCTION reliefgrid_block_mutation();
