"""
Creates (or resets) the two demo login accounts in APP_USER:

    frontdesk / frontdesk123   -> Role = Front Desk, linked to StaffID FD01
    manager   / manager123     -> Role = Manager

Run once, using a DB user with write access to APP_USER
(the 'hotel_manager' user works, since it has ALL PRIVILEGES):

    python seed_users.py

CHANGE THESE PASSWORDS before this app is used by real staff.
"""
import pymysql
import pymysql.cursors
from werkzeug.security import generate_password_hash

import config

USERS = [
    ("U0001", "frontdesk", "frontdesk123", "Rita Danso", "Front Desk", "FD01"),
    ("U0002", "manager", "manager123", "Ama Boateng", "Manager", None),
]


def main():
    creds = config.DB_USERS["Manager"]
    conn = pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=creds["user"],
        password=creds["password"],
        database=config.DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            for user_id, username, password, full_name, role, staff_id in USERS:
                cur.execute(
                    """
                    INSERT INTO APP_USER (UserID, Username, PasswordHash, FullName, Role, StaffID)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        PasswordHash = VALUES(PasswordHash),
                        FullName = VALUES(FullName),
                        Role = VALUES(Role),
                        StaffID = VALUES(StaffID)
                    """,
                    (user_id, username, generate_password_hash(password), full_name, role, staff_id),
                )
                print(f"Seeded {username} ({role})")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
