-- ============================================================
-- 03_app_auth.sql — application login table
--
-- The Phase 4-6 schema has no username/password anywhere (STAFF just
-- identifies who's who), and it has no "Manager" role at all — only the
-- hotel_manager DB role from the Phase 6 GRANTs. To give the web app a
-- real login screen, this adds one small table that is NOT part of the
-- graded schema: it just maps a login to a Front Desk / Manager role and,
-- for front desk users, to their StaffID so reservations they create are
-- attributed correctly.
-- ============================================================
USE HotelReservationSystem;

CREATE TABLE IF NOT EXISTS APP_USER (
    UserID VARCHAR(5) PRIMARY KEY,
    Username VARCHAR(30) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    FullName VARCHAR(41) NOT NULL,
    Role ENUM('Front Desk','Manager') NOT NULL,
    StaffID VARCHAR(5),
    CONSTRAINT fk_appuser_staff FOREIGN KEY (StaffID)
        REFERENCES STAFF(StaffID) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Seed accounts (passwords are hashed by seed_users.py — see backend/README).
-- Placeholder rows below are overwritten by that script; left here only so
-- the table's shape/intent is documented in the SQL itself.
-- Demo logins created by seed_users.py:
--   frontdesk / frontdesk123   -> Role = Front Desk, StaffID = FD01
--   manager   / manager123     -> Role = Manager,    StaffID = NULL
