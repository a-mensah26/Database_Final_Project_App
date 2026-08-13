-- ============================================================
-- 02_views_procs_triggers.sql — programming layer used by the API
-- (subset of Phase 6 objects that the web app calls directly)
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

-- ---------- STORED PROCEDURES ----------
DELIMITER //

DROP PROCEDURE IF EXISTS sp_get_customer_reservations //
CREATE PROCEDURE sp_get_customer_reservations(IN p_customerid VARCHAR(5))
BEGIN
    SELECT ReservationID, RoomID, CheckIn, CheckOut
    FROM RESERVATION
    WHERE CustomerID = p_customerid;
END //

DROP PROCEDURE IF EXISTS sp_update_room_status //
CREATE PROCEDURE sp_update_room_status(IN p_roomno VARCHAR(5), IN p_status VARCHAR(10))
BEGIN
    UPDATE ROOM SET RoomStatus = p_status WHERE RoomNo = p_roomno;
END //

DROP PROCEDURE IF EXISTS sp_add_customer //
CREATE PROCEDURE sp_add_customer(
    IN p_customerid VARCHAR(5), IN p_fname VARCHAR(20),
    IN p_lname VARCHAR(20), IN p_phone VARCHAR(10)
)
BEGIN
    INSERT INTO CUSTOMER (CustomerID, CustomerFName, CustomerLName, PhoneNumber)
    VALUES (p_customerid, p_fname, p_lname, p_phone);
END //

DELIMITER ;

-- ---------- USER DEFINED FUNCTIONS ----------
DELIMITER //

DROP FUNCTION IF EXISTS fn_full_name //
CREATE FUNCTION fn_full_name(p_fname VARCHAR(20), p_lname VARCHAR(20))
RETURNS VARCHAR(41)
DETERMINISTIC
RETURN CONCAT(p_fname, ' ', p_lname) //

DROP FUNCTION IF EXISTS fn_room_tax //
CREATE FUNCTION fn_room_tax(p_rate DECIMAL(10,2))
RETURNS DECIMAL(10,2)
DETERMINISTIC
RETURN p_rate * 0.125 //

DROP FUNCTION IF EXISTS fn_room_occupancy_rate //
CREATE FUNCTION fn_room_occupancy_rate()
RETURNS DECIMAL(5,2)
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_total INT;
    DECLARE v_occupied INT;

    SELECT COUNT(*), SUM(CASE WHEN RoomStatus = 'Occupied' THEN 1 ELSE 0 END)
        INTO v_total, v_occupied
    FROM ROOM;

    IF v_total = 0 THEN
        RETURN 0;
    END IF;

    RETURN ROUND((v_occupied / v_total) * 100, 2);
END //

DELIMITER ;

-- ---------- TRIGGERS ----------
DELIMITER //

DROP TRIGGER IF EXISTS trg_checkout_after_checkin //
CREATE TRIGGER trg_checkout_after_checkin
BEFORE INSERT ON RESERVATION
FOR EACH ROW
BEGIN
    IF NEW.CheckOut IS NOT NULL AND NEW.CheckOut <= NEW.CheckIn THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out must be after check-in.';
    END IF;
END //

DROP TRIGGER IF EXISTS trg_prevent_completed_delete //
CREATE TRIGGER trg_prevent_completed_delete
BEFORE DELETE ON RESERVATION
FOR EACH ROW
BEGIN
    IF OLD.CheckOut IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete a completed booking.';
    END IF;
END //

DROP TRIGGER IF EXISTS trg_prevent_room_delete //
CREATE TRIGGER trg_prevent_room_delete
BEFORE DELETE ON ROOM
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rooms cannot be deleted directly. Contact a front desk staff.' //

DELIMITER ;
