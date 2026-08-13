from flask import Blueprint, request, jsonify, session
import uuid

import db as db_module
from auth import verify_password, current_user, login_required, hash_password

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    conn = db_module.get_auth_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT UserID, Username, PasswordHash, FullName, Role, StaffID "
                "FROM APP_USER WHERE Username = %s",
                (username,),
            )
            user = cur.fetchone()
    finally:
        conn.close()

    if not user or not verify_password(password, user["PasswordHash"]):
        return jsonify({"error": "Incorrect username or password."}), 401

    session.clear()
    session["user_id"] = user["UserID"]
    session["username"] = user["Username"]
    session["full_name"] = user["FullName"]
    session["role"] = user["Role"]
    session["staff_id"] = user["StaffID"]

    return jsonify(current_user())


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify(current_user())


@auth_bp.route("/register", methods=["POST"])
def register():
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    full_name = (body.get("full_name") or "").strip()
    role = body.get("role")

    if not all([username, password, full_name, role]):
        return jsonify({"error": "Username, password, full name and role are required."}), 400

    if role not in ("Front Desk", "Manager"):
        return jsonify({"error": "Invalid role."}), 400

    shift = body.get("shift")
    if role == "Front Desk" and not shift:
        return jsonify({"error": "Shift is required for Front Desk registration."}), 400

    conn = db_module.get_auth_connection()
    try:
        with conn.cursor() as cur:
            # Check if username exists
            cur.execute("SELECT UserID FROM APP_USER WHERE Username = %s", (username,))
            if cur.fetchone():
                return jsonify({"error": "Username is already taken."}), 400

            staff_id = None
            if role == "Front Desk":
                # Create Staff ID
                from routes.shared_routes import new_id
                staff_id = new_id("FD", 2)
                name_parts = full_name.split(None, 1)
                fname = name_parts[0]
                lname = name_parts[1] if len(name_parts) > 1 else ""

                cur.execute(
                    "INSERT INTO STAFF (StaffID, StaffFName, StaffLName, StaffRole) VALUES (%s, %s, %s, 'Front Desk')",
                    (staff_id, fname, lname)
                )
                cur.execute(
                    "INSERT INTO FRONTDESK (StaffID, Shift) VALUES (%s, %s)",
                    (staff_id, shift)
                )

            user_id = "U" + uuid.uuid4().hex[:4].upper()
            cur.execute(
                "INSERT INTO APP_USER (UserID, Username, PasswordHash, FullName, Role, StaffID) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (user_id, username, hash_password(password), full_name, role, staff_id)
            )
    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500
    finally:
        conn.close()

    return jsonify({"success": True, "message": "Registered successfully. Please sign in."}), 201
