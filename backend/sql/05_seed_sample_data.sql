-- ============================================================
-- 05_seed_sample_data.sql — OPTIONAL
--
-- Only run this if you're setting the app up against a brand-new,
-- empty database. If you're pointing it at the MariaDB instance you
-- already populated in Phases 4-6, skip this file entirely — your
-- existing 30-row dataset is what the app will read and write.
-- ============================================================
USE HotelReservationSystem;

INSERT INTO STAFF (StaffID, StaffFName, StaffLName, StaffRole) VALUES
('HK01','Elikem','Kyei','Housekeeping'),
('FD01','Rita','Danso','Front Desk'),
('FD02','Yaw','Sackey','Front Desk');

INSERT INTO HOUSEKEEPING (StaffID, Shift, AssignedFloor) VALUES
('HK01','Morning',1);

INSERT INTO FRONTDESK (StaffID, Shift) VALUES
('FD01','Morning'),
('FD02','Afternoon');

INSERT INTO CUSTOMER (CustomerID, CustomerFName, CustomerLName, PhoneNumber) VALUES
('CU01','Kwame','Mensah','0246292423'),
('CU02','Ama','Owusu','0555491946');

INSERT INTO CONFERENCE_HALL (HallID, HallName, Capacity) VALUES
('CH01','Grand Ballroom',500),
('CH02','Kente Hall',150);

INSERT INTO RESTAURANT (RestaurantID, RestaurantName, SeatingCapacity) VALUES
('RT01','The Terrace Restaurant',120);

INSERT INTO ROOM (RoomNo, RoomType, RoomRate, RoomStatus, HousekeeperID) VALUES
('R101','Single',275.00,'Occupied','HK01'),
('R102','Double',350.00,'Vacant','HK01');

INSERT INTO RESERVATION (ReservationID, RoomID, CustomerID, StaffID, CheckIn, CheckOut) VALUES
('RES01','R101','CU01','FD01','2026-08-01 14:00:00',NULL);

INSERT INTO EVENT (EventID, EventType, EventDate, EventDuration, Host, HallID) VALUES
('EV01','Wedding','2026-09-02',4.0,'CU01','CH01');

INSERT INTO INVOICE (InvoiceNo, ReservationID, CustomerID, AmountPayable, AmountPaid) VALUES
('INV01','RES01','CU01',1100.00,500.00);
