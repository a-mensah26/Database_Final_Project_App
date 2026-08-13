-- ============================================================
-- create_tables.sql
-- Defines all relational tables, constraints, and foreign keys.
-- ============================================================

USE HotelReservationSystem;

-- --- Drop Tables if they exist (ordered to avoid FK violations) ---
DROP TABLE IF EXISTS RESERVATION_REQUEST;
DROP TABLE IF EXISTS CUSTOMER_FEEDBACK;
DROP TABLE IF EXISTS RESTAURANT_ORDER;
DROP TABLE IF EXISTS INVOICE;
DROP TABLE IF EXISTS EVENT;
DROP TABLE IF EXISTS RESERVATION;
DROP TABLE IF EXISTS ROOM;
DROP TABLE IF EXISTS RESTAURANT;
DROP TABLE IF EXISTS CONFERENCE_HALL;
DROP TABLE IF EXISTS CUSTOMER;
DROP TABLE IF EXISTS FRONTDESK;
DROP TABLE IF EXISTS HOUSEKEEPING;
DROP TABLE IF EXISTS APP_USER;
DROP TABLE IF EXISTS STAFF;

-- ---------------- STAFF TABLE ----------------
CREATE TABLE STAFF (
    StaffID VARCHAR(5) PRIMARY KEY,
    StaffFName VARCHAR(20) NOT NULL,
    StaffLName VARCHAR(20) NOT NULL,
    StaffRole ENUM('Housekeeping','Front Desk') NOT NULL
);

-- ---------------- HOUSEKEEPING TABLE ----------------
CREATE TABLE HOUSEKEEPING (
    StaffID VARCHAR(5) PRIMARY KEY,
    Shift ENUM('Morning','Afternoon','Evening') NOT NULL,
    AssignedFloor INT NOT NULL CHECK (AssignedFloor BETWEEN 0 AND 20),
    CONSTRAINT fk_housekeeping_staff FOREIGN KEY (StaffID)
        REFERENCES STAFF(StaffID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------- FRONTDESK TABLE ----------------
CREATE TABLE FRONTDESK (
    StaffID VARCHAR(5) PRIMARY KEY,
    Shift ENUM('Morning','Afternoon','Evening') NOT NULL,
    CONSTRAINT fk_frontdesk_staff FOREIGN KEY (StaffID)
        REFERENCES STAFF(StaffID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------- CUSTOMER TABLE ----------------
CREATE TABLE CUSTOMER (
    CustomerID VARCHAR(5) PRIMARY KEY,
    CustomerFName VARCHAR(20) NOT NULL,
    CustomerLName VARCHAR(20) NOT NULL,
    PhoneNumber VARCHAR(10) NOT NULL
);

-- ---------------- CONFERENCE_HALL TABLE ----------------
CREATE TABLE CONFERENCE_HALL (
    HallID VARCHAR(5) PRIMARY KEY,
    HallName VARCHAR(50) NOT NULL,
    Capacity INT NOT NULL
);

-- ---------------- RESTAURANT TABLE ----------------
CREATE TABLE RESTAURANT (
    RestaurantID VARCHAR(5) PRIMARY KEY,
    RestaurantName VARCHAR(50) NOT NULL,
    SeatingCapacity INT NOT NULL
);

-- ---------------- ROOM TABLE ----------------
CREATE TABLE ROOM (
    RoomNo VARCHAR(5) PRIMARY KEY,
    RoomType VARCHAR(30) NOT NULL,
    RoomRate DECIMAL(10,2) NOT NULL,
    RoomStatus ENUM('Occupied','Vacant') NOT NULL,
    HousekeeperID VARCHAR(5),
    CONSTRAINT fk_room_housekeeper FOREIGN KEY (HousekeeperID)
        REFERENCES HOUSEKEEPING(StaffID) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ---------------- RESERVATION TABLE ----------------
CREATE TABLE RESERVATION (
    ReservationID VARCHAR(5) PRIMARY KEY,
    RoomID VARCHAR(5) NOT NULL,
    CustomerID VARCHAR(5) NOT NULL,
    StaffID VARCHAR(5) NOT NULL,
    CheckIn DATETIME NOT NULL,
    CheckOut DATETIME,
    CONSTRAINT fk_reservation_room FOREIGN KEY (RoomID)
        REFERENCES ROOM(RoomNo) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reservation_customer FOREIGN KEY (CustomerID)
        REFERENCES CUSTOMER(CustomerID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reservation_staff FOREIGN KEY (StaffID)
        REFERENCES FRONTDESK(StaffID) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ---------------- EVENT TABLE ----------------
CREATE TABLE EVENT (
    EventID VARCHAR(5) PRIMARY KEY,
    EventType ENUM('Wedding','Conference','Seminar','Networking Event','Birthday Party') NOT NULL,
    EventDate DATE NOT NULL,
    EventDuration DECIMAL(4,1) NOT NULL,
    Host VARCHAR(5) NOT NULL,
    HallID VARCHAR(5) NOT NULL,
    CONSTRAINT fk_event_hall FOREIGN KEY (HallID)
        REFERENCES CONFERENCE_HALL(HallID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_event_host FOREIGN KEY (Host)
        REFERENCES CUSTOMER(CustomerID) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ---------------- INVOICE TABLE ----------------
CREATE TABLE INVOICE (
    InvoiceNo VARCHAR(5) PRIMARY KEY,
    ReservationID VARCHAR(5),
    CustomerID VARCHAR(5) NOT NULL,
    AmountPayable DECIMAL(10,2) NOT NULL,
    AmountPaid DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_invoice_reservation FOREIGN KEY (ReservationID)
        REFERENCES RESERVATION(ReservationID) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_invoice_customer FOREIGN KEY (CustomerID)
        REFERENCES CUSTOMER(CustomerID) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ---------------- RESTAURANT_ORDER TABLE ----------------
CREATE TABLE RESTAURANT_ORDER (
    OrderID VARCHAR(5) PRIMARY KEY,
    CustomerID VARCHAR(5) NOT NULL,
    RestaurantID VARCHAR(5) NOT NULL,
    InvoiceID VARCHAR(5),
    OrderDetails TEXT NOT NULL,
    CONSTRAINT fk_order_customer FOREIGN KEY (CustomerID)
        REFERENCES CUSTOMER(CustomerID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_order_restaurant FOREIGN KEY (RestaurantID)
        REFERENCES RESTAURANT(RestaurantID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_order_invoice FOREIGN KEY (InvoiceID)
        REFERENCES INVOICE(InvoiceNo) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ---------------- CUSTOMER_FEEDBACK TABLE ----------------
CREATE TABLE CUSTOMER_FEEDBACK (
    FeedbackID VARCHAR(5) PRIMARY KEY,
    CustomerID VARCHAR(5) NOT NULL,
    Rating INT NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    Comments TEXT NOT NULL,
    FeedbackDate DATE NOT NULL,
    CONSTRAINT fk_feedback_customer FOREIGN KEY (CustomerID)
        REFERENCES CUSTOMER(CustomerID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------- RESERVATION_REQUEST TABLE ----------------
CREATE TABLE RESERVATION_REQUEST (
    RequestToken VARCHAR(6) PRIMARY KEY,
    CustomerID VARCHAR(5) NOT NULL,
    RoomType VARCHAR(30) NOT NULL,
    CheckIn DATETIME NOT NULL,
    CheckOut DATETIME NOT NULL,
    Status ENUM('Pending', 'Approved', 'Declined') NOT NULL DEFAULT 'Pending',
    RoomNo VARCHAR(5),
    StaffID VARCHAR(5),
    RequestDate DATE NOT NULL,
    CONSTRAINT fk_req_customer FOREIGN KEY (CustomerID) REFERENCES CUSTOMER(CustomerID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_req_room FOREIGN KEY (RoomNo) REFERENCES ROOM(RoomNo) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_req_staff FOREIGN KEY (StaffID) REFERENCES FRONTDESK(StaffID) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ---------------- APP_USER TABLE ----------------
CREATE TABLE APP_USER (
    UserID VARCHAR(5) PRIMARY KEY,
    Username VARCHAR(30) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    FullName VARCHAR(41) NOT NULL,
    Role ENUM('Front Desk','Manager') NOT NULL,
    StaffID VARCHAR(5),
    CONSTRAINT fk_appuser_staff FOREIGN KEY (StaffID)
        REFERENCES STAFF(StaffID) ON DELETE SET NULL ON UPDATE CASCADE
);
