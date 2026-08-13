import os
from flask import Flask, g, send_from_directory, render_template
from flask_cors import CORS

import config
from routes.auth_routes import auth_bp
from routes.shared_routes import shared_bp
from routes.manager_routes import manager_bp

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")


def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
    app.config["SECRET_KEY"] = config.SECRET_KEY

    # Session cookie: readable only by the browser's requests to this API,
    # sent on same-site AJAX calls made with credentials: 'include'.
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    # The frontend is plain HTML/CSS/JS calling a JSON API, so it can be
    # hosted separately from Flask entirely — CORS just needs to allow it
    # to send the session cookie.
    CORS(app, supports_credentials=True, origins=config.CORS_ORIGINS)

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(shared_bp, url_prefix="/api")
    app.register_blueprint(manager_bp, url_prefix="/api")

    @app.teardown_appcontext
    def close_db(exception=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    # Dev convenience: serve the decoupled frontend from the same origin
    # so you can just run `python app.py` and open one URL. Delete this
    # route (and static_folder above) if you deploy the frontend elsewhere.
    @app.route("/")
    def serve_index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/<path:path>")
    def serve_static(path):
        return send_from_directory(FRONTEND_DIR, path)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=config.DEBUG)
    # app.run(debug = True)