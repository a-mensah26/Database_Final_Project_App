-- ============================================================
-- 04_roles_and_grants.sql — DB users backing Phase 7 security roles
--
-- The Phase 6 transcript already contains the GRANT statements for
-- hotel_front_desk and hotel_manager; CREATE USER wasn't shown, so it's
-- added here. CHANGE THESE PASSWORDS before using outside a local/dev
-- environment, and put the real values in backend/.env (see config.py) —
-- never commit real credentials.
--
-- The web app uses these THREE MySQL users directly:
--   hotel_auth        -> only reads APP_USER, to check a login
--   hotel_front_desk   -> everything a Front Desk session runs
--   hotel_manager       -> everything a Manager session runs
-- This means privilege enforcement happens at the database layer (per
-- Phase 1 non-functional requirements), not just in the Flask code.
-- ============================================================

CREATE USER IF NOT EXISTS 'hotel_auth'@'localhost' IDENTIFIED BY 'CHANGE_ME_auth';
GRANT SELECT, INSERT ON HotelReservationSystem.APP_USER TO 'hotel_auth'@'localhost';
GRANT SELECT, INSERT ON HotelReservationSystem.STAFF TO 'hotel_auth'@'localhost';
GRANT SELECT, INSERT ON HotelReservationSystem.FRONTDESK TO 'hotel_auth'@'localhost';
GRANT SELECT ON HotelReservationSystem.ROOM TO 'hotel_auth'@'localhost';
GRANT SELECT ON HotelReservationSystem.EVENT TO 'hotel_auth'@'localhost';
GRANT SELECT, INSERT ON HotelReservationSystem.CUSTOMER TO 'hotel_auth'@'localhost';
GRANT SELECT ON HotelReservationSystem.CONFERENCE_HALL TO 'hotel_auth'@'localhost';
GRANT SELECT ON HotelReservationSystem.vw_available_rooms TO 'hotel_auth'@'localhost';
GRANT SELECT ON HotelReservationSystem.vw_upcoming_events TO 'hotel_auth'@'localhost';
GRANT SELECT, INSERT, UPDATE ON HotelReservationSystem.RESERVATION_REQUEST TO 'hotel_auth'@'localhost';

CREATE USER IF NOT EXISTS 'hotel_front_desk'@'localhost' IDENTIFIED BY 'CHANGE_ME_frontdesk';
CREATE USER IF NOT EXISTS 'hotel_manager'@'localhost' IDENTIFIED BY 'CHANGE_ME_manager';

-- ---- Front Desk (from Phase 6) ----
GRANT SELECT, INSERT, UPDATE ON HotelReservationSystem.CUSTOMER TO 'hotel_front_desk'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON HotelReservationSystem.RESERVATION TO 'hotel_front_desk'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON HotelReservationSystem.RESERVATION_REQUEST TO 'hotel_front_desk'@'localhost';
GRANT SELECT ON HotelReservationSystem.ROOM TO 'hotel_front_desk'@'localhost';
GRANT UPDATE (RoomStatus) ON HotelReservationSystem.ROOM TO 'hotel_front_desk'@'localhost';
GRANT SELECT ON HotelReservationSystem.STAFF TO 'hotel_front_desk'@'localhost';
GRANT SELECT ON HotelReservationSystem.CONFERENCE_HALL TO 'hotel_front_desk'@'localhost';
GRANT SELECT ON HotelReservationSystem.RESTAURANT TO 'hotel_front_desk'@'localhost';
GRANT SELECT, INSERT ON HotelReservationSystem.EVENT TO 'hotel_front_desk'@'localhost';
GRANT SELECT, INSERT, UPDATE ON HotelReservationSystem.RESTAURANT_ORDER TO 'hotel_front_desk'@'localhost';
GRANT SELECT, INSERT ON HotelReservationSystem.CUSTOMER_FEEDBACK TO 'hotel_front_desk'@'localhost';
GRANT SELECT ON HotelReservationSystem.vw_current_room_occupancy TO 'hotel_front_desk'@'localhost';
GRANT SELECT ON HotelReservationSystem.vw_available_rooms TO 'hotel_front_desk'@'localhost';
GRANT SELECT ON HotelReservationSystem.vw_upcoming_events TO 'hotel_front_desk'@'localhost';
GRANT EXECUTE ON PROCEDURE HotelReservationSystem.sp_add_customer TO 'hotel_front_desk'@'localhost';
GRANT EXECUTE ON PROCEDURE HotelReservationSystem.sp_update_room_status TO 'hotel_front_desk'@'localhost';
GRANT EXECUTE ON PROCEDURE HotelReservationSystem.sp_get_customer_reservations TO 'hotel_front_desk'@'localhost';
GRANT EXECUTE ON FUNCTION HotelReservationSystem.fn_full_name TO 'hotel_front_desk'@'localhost';
GRANT EXECUTE ON FUNCTION HotelReservationSystem.fn_room_occupancy_rate TO 'hotel_front_desk'@'localhost';

-- ---- Manager (from Phase 6) ----
GRANT ALL PRIVILEGES ON HotelReservationSystem.* TO 'hotel_manager'@'localhost';

FLUSH PRIVILEGES;
