import os
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

    # ── CORS for REST API (supports credentials / HttpOnly cookies) ──
    cors.init_app(app, resources={r'/api/*': {
        'origins': app.config['CORS_ALLOWED_ORIGINS'],
        'supports_credentials': True,
    }})

    # ── Ensure CORS headers on ALL responses (including JWT errors) ──
    @app.after_request
    def add_cors_headers(response):
        origin = flask_request.headers.get('Origin')
        allowed = app.config['CORS_ALLOWED_ORIGINS']
        if origin and origin in allowed:
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
    socketio.init_app(
        app,
        cors_allowed_origins=app.config['CORS_ALLOWED_ORIGINS'],
        async_mode='eventlet',       # eventlet is in requirements.txt
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

    # ── Auto-create DB tables & uploads folder ──
    with app.app_context():
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        db.create_all()

    return app

