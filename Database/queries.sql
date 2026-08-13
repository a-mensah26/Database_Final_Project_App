-- ============================================================
-- queries.sql
-- Sample SQL queries showing SELECT, JOIN, Aggregates, and Subqueries
-- as required by the Ashesi University CS323 Database project.
-- ============================================================

USE HotelReservationSystem;

-- ------------------------------------------------------------
-- 1. BASIC SELECT QUERIES
-- ------------------------------------------------------------

-- List all customers and their phone numbers
SELECT CustomerID, CustomerFName, CustomerLName, PhoneNumber 
FROM CUSTOMER;

-- List all vacant rooms with rates under GH₵ 300
SELECT RoomNo, RoomType, RoomRate 
FROM ROOM 
WHERE RoomStatus = 'Vacant' AND RoomRate < 300.00;

-- ------------------------------------------------------------
-- 2. JOIN QUERIES
-- ------------------------------------------------------------

-- List all rooms along with their assigned housekeeper's name
SELECT r.RoomNo, r.RoomType, r.RoomRate, r.RoomStatus,
       CONCAT(s.StaffFName, ' ', s.StaffLName) AS HousekeeperName
FROM ROOM r
LEFT JOIN STAFF s ON s.StaffID = r.HousekeeperID;

-- Retrieve active reservations showing customer and room details
SELECT res.ReservationID, res.RoomID, 
       CONCAT(c.CustomerFName, ' ', c.CustomerLName) AS GuestName,
       res.CheckIn, res.CheckOut
FROM RESERVATION res
JOIN CUSTOMER c ON c.CustomerID = res.CustomerID
WHERE res.CheckOut IS NULL;

-- ------------------------------------------------------------
-- 3. AGGREGATE QUERIES (with GROUP BY / HAVING)
-- ------------------------------------------------------------

-- Count rooms and average rate grouped by RoomType
SELECT RoomType, 
       COUNT(*) AS TotalRooms, 
       ROUND(AVG(RoomRate), 2) AS AverageRate
FROM ROOM
GROUP BY RoomType;

-- Total number of hours booked for each conference hall, having total duration > 2 hours
SELECT ch.HallName, SUM(e.EventDuration) AS TotalHoursBooked
FROM EVENT e
JOIN CONFERENCE_HALL ch ON ch.HallID = e.HallID
GROUP BY ch.HallName
HAVING SUM(e.EventDuration) > 2.0;

-- ------------------------------------------------------------
-- 4. SUBQUERIES
-- ------------------------------------------------------------

-- Find all rooms whose rate is higher than the average room rate
SELECT RoomNo, RoomType, RoomRate
FROM ROOM
WHERE RoomRate > (SELECT AVG(RoomRate) FROM ROOM);

-- Find customers who have made restaurant orders of a specific item (e.g. Jollof)
SELECT CustomerID, CustomerFName, CustomerLName
FROM CUSTOMER
WHERE CustomerID IN (
    SELECT DISTINCT CustomerID 
    FROM RESTAURANT_ORDER 
    WHERE OrderDetails LIKE '%Jollof%'
);
