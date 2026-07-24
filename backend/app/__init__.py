import os
import re
from flask import Flask, send_from_directory, jsonify, request as flask_request
from app.config import Config
from app.extensions import db, bcrypt, jwt, socketio, cors


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ── Initialize Extensions ──
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # Match any localhost origin (with or without port, http or https)
    LOCALHOST_REGEX = re.compile(r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$")

    # Generate list of allowed origins (including regex for localhost)
    allowed_origins = list(app.config['CORS_ALLOWED_ORIGINS'])
    allowed_origins.extend([
        re.compile(r"^https?://localhost(:\d+)?$"),
        re.compile(r"^https?://127\.0\.0\.1(:\d+)?$"),
        re.compile(r"^https?://\[::1\](:\d+)?$")
    ])

    # ── CORS for REST API (supports credentials / HttpOnly cookies) ──
    cors.init_app(app, resources={r'/api/*': {
        'origins': allowed_origins,
        'supports_credentials': True,
    }})

    # ── Ensure CORS headers on ALL responses (including JWT errors) ──
    @app.after_request
    def add_cors_headers(response):
        origin = flask_request.headers.get('Origin')
        allowed = app.config['CORS_ALLOWED_ORIGINS']
        
        # Support wildcard '*' — echo back the request origin (safe with credentials)
        if allowed == ['*'] or allowed == '*':
            if origin:
                response.headers['Access-Control-Allow-Origin'] = origin
            else:
                response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
            return response

        is_allowed = False
        if origin:
            if origin in allowed:
                is_allowed = True
            elif LOCALHOST_REGEX.match(origin):
                is_allowed = True

        if is_allowed:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        return response

    # ── JWT Error Callbacks (return JSON with CORS-safe responses) ──
    @jwt.unauthorized_loader
    def unauthorized_callback(reason):
        return jsonify({'error': 'Missing or invalid authorization token', 'details': reason}), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(reason):
        return jsonify({'error': 'Invalid token', 'details': reason}), 401

    # ── Socket.IO with same CORS policy ──
    raw_origins = app.config['CORS_ALLOWED_ORIGINS']

    # Support wildcard '*' for production deployments
    if raw_origins == ['*'] or raw_origins == '*':
        socketio_origins = '*'
    else:
        socketio_origins = list(raw_origins)
        # Allow common localhost ports in development
        dev_ports = list(range(5173, 5185)) + list(range(3000, 3010))
        for port in dev_ports:
            for scheme in ["http", "https"]:
                socketio_origins.extend([
                    f"{scheme}://localhost:{port}",
                    f"{scheme}://127.0.0.1:{port}",
                    f"{scheme}://[::1]:{port}"
                ])
        seen = set()
        socketio_origins = [x for x in socketio_origins if not (x in seen or seen.add(x))]

    socketio.init_app(
        app,
        cors_allowed_origins=socketio_origins,
        async_mode='threading',      # threading for dev (eventlet incompatible with Python 3.14)
        logger=False,
        engineio_logger=False,
    )

    # ── Register REST Blueprints ──
    from app.routes.auth     import auth_bp
    from app.routes.users    import users_bp
    from app.routes.messages import messages_bp
    from app.routes.groups   import groups_bp

    app.register_blueprint(auth_bp,     url_prefix='/api/auth')
    app.register_blueprint(users_bp,    url_prefix='/api/users')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(groups_bp,   url_prefix='/api/groups')

    # ── Register Socket Event Handlers ──
    from app.sockets import register_socket_events
    register_socket_events(app)

    # ── Serve uploaded media ──
    @app.route('/uploads/<filename>', methods=['GET'])
    def serve_upload(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # ── Serve built frontend (production) ──
    FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'frontend', 'dist')

    @app.route('/assets/<path:filename>')
    def serve_frontend_assets(filename):
        assets_dir = os.path.join(FRONTEND_DIST, 'assets')
        return send_from_directory(assets_dir, filename)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        """SPA catch-all — serves index.html for all non-API paths."""
        # Don't interfere with API and upload routes — return JSON 404
        if path.startswith(('api/', 'uploads/')):
            return jsonify({'error': 'Not found'}), 404
        index_path = os.path.join(FRONTEND_DIST, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(FRONTEND_DIST, 'index.html')
        return jsonify({
            'error': 'Frontend not built. Run `cd frontend && npm run build` first.',
            'hint': 'For development, run `npm run dev` in frontend/ separately.'
        }), 200

    # ── Auto-create DB tables & uploads folder ──
    with app.app_context():
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        db.create_all()

    return app

