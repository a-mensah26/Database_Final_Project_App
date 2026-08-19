from flask import Blueprint, request, jsonify

from auth import role_required
from routes.shared_routes import run, ok_or_error, new_id

manager_bp = Blueprint("manager", __name__)


# ---------------- Staff ----------------


@manager_bp.route("/staff", methods=["GET"])
@role_required("Manager")
def list_staff():
    data, err = run("SELECT * FROM vw_staff_directory ORDER BY StaffID")
    return ok_or_error(data, err)


@manager_bp.route("/staff", methods=["POST"])
@role_required("Manager")
def add_staff():
    body = request.get_json(silent=True) or {}
    fname, lname, role = body.get("fname"), body.get("lname"), body.get("role")
    shift, floor = body.get("shift"), body.get("floor")
    if not all([fname, lname, role, shift]):
        return jsonify({"error": "fname, lname, role and shift are required."}), 400

    prefix = "HK" if role == "Housekeeping" else "FD"
    staff_id = body.get("staff_id") or new_id(prefix, 2)

    _, err = run(
        "INSERT INTO STAFF (StaffID, StaffFName, StaffLName, StaffRole) VALUES (%s,%s,%s,%s)",
        (staff_id, fname, lname, role),
        fetch="none",
    )
    if err:
        return ok_or_error(None, err)

    if role == "Housekeeping":
        _, err = run(
            "INSERT INTO HOUSEKEEPING (StaffID, Shift, AssignedFloor) VALUES (%s,%s,%s)",
            (staff_id, shift, floor or 0),
            fetch="none",
        )
    else:
        _, err = run(
            "INSERT INTO FRONTDESK (StaffID, Shift) VALUES (%s,%s)",
            (staff_id, shift),
            fetch="none",
        )
    if err:
        return ok_or_error(None, err)
    return jsonify({"staff_id": staff_id}), 201


@manager_bp.route("/staff/<staff_id>", methods=["DELETE"])
@role_required("Manager")
def delete_staff(staff_id):
    # ON DELETE CASCADE on HOUSEKEEPING/FRONTDESK handles the subtype row.
    _, err = run("DELETE FROM STAFF WHERE StaffID=%s", (staff_id,), fetch="none")
    return ok_or_error({"deleted": staff_id}, err)


# ---------------- Rooms (full edit — Manager has ALL PRIVILEGES; Front
# Desk is limited by the DB grant to the RoomStatus column only) ----------------


@manager_bp.route("/rooms", methods=["POST"])
@role_required("Manager")
def add_room():
    body = request.get_json(silent=True) or {}
    room_type = body.get("room_type") or body.get("RoomType")
    rate = body.get("rate") if body.get("rate") is not None else (body.get("room_rate") or body.get("RoomRate") or body.get("room"))
    if not all([room_type, rate]):
        return jsonify({"error": "room_type and rate are required."}), 400
    room_no = body.get("room_no") or body.get("RoomNo") or new_id("R1", 3)
    _, err = run(
        "INSERT INTO ROOM (RoomNo, RoomType, RoomRate, RoomStatus, HousekeeperID) "
        "VALUES (%s,%s,%s,'Vacant',%s)",
        (room_no, room_type, rate, body.get("housekeeper_id") or body.get("HousekeeperID")),
        fetch="none",
    )
    return ok_or_error({"room_no": room_no}, err)


@manager_bp.route("/rooms/<room_no>", methods=["PUT"])
@role_required("Manager")
def update_room(room_no):
    body = request.get_json(silent=True) or {}
    room_type = body.get("room_type") or body.get("RoomType")
    rate = body.get("rate") if body.get("rate") is not None else (body.get("room_rate") or body.get("RoomRate") or body.get("room"))
    _, err = run(
        "UPDATE ROOM SET RoomType=%s, RoomRate=%s WHERE RoomNo=%s",
        (room_type, rate, room_no),
        fetch="none",
    )
    return ok_or_error({"room_no": room_no}, err)


# ---------------- Customers (manager-only delete) ----------------


@manager_bp.route("/customers/<customer_id>", methods=["DELETE"])
@role_required("Manager")
def delete_customer(customer_id):
    _, err = run(
        "DELETE FROM CUSTOMER WHERE CustomerID=%s", (customer_id,), fetch="none"
    )
    return ok_or_error({"deleted": customer_id}, err)


# ---------------- Conference halls / restaurants / events (write) ----------------


@manager_bp.route("/conference-halls", methods=["POST"])
@role_required("Manager")
def add_hall():
    body = request.get_json(silent=True) or {}
    name, capacity = body.get("name"), body.get("capacity")
    if not all([name, capacity]):
        return jsonify({"error": "name and capacity are required."}), 400
    hall_id = body.get("hall_id") or new_id("CH", 2)
    _, err = run(
        "INSERT INTO CONFERENCE_HALL (HallID, HallName, Capacity) VALUES (%s,%s,%s)",
        (hall_id, name, capacity),
        fetch="none",
    )
    return ok_or_error({"hall_id": hall_id}, err)


@manager_bp.route("/restaurants", methods=["POST"])
@role_required("Manager")
def add_restaurant():
    body = request.get_json(silent=True) or {}
    name, seats = body.get("name"), body.get("seating_capacity")
    if not all([name, seats]):
        return jsonify({"error": "name and seating_capacity are required."}), 400
    rest_id = body.get("restaurant_id") or new_id("RT", 2)
    _, err = run(
        "INSERT INTO RESTAURANT (RestaurantID, RestaurantName, SeatingCapacity) VALUES (%s,%s,%s)",
        (rest_id, name, seats),
        fetch="none",
    )
    return ok_or_error({"restaurant_id": rest_id}, err)


# ---------------- Reports (Phase 6 advanced queries) ----------------


@manager_bp.route("/reports/room-inventory", methods=["GET"])
@role_required("Manager")
def report_room_inventory():
    data, err = run(
        """
        SELECT RoomType, COUNT(*) AS TotalRooms,
               ROUND(AVG(RoomRate), 2) AS AvgRate,
               SUM(CASE WHEN RoomStatus='Occupied' THEN 1 ELSE 0 END) AS OccupiedCount,
               SUM(CASE WHEN RoomStatus='Vacant' THEN 1 ELSE 0 END) AS VacantCount
        FROM ROOM GROUP BY RoomType ORDER BY AvgRate DESC
        """
    )
    return ok_or_error(data, err)


@manager_bp.route("/reports/frontdesk-workload", methods=["GET"])
@role_required("Manager")
def report_frontdesk_workload():
    data, err = run(
        """
        SELECT s.StaffID, CONCAT(s.StaffFName,' ',s.StaffLName) AS StaffName,
               fd.Shift, COUNT(r.ReservationID) AS ReservationsHandled
        FROM STAFF s
        JOIN FRONTDESK fd ON fd.StaffID = s.StaffID
        LEFT JOIN RESERVATION r ON r.StaffID = fd.StaffID
        GROUP BY s.StaffID, StaffName, fd.Shift
        ORDER BY ReservationsHandled DESC
        """
    )
    return ok_or_error(data, err)


@manager_bp.route("/reports/hall-utilisation", methods=["GET"])
@role_required("Manager")
def report_hall_utilisation():
    data, err = run(
        """
        SELECT ch.HallID, ch.HallName, ch.Capacity,
               COUNT(e.EventID) AS EventsHosted, SUM(e.EventDuration) AS TotalHoursBooked
        FROM CONFERENCE_HALL ch
        LEFT JOIN EVENT e ON e.HallID = ch.HallID
        GROUP BY ch.HallID, ch.HallName, ch.Capacity
        ORDER BY TotalHoursBooked DESC
        """
    )
    return ok_or_error(data, err)


@manager_bp.route("/reports/outstanding-invoices", methods=["GET"])
@role_required("Manager")
def report_outstanding_invoices():
    data, err = run("SELECT * FROM vw_outstanding_invoices ORDER BY BalanceDue DESC")
    return ok_or_error(data, err)


# ---------------- Customer Feedback Management ----------------


@manager_bp.route("/feedback/<feedback_id>", methods=["DELETE"])
@role_required("Manager")
def delete_feedback(feedback_id):
    _, err = run(
        "DELETE FROM CUSTOMER_FEEDBACK WHERE FeedbackID=%s",
        (feedback_id,),
        fetch="none",
    )
    return ok_or_error({"deleted": feedback_id}, err)
