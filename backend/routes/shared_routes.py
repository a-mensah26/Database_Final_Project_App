import uuid
import pymysql
from flask import Blueprint, request, jsonify, session

from auth import login_required, get_db

shared_bp = Blueprint("shared", __name__)


def new_id(prefix, width=2):
    """Small helper for VARCHAR(5) style IDs, e.g. CU07, RES14."""
    return f"{prefix}{uuid.uuid4().hex[:5 - len(prefix)].upper()}"


def run(sql, params=None, fetch="all"):
    """
    Execute a statement with the caller's role-scoped connection.
    Translates MySQL access-denied / trigger SIGNAL errors into clean
    JSON responses instead of leaking raw DB errors to the frontend.
    """
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            if fetch == "all":
                result = cur.fetchall()
            elif fetch == "one":
                result = cur.fetchone()
            else:
                result = cur.rowcount
            # CALL statements can leave extra result sets queued on the
            # connection (a PyMySQL/MySQL protocol quirk); drain them so
            # the *next* query on this connection doesn't fail with
            # "Commands out of sync".
            while cur.nextset():
                pass
            return result, None
    except pymysql.err.OperationalError as e:
        if e.args and e.args[0] in (1142, 1143):  # command/column denied
            return None, ("Your role does not have permission to do that.", 403)
        return None, (str(e.args[-1]) if e.args else "Database error.", 400)
    except pymysql.err.IntegrityError as e:
        return None, (str(e.args[-1]) if e.args else "That violates a data rule.", 400)
    except pymysql.err.InternalError as e:
        # SIGNAL SQLSTATE '45000' from a trigger lands here
        return None, (str(e.args[-1]) if e.args else "That action was blocked.", 400)


def ok_or_error(data, err):
    if err:
        message, status = err
        return jsonify({"error": message}), status
    return jsonify(data)


# ---------------- Dashboard ----------------

@shared_bp.route("/dashboard/available-rooms", methods=["GET"])
@login_required
def available_rooms():
    data, err = run("SELECT * FROM vw_available_rooms")
    return ok_or_error(data, err)


@shared_bp.route("/dashboard/occupancy", methods=["GET"])
@login_required
def occupancy():
    data, err = run("SELECT * FROM vw_current_room_occupancy")
    return ok_or_error(data, err)


@shared_bp.route("/dashboard/upcoming-events", methods=["GET"])
@login_required
def upcoming_events():
    data, err = run("SELECT * FROM vw_upcoming_events")
    return ok_or_error(data, err)


@shared_bp.route("/dashboard/occupancy-rate", methods=["GET"])
@login_required
def occupancy_rate():
    row, err = run("SELECT fn_room_occupancy_rate() AS OccupiedPct", fetch="one")
    if err:
        return ok_or_error(row, err)
    pct = float(row["OccupiedPct"])
    return jsonify({"occupied_pct": pct, "vacant_pct": round(100 - pct, 2)})


# ---------------- Rooms ----------------

@shared_bp.route("/rooms", methods=["GET"])
@login_required
def list_rooms():
    data, err = run(
        "SELECT RoomNo, RoomType, RoomRate, RoomStatus, HousekeeperID FROM ROOM "
        "ORDER BY RoomNo"
    )
    return ok_or_error(data, err)


@shared_bp.route("/rooms/<room_no>/status", methods=["PATCH"])
@login_required
def update_room_status(room_no):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in ("Occupied", "Vacant"):
        return jsonify({"error": "status must be 'Occupied' or 'Vacant'."}), 400
    _, err = run("CALL sp_update_room_status(%s, %s)", (room_no, status), fetch="none")
    return ok_or_error({"room_no": room_no, "status": status}, err)


# ---------------- Customers ----------------

@shared_bp.route("/customers", methods=["GET"])
@login_required
def list_customers():
    data, err = run(
        "SELECT CustomerID, CustomerFName, CustomerLName, PhoneNumber "
        "FROM CUSTOMER ORDER BY CustomerID"
    )
    return ok_or_error(data, err)


@shared_bp.route("/customers", methods=["POST"])
@login_required
def add_customer():
    body = request.get_json(silent=True) or {}
    fname, lname, phone = body.get("fname"), body.get("lname"), body.get("phone")
    if not all([fname, lname, phone]):
        return jsonify({"error": "fname, lname and phone are required."}), 400
    cust_id = body.get("customer_id") or new_id("CU", 2)
    _, err = run(
        "CALL sp_add_customer(%s, %s, %s, %s)",
        (cust_id, fname, lname, phone),
        fetch="none",
    )
    if err:
        return ok_or_error(None, err)
    return jsonify({"customer_id": cust_id, "fname": fname, "lname": lname, "phone": phone}), 201


@shared_bp.route("/customers/<customer_id>", methods=["PUT"])
@login_required
def update_customer(customer_id):
    body = request.get_json(silent=True) or {}
    fname, lname, phone = body.get("fname"), body.get("lname"), body.get("phone")
    _, err = run(
        "UPDATE CUSTOMER SET CustomerFName=%s, CustomerLName=%s, PhoneNumber=%s "
        "WHERE CustomerID=%s",
        (fname, lname, phone, customer_id),
        fetch="none",
    )
    return ok_or_error({"customer_id": customer_id}, err)


# ---------------- Reservations ----------------

@shared_bp.route("/reservations", methods=["GET"])
@login_required
def list_reservations():
    data, err = run(
        """
        SELECT r.ReservationID, r.RoomID, r.CustomerID,
               CONCAT(c.CustomerFName, ' ', c.CustomerLName) AS CustomerName,
               r.StaffID, r.CheckIn, r.CheckOut
        FROM RESERVATION r
        JOIN CUSTOMER c ON c.CustomerID = r.CustomerID
        ORDER BY r.CheckIn DESC
        """
    )
    return ok_or_error(data, err)


@shared_bp.route("/reservations", methods=["POST"])
@login_required
def add_reservation():
    body = request.get_json(silent=True) or {}
    room_id, customer_id = body.get("room_id"), body.get("customer_id")
    check_in, check_out = body.get("check_in"), body.get("check_out")
    # Front Desk users book under their own StaffID; a Manager must name one
    # (managers aren't rows in FRONTDESK, so they can't be the FK target).
    staff_id = session.get("staff_id") or body.get("staff_id")
    if not all([room_id, customer_id, check_in, staff_id]):
        return jsonify({"error": "room_id, customer_id, check_in and staff_id are required."}), 400

    res_id = body.get("reservation_id") or new_id("RES", 3)
    _, err = run(
        "INSERT INTO RESERVATION (ReservationID, RoomID, CustomerID, StaffID, CheckIn, CheckOut) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (res_id, room_id, customer_id, staff_id, check_in, check_out),
        fetch="none",
    )
    if err:
        return ok_or_error(None, err)
    run("CALL sp_update_room_status(%s, 'Occupied')", (room_id,), fetch="none")
    return jsonify({"reservation_id": res_id}), 201


@shared_bp.route("/reservations/<reservation_id>/checkout", methods=["PUT"])
@login_required
def checkout_reservation(reservation_id):
    body = request.get_json(silent=True) or {}
    check_out = body.get("check_out")
    room, err = run(
        "SELECT RoomID FROM RESERVATION WHERE ReservationID=%s", (reservation_id,), fetch="one"
    )
    if err:
        return ok_or_error(room, err)
    if not room:
        return jsonify({"error": "Reservation not found."}), 404

    _, err = run(
        "UPDATE RESERVATION SET CheckOut=%s WHERE ReservationID=%s",
        (check_out, reservation_id),
        fetch="none",
    )
    if err:
        return ok_or_error(None, err)
    run("CALL sp_update_room_status(%s, 'Vacant')", (room["RoomID"],), fetch="none")
    return jsonify({"reservation_id": reservation_id, "check_out": check_out})


@shared_bp.route("/reservations/<reservation_id>", methods=["DELETE"])
@login_required
def delete_reservation(reservation_id):
    # The trg_prevent_completed_delete trigger blocks this once CheckOut is set,
    # for both roles — that's a business rule, not a role permission.
    _, err = run("DELETE FROM RESERVATION WHERE ReservationID=%s", (reservation_id,), fetch="none")
    return ok_or_error({"deleted": reservation_id}, err)


# ---------------- Conference halls / restaurants / events (read) ----------------

@shared_bp.route("/conference-halls", methods=["GET"])
@login_required
def list_halls():
    data, err = run("SELECT * FROM CONFERENCE_HALL ORDER BY HallID")
    return ok_or_error(data, err)


@shared_bp.route("/restaurants", methods=["GET"])
@login_required
def list_restaurants():
    data, err = run("SELECT * FROM RESTAURANT ORDER BY RestaurantID")
    return ok_or_error(data, err)


@shared_bp.route("/events", methods=["GET"])
@login_required
def list_events():
    data, err = run(
        """
        SELECT e.EventID, e.EventType, e.EventDate, e.EventDuration,
               e.HallID, ch.HallName,
               CONCAT(c.CustomerFName, ' ', c.CustomerLName) AS HostName
        FROM EVENT e
        JOIN CONFERENCE_HALL ch ON ch.HallID = e.HallID
        JOIN CUSTOMER c ON c.CustomerID = e.Host
        ORDER BY e.EventDate
        """
    )
    return ok_or_error(data, err)
