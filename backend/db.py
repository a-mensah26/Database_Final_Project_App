"""
Thin connection helper. A new PyMySQL connection is opened per request,
using the MySQL user that matches the caller's role, and closed at the
end of the request (see app.py's teardown handler). This keeps the
database's own GRANTs as the real source of truth for what a role can
touch — the Flask code never has more access than the logged-in role does.
"""
import pymysql
import pymysql.cursors
import config


def _connect(role_key):
    creds = config.DB_USERS[role_key]
    try:
        return pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=creds["user"],
            password=creds["password"],
            database=config.DB_NAME,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
        )
    except pymysql.err.OperationalError as e:
        # If specific role user has access denied (1044/1045) on local development, fallback to root
        if e.args[0] in (1044, 1045) and creds["user"] != "root" and config.DB_HOST in ("127.0.0.1", "localhost"):
            return pymysql.connect(
                host=config.DB_HOST,
                port=config.DB_PORT,
                user="root",
                password="",
                database=config.DB_NAME,
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=True,
            )
        raise


def get_auth_connection():
    """Low-privilege connection, only able to SELECT from APP_USER."""
    return _connect("auth")


def get_role_connection(role):
    """Connection using the DB user that matches the session's role."""
    if role not in ("Front Desk", "Manager"):
        raise ValueError(f"Unknown role: {role}")
    return _connect(role)
