-- ============================================================
-- triggers.sql
-- Defines database triggers to maintain consistency and business rules.
-- ============================================================

USE HotelReservationSystem;

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

DROP TRIGGER IF EXISTS trg_checkout_after_checkin_update //
CREATE TRIGGER trg_checkout_after_checkin_update
BEFORE UPDATE ON RESERVATION
FOR EACH ROW
BEGIN
    IF NEW.CheckOut IS NOT NULL AND NEW.CheckOut <= NEW.CheckIn THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out must be after check-in.';
    END IF;
END //

DROP TRIGGER IF EXISTS trg_reservation_insert_room_status //
CREATE TRIGGER trg_reservation_insert_room_status
AFTER INSERT ON RESERVATION
FOR EACH ROW
BEGIN
    IF NEW.CheckOut IS NULL THEN
        UPDATE ROOM SET RoomStatus = 'Occupied' WHERE RoomNo = NEW.RoomID;
    ELSE
        UPDATE ROOM SET RoomStatus = 'Vacant' WHERE RoomNo = NEW.RoomID;
    END IF;
END //

DROP TRIGGER IF EXISTS trg_reservation_update_room_status //
CREATE TRIGGER trg_reservation_update_room_status
AFTER UPDATE ON RESERVATION
FOR EACH ROW
BEGIN
    IF NEW.CheckOut IS NULL THEN
        UPDATE ROOM SET RoomStatus = 'Occupied' WHERE RoomNo = NEW.RoomID;
    ELSE
        UPDATE ROOM SET RoomStatus = 'Vacant' WHERE RoomNo = NEW.RoomID;
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
