from flask import Blueprint, request, jsonify, session

import db as db_module
from auth import verify_password, current_user, login_required

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
