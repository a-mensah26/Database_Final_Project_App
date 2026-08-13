-- ============================================================
-- views.sql
-- Defines views for easy access to dashboard queries.
-- ============================================================

USE HotelReservationSystem;

-- ---------- VIEWS ----------
CREATE OR REPLACE VIEW vw_current_room_occupancy AS
SELECT
    rm.RoomNo, rm.RoomType, rm.RoomRate, rm.RoomStatus,
    r.ReservationID, c.CustomerID,
    CONCAT(c.CustomerFName, ' ', c.CustomerLName) AS GuestName,
    r.CheckIn, r.CheckOut
FROM ROOM rm
LEFT JOIN RESERVATION r ON r.RoomID = rm.RoomNo AND r.CheckOut IS NULL
LEFT JOIN CUSTOMER c ON c.CustomerID = r.CustomerID;

CREATE OR REPLACE VIEW vw_outstanding_invoices AS
SELECT
    i.InvoiceNo, i.CustomerID,
    CONCAT(c.CustomerFName, ' ', c.CustomerLName) AS CustomerName,
    i.ReservationID, i.AmountPayable, i.AmountPaid,
    (i.AmountPayable - i.AmountPaid) AS BalanceDue
FROM INVOICE i
JOIN CUSTOMER c ON c.CustomerID = i.CustomerID
WHERE i.AmountPaid < i.AmountPayable;

CREATE OR REPLACE VIEW vw_available_rooms AS
SELECT RoomNo, RoomType, RoomRate
FROM ROOM
WHERE RoomStatus = 'Vacant'
ORDER BY RoomType, RoomRate;

CREATE OR REPLACE VIEW vw_staff_directory AS
SELECT
    s.StaffID, CONCAT(s.StaffFName, ' ', s.StaffLName) AS StaffName,
    s.StaffRole, COALESCE(h.Shift, f.Shift) AS Shift, h.AssignedFloor
FROM STAFF s
LEFT JOIN HOUSEKEEPING h ON h.StaffID = s.StaffID
LEFT JOIN FRONTDESK f ON f.StaffID = s.StaffID;

CREATE OR REPLACE VIEW vw_upcoming_events AS
SELECT
    e.EventID, e.EventType, e.EventDate, e.EventDuration,
    ch.HallID, ch.HallName, ch.Capacity,
    c.CustomerID AS HostID,
    CONCAT(c.CustomerFName, ' ', c.CustomerLName) AS HostName
FROM EVENT e
JOIN CONFERENCE_HALL ch ON ch.HallID = e.HallID
JOIN CUSTOMER c ON c.CustomerID = e.Host
WHERE e.EventDate >= CURDATE()
ORDER BY e.EventDate;
