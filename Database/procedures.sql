-- ============================================================
-- procedures.sql
-- Defines stored procedures and user-defined functions.
-- ============================================================

USE HotelReservationSystem;

DELIMITER //

-- ---------- STORED PROCEDURES ----------

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

-- ---------- USER DEFINED FUNCTIONS ----------

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
