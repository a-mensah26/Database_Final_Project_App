"""
Configuration for the Hotel Reservation & Event Management System API.

All secrets are read from environment variables (with dev-only fallbacks)
so nothing sensitive has to live in source control. Copy .env.example to
.env and fill in real values before running against anything but a local
throwaway database.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ---- Flask ----
SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "dev-only-change-me")
DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1"

# ---- MariaDB connection basics ----
DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("DB_PORT", "3306"))
DB_NAME = os.environ.get("DB_NAME", "hotelreservationsystem")

# ---- Role-specific MySQL credentials ----
# hotel_auth   : SELECT-only on APP_USER, used just to check a login
# hotel_front_desk / hotel_manager : the Phase 6 GRANT-based roles.
# Using three real MySQL users means privilege enforcement happens at the
# database layer, not only in the Flask route code.
DB_USERS = {
    "auth": {
        "user": os.environ.get("AUTH_DB_USER", "hotel_auth"),
        "password": os.environ.get("AUTH_DB_PASSWORD", "CHANGE_ME_auth"),
    },
    "Front Desk": {
        "user": os.environ.get("FRONTDESK_DB_USER", "hotel_front_desk"),
        "password": os.environ.get("FRONTDESK_DB_PASSWORD", "CHANGE_ME_frontdesk"),
    },
    "Manager": {
        "user": os.environ.get("MANAGER_DB_USER", "hotel_manager"),
        "password": os.environ.get("MANAGER_DB_PASSWORD", "CHANGE_ME_manager"),
    },
}

# Allow the static frontend to be served from a different origin during
# development (e.g. a live-server on another port) without breaking AJAX.
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
