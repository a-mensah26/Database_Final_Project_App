import uuid
import datetime
import pymysql
from flask import Blueprint, request, jsonify, session

import db as db_module
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

@shared_bp.route("/dashboard/stats", methods=["GET"])
@login_required
def dashboard_stats():
    # Retrieve vacant & occupied room counts, rate, and upcoming events count
    try:
        # We run multiple queries using the per-request db connection helper
        vacant_row, err = run("SELECT COUNT(*) AS cnt FROM ROOM WHERE RoomStatus = 'Vacant'", fetch="one")
        if err: return ok_or_error(None, err)
        occupied_row, err = run("SELECT COUNT(*) AS cnt FROM ROOM WHERE RoomStatus = 'Occupied'", fetch="one")
        if err: return ok_or_error(None, err)
        rate_row, err = run("SELECT fn_room_occupancy_rate() AS rate", fetch="one")
        if err: return ok_or_error(None, err)
        event_row, err = run("SELECT COUNT(*) AS cnt FROM EVENT WHERE EventDate >= CURDATE()", fetch="one")
        if err: return ok_or_error(None, err)

        return jsonify({
            "unoccupied_rooms": vacant_row["cnt"],
            "occupied_rooms": occupied_row["cnt"],
            "occupancy_rate": float(rate_row["rate"]) if rate_row["rate"] is not None else 0.0,
            "upcoming_events_count": event_row["cnt"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
        "SELECT r.RoomNo, r.RoomType, r.RoomRate, r.RoomStatus, r.HousekeeperID, "
        "       CONCAT(s.StaffFName, ' ', s.StaffLName) AS HousekeeperName "
        "FROM ROOM r "
        "LEFT JOIN STAFF s ON s.StaffID = r.HousekeeperID "
        "ORDER BY r.RoomNo"
    )
    return ok_or_error(data, err)


@shared_bp.route("/housekeepers", methods=["GET"])
@login_required
def list_housekeepers():
    data, err = run(
        "SELECT StaffID, StaffFName, StaffLName, StaffRole "
        "FROM STAFF WHERE StaffRole = 'Housekeeping' ORDER BY StaffID"
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
    if not check_out:
        check_out = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Get reservation details
    res, err = run(
        "SELECT RoomID, CustomerID, CheckIn FROM RESERVATION WHERE ReservationID=%s",
        (reservation_id,),
        fetch="one"
    )
    if err:
        return ok_or_error(res, err)
    if not res:
        return jsonify({"error": "Reservation not found."}), 404

    # Update reservation checkout date
    _, err = run(
        "UPDATE RESERVATION SET CheckOut=%s WHERE ReservationID=%s",
        (check_out, reservation_id),
        fetch="none",
    )
    if err:
        return ok_or_error(None, err)

    # Free the room
    run("CALL sp_update_room_status(%s, 'Vacant')", (res["RoomID"],), fetch="none")

    # Auto-billing invoice generation logic
    room_rate_row, err = run("SELECT RoomRate FROM ROOM WHERE RoomNo=%s", (res["RoomID"],), fetch="one")
    room_rate = float(room_rate_row["RoomRate"]) if (room_rate_row and room_rate_row.get("RoomRate")) else 100.0

    try:
        if isinstance(check_out, str):
            co_dt = datetime.datetime.strptime(check_out, "%Y-%m-%d %H:%M:%S")
        else:
            co_dt = check_out
    except Exception:
        co_dt = datetime.datetime.now()

    ci_dt = res["CheckIn"]
    if isinstance(ci_dt, str):
        try:
            ci_dt = datetime.datetime.strptime(ci_dt, "%Y-%m-%d %H:%M:%S")
        except Exception:
            ci_dt = co_dt - datetime.timedelta(days=1)

    delta = co_dt - ci_dt
    days = max(1, delta.days + (1 if delta.seconds > 3600 * 12 else 0))
    amount_payable = round((days * room_rate) * 1.125, 2) # rate + 12.5% tax

    # Check if an invoice already exists for this ReservationID
    inv_check, err = run(
        "SELECT InvoiceNo FROM INVOICE WHERE ReservationID=%s",
        (reservation_id,),
        fetch="one"
    )
    if not inv_check:
        inv_no = new_id("INV", 3)
        run(
            "INSERT INTO INVOICE (InvoiceNo, ReservationID, CustomerID, AmountPayable, AmountPaid) "
            "VALUES (%s, %s, %s, %s, 0.00)",
            (inv_no, reservation_id, res["CustomerID"], amount_payable),
            fetch="none"
        )
    else:
        run(
            "UPDATE INVOICE SET AmountPayable=%s WHERE ReservationID=%s",
            (amount_payable, reservation_id),
            fetch="none"
        )

    return jsonify({"reservation_id": reservation_id, "check_out": check_out})


@shared_bp.route("/reservations/<reservation_id>", methods=["DELETE"])
@login_required
def delete_reservation(reservation_id):
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


@shared_bp.route("/events", methods=["POST"])
@login_required
def add_event():
    body = request.get_json(silent=True) or {}
    fields = ["event_type", "event_date", "duration", "host_id", "hall_id"]
    if not all(body.get(f) for f in fields):
        return jsonify({"error": f"{', '.join(fields)} are required."}), 400
    event_id = body.get("event_id") or new_id("EV", 2)
    _, err = run(
        "INSERT INTO EVENT (EventID, EventType, EventDate, EventDuration, Host, HallID) "
        "VALUES (%s,%s,%s,%s,%s,%s)",
        (event_id, body["event_type"], body["event_date"], body["duration"],
         body["host_id"], body["hall_id"]),
        fetch="none",
    )
    return ok_or_error({"event_id": event_id}, err)


# ---------------- Billing & Invoices ----------------

@shared_bp.route("/invoices", methods=["GET"])
@login_required
def list_invoices():
    if session.get("role") != "Manager":
        return jsonify({"error": "Access forbidden. Managers only."}), 403
    data, err = run("SELECT * FROM INVOICE ORDER BY InvoiceNo")
    return ok_or_error(data, err)


@shared_bp.route("/invoices", methods=["POST"])
@login_required
def add_invoice():
    if session.get("role") != "Manager":
        return jsonify({"error": "Access forbidden. Managers only."}), 403
    body = request.get_json(silent=True) or {}
    customer_id = body.get("customer_id")
    reservation_id = body.get("reservation_id") or None
    amount_payable = body.get("amount_payable")
    amount_paid = body.get("amount_paid") or 0.00

    if not customer_id or amount_payable is None:
        return jsonify({"error": "customer_id and amount_payable are required."}), 400

    inv_id = body.get("invoice_no") or new_id("INV", 3)
    _, err = run(
        "INSERT INTO INVOICE (InvoiceNo, ReservationID, CustomerID, AmountPayable, AmountPaid) "
        "VALUES (%s, %s, %s, %s, %s)",
        (inv_id, reservation_id, customer_id, amount_payable, amount_paid),
        fetch="none"
    )
    if err:
        return ok_or_error(None, err)
    return jsonify({"invoice_no": inv_id}), 201


@shared_bp.route("/invoices/<invoice_no>", methods=["PUT"])
@login_required
def update_invoice(invoice_no):
    if session.get("role") != "Manager":
        return jsonify({"error": "Access forbidden. Managers only."}), 403
    body = request.get_json(silent=True) or {}
    amount_paid = body.get("amount_paid")
    if amount_paid is None:
        return jsonify({"error": "amount_paid is required."}), 400
    _, err = run(
        "UPDATE INVOICE SET AmountPaid=%s WHERE InvoiceNo=%s",
        (amount_paid, invoice_no),
        fetch="none",
    )
    return ok_or_error({"invoice_no": invoice_no, "amount_paid": amount_paid}, err)


# ---------------- Restaurant Orders ----------------

@shared_bp.route("/restaurant-orders", methods=["GET"])
@login_required
def list_restaurant_orders():
    data, err = run(
        """
        SELECT ro.OrderID, ro.CustomerID,
               CONCAT(c.CustomerFName,' ',c.CustomerLName) AS CustomerName,
               ro.RestaurantID, r.RestaurantName, ro.InvoiceID, ro.OrderDetails
        FROM RESTAURANT_ORDER ro
        JOIN CUSTOMER c ON c.CustomerID = ro.CustomerID
        JOIN RESTAURANT r ON r.RestaurantID = ro.RestaurantID
        ORDER BY ro.OrderID
        """
    )
    return ok_or_error(data, err)


@shared_bp.route("/restaurant-orders", methods=["POST"])
@login_required
def add_restaurant_order():
    body = request.get_json(silent=True) or {}
    customer_id = body.get("customer_id")
    restaurant_id = body.get("restaurant_id")
    invoice_id = body.get("invoice_id") or None
    order_details = body.get("order_details")

    if not all([customer_id, restaurant_id, order_details]):
        return jsonify({"error": "customer_id, restaurant_id and order_details are required."}), 400

    order_id = body.get("order_id") or new_id("RO", 2)
    _, err = run(
        "INSERT INTO RESTAURANT_ORDER (OrderID, CustomerID, RestaurantID, InvoiceID, OrderDetails) "
        "VALUES (%s, %s, %s, %s, %s)",
        (order_id, customer_id, restaurant_id, invoice_id, order_details),
        fetch="none"
    )
    if err:
        return ok_or_error(None, err)
    return jsonify({"order_id": order_id}), 201


# ---------------- Customer Feedback ----------------

@shared_bp.route("/feedback", methods=["GET"])
@login_required
def list_feedback():
    data, err = run(
        """
        SELECT f.FeedbackID, f.CustomerID,
               CONCAT(c.CustomerFName, ' ', c.CustomerLName) AS CustomerName,
               f.Rating, f.Comments, f.FeedbackDate
        FROM CUSTOMER_FEEDBACK f
        JOIN CUSTOMER c ON c.CustomerID = f.CustomerID
        ORDER BY f.FeedbackDate DESC
        """
    )
    return ok_or_error(data, err)


@shared_bp.route("/feedback", methods=["POST"])
@login_required
def add_feedback():
    body = request.get_json(silent=True) or {}
    customer_id = body.get("customer_id")
    rating = body.get("rating")
    comments = body.get("comments")

    if not all([customer_id, rating, comments]):
        return jsonify({"error": "customer_id, rating and comments are required."}), 400

    try:
        rating_val = int(rating)
        if not (1 <= rating_val <= 5):
            raise ValueError()
    except ValueError:
        return jsonify({"error": "rating must be an integer between 1 and 5."}), 400

    fb_id = body.get("feedback_id") or new_id("FB", 2)
    fb_date = datetime.date.today().strftime("%Y-%m-%d")

    _, err = run(
        "INSERT INTO CUSTOMER_FEEDBACK (FeedbackID, CustomerID, Rating, Comments, FeedbackDate) "
        "VALUES (%s, %s, %s, %s, %s)",
        (fb_id, customer_id, rating_val, comments, fb_date),
        fetch="none"
    )
    if err:
        return ok_or_error(None, err)
    return jsonify({"feedback_id": fb_id}), 201


# ---------------- Public Showcase Endpoints ----------------

@shared_bp.route("/public/rooms", methods=["GET"])
def public_rooms():
    conn = db_module.get_auth_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT RoomNo, RoomType, RoomRate FROM vw_available_rooms")
            rooms = cur.fetchall()
            return jsonify(rooms)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()


@shared_bp.route("/public/events", methods=["GET"])
def public_events():
    conn = db_module.get_auth_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT EventType, EventDate, EventDuration, HallName, Capacity "
                "FROM vw_upcoming_events"
            )
            events = cur.fetchall()
            return jsonify(events)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()


# ---------------- Customer Reservation Requests ----------------

@shared_bp.route("/public/requests", methods=["POST"])
def public_add_request():
    body = request.get_json(silent=True) or {}
    fname = (body.get("fname") or "").strip()
    lname = (body.get("lname") or "").strip()
    phone = (body.get("phone") or "").strip()
    room_type = body.get("room_type")
    check_in = body.get("check_in")
    check_out = body.get("check_out")

    if not all([fname, lname, phone, room_type, check_in, check_out]):
        return jsonify({"error": "fname, lname, phone, room_type, check_in and check_out are required."}), 400

    # Date order verification
    try:
        ci = datetime.datetime.fromisoformat(check_in)
        co = datetime.datetime.fromisoformat(check_out)
        if co <= ci:
            return jsonify({"error": "Check-out date must be after check-in date."}), 400
    except Exception:
        pass

    import random
    import string
    chars = string.ascii_uppercase + string.digits

    token = None
    conn = db_module.get_auth_connection()
    try:
        with conn.cursor() as cur:
            # 1. Instantly check/create customer
            cur.execute("SELECT CustomerID FROM CUSTOMER WHERE PhoneNumber=%s", (phone,))
            row = cur.fetchone()
            if row:
                cust_id = row["CustomerID"]
            else:
                cust_id = new_id("CU", 2)
                cur.execute(
                    "INSERT INTO CUSTOMER (CustomerID, CustomerFName, CustomerLName, PhoneNumber) VALUES (%s,%s,%s,%s)",
                    (cust_id, fname, lname, phone)
                )

            # 2. Try up to 5 times to avoid token collision
            for _ in range(5):
                candidate = "AK-" + "".join(random.choices(chars, k=3))
                cur.execute("SELECT RequestToken FROM RESERVATION_REQUEST WHERE RequestToken=%s", (candidate,))
                if not cur.fetchone():
                    token = candidate
                    break
            if not token:
                token = "AK-" + "".join(random.choices(chars, k=3))

            req_date = datetime.date.today().strftime("%Y-%m-%d")
            cur.execute(
                "INSERT INTO RESERVATION_REQUEST (RequestToken, CustomerID, RoomType, CheckIn, CheckOut, Status, RequestDate) "
                "VALUES (%s, %s, %s, %s, %s, 'Pending', %s)",
                (token, cust_id, room_type, check_in, check_out, req_date)
            )
    except Exception as e:
        return jsonify({"error": f"Failed to submit request: {str(e)}"}), 500
    finally:
        conn.close()

    return jsonify({"token": token}), 201


@shared_bp.route("/public/requests/<token>", methods=["GET"])
def public_get_request(token):
    conn = db_module.get_auth_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT r.RequestToken, r.CustomerID, c.CustomerFName, c.CustomerLName, c.PhoneNumber, "
                "       r.RoomType, r.CheckIn, r.CheckOut, r.Status, r.RoomNo "
                "FROM RESERVATION_REQUEST r "
                "JOIN CUSTOMER c ON c.CustomerID = r.CustomerID "
                "WHERE r.RequestToken=%s",
                (token,)
            )
            req = cur.fetchone()
            if not req:
                return jsonify({"error": "Request token not found."}), 404
            return jsonify(req)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()


@shared_bp.route("/requests", methods=["GET"])
@login_required
def list_requests():
    data, err = run(
        "SELECT r.RequestToken, r.CustomerID, c.CustomerFName, c.CustomerLName, c.PhoneNumber, "
        "       r.RoomType, r.CheckIn, r.CheckOut, r.Status, r.RoomNo, r.StaffID, r.RequestDate "
        "FROM RESERVATION_REQUEST r "
        "JOIN CUSTOMER c ON c.CustomerID = r.CustomerID "
        "ORDER BY FIELD(r.Status, 'Pending', 'Approved', 'Declined') ASC, r.RequestDate DESC"
    )
    return ok_or_error(data, err)


@shared_bp.route("/requests/<token>/approve", methods=["PUT"])
@login_required
def approve_request(token):
    body = request.get_json(silent=True) or {}
    room_no = body.get("room_no")
    staff_id = session.get("staff_id") or body.get("staff_id") or "FD01"

    if not room_no:
        return jsonify({"error": "room_no is required to assign to this request."}), 400

    # Get request details
    req, err = run(
        "SELECT CustomerID, RoomType, CheckIn, CheckOut, Status "
        "FROM RESERVATION_REQUEST WHERE RequestToken=%s",
        (token,),
        fetch="one"
    )
    if err or not req:
        return ok_or_error(req, err or ("Request not found.", 404))

    if req["Status"] != "Pending":
        return jsonify({"error": f"Request has already been {req['Status'].lower()}."}), 400

    cust_id = req["CustomerID"]

    # Create Reservation
    res_id = new_id("RES", 3)
    _, err = run(
        "INSERT INTO RESERVATION (ReservationID, RoomID, CustomerID, StaffID, CheckIn, CheckOut) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (res_id, room_no, cust_id, staff_id, req["CheckIn"], req["CheckOut"]),
        fetch="none"
    )
    if err:
        return ok_or_error(None, err)

    # Note: DB triggers automatically synchronize ROOM.RoomStatus to 'Occupied' on INSERT.
    # Update Request Status in DB
    _, err = run(
        "UPDATE RESERVATION_REQUEST SET Status='Approved', RoomNo=%s, StaffID=%s WHERE RequestToken=%s",
        (room_no, staff_id, token),
        fetch="none"
    )
    if err:
        return ok_or_error(None, err)

    return jsonify({"status": "Approved", "room_no": room_no, "reservation_id": res_id}), 200


@shared_bp.route("/requests/<token>/decline", methods=["PUT"])
@login_required
def decline_request(token):
    staff_id = session.get("staff_id") or request.get_json(silent=True).get("staff_id")
    if not staff_id:
        return jsonify({"error": "staff_id is required."}), 400

    # Check current status
    req, err = run("SELECT Status FROM RESERVATION_REQUEST WHERE RequestToken=%s", (token,), fetch="one")
    if err or not req:
        return ok_or_error(req, err or ("Request not found.", 404))

    if req["Status"] != "Pending":
        return jsonify({"error": f"Request has already been {req['Status'].lower()}."}), 400

    # Update Status
    _, err = run(
        "UPDATE RESERVATION_REQUEST SET Status='Declined', StaffID=%s WHERE RequestToken=%s",
        (staff_id, token),
        fetch="none"
    )
    if err:
        return ok_or_error(None, err)

    return jsonify({"status": "Declined"}), 200

