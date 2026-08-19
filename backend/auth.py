from functools import wraps
from flask import session, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
import db as db_module


def hash_password(plain):
    return generate_password_hash(plain)


def verify_password(plain, hashed):
    return check_password_hash(hashed, plain)


def current_user():
    if "user_id" not in session:
        return None
    # Prevent KeyError from stale/colliding session cookies of other apps on localhost
    try:
        return {
            "user_id": session["user_id"],
            "username": session["username"],
            "full_name": session["full_name"],
            "role": session["role"],
            "staff_id": session.get("staff_id"),
        }
    except KeyError:
        return None


def get_db():
    """
    Per-request connection, opened with the credentials for the logged-in
    user's role and cached on flask.g so every handler in the same request
    reuses one connection. Closed in app.py's teardown_appcontext.
    """
    if "db" not in g:
        user = current_user()
        if user is None or user.get("role") is None:
            raise RuntimeError("get_db() called with no authenticated session")
        g.db = db_module.get_role_connection(user["role"])
    return g.db


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Not authenticated. Please log in."}), 401
        return fn(*args, **kwargs)
    return wrapper


def role_required(*allowed_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Not authenticated. Please log in."}), 401
            if user.get("role") not in allowed_roles:
                return jsonify({"error": "You do not have permission to do that."}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
