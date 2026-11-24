-- Volunteer profiles created by an admin (or by a role change) start with no skills instead of violating NOT NULL.
ALTER TABLE "Volunteer" ALTER COLUMN "skills" SET DEFAULT ARRAY[]::TEXT[];
