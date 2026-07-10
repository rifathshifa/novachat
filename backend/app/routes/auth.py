from flask import Blueprint, request, jsonify, make_response, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token, 
    set_refresh_cookies, unset_jwt_cookies, 
    jwt_required, get_jwt_identity
)
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from app.extensions import db
from app.models import User
from app.utils.helpers import validate_email_format, send_password_reset_email

auth_bp = Blueprint('auth', __name__)

def get_serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
    if not username or not email or not password:
        return jsonify({'error': 'Missing required fields'}), 400
        
    if not validate_email_format(email):
        return jsonify({'error': 'Invalid email format'}), 400
        
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
        
    # Check if user already exists
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400
        
    try:
        new_user = User(username=username, email=email)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Database transaction failed', 'details': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    login_id = data.get('login_id', '').strip()  # can be email or username
    password = data.get('password', '')
    
    if not login_id or not password:
        return jsonify({'error': 'Missing credentials'}), 400
        
    # Query user by username or email
    user = User.query.filter((User.email == login_id) | (User.username == login_id)).first()
    
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email/username or password'}), 401
        
    # Generate tokens
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    response = make_response(jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'user': user.to_dict(include_private=True)
    }))
    
    # Set the refresh token inside a secure, HTTP-only cookie
    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    user = User.query.get(int(current_user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 401
        
    new_access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'access_token': new_access_token,
        'user': user.to_dict(include_private=True)
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    response = make_response(jsonify({'message': 'Logout successful'}))
    unset_jwt_cookies(response)
    return response


@auth_bp.route('/reset-password-request', methods=['POST'])
def reset_password_request():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    
    if not email:
        return jsonify({'error': 'Missing email'}), 400
        
    user = User.query.filter_by(email=email).first()
    
    # Security note: To prevent user enumeration attacks, we still return 200 even if the user isn't found.
    # We only log or output the email reset link internally if user exists.
    if user:
        serializer = get_serializer()
        token = serializer.dumps(email, salt='password-reset-salt')
        # In a real app this link would point to the frontend reset page
        reset_link = f"http://localhost:5173/reset-password?token={token}"
        send_password_reset_email(email, reset_link)
        
    return jsonify({'message': 'If the email exists, a password reset link has been sent.'}), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    token = data.get('token', '').strip()
    new_password = data.get('password', '')
    
    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400
        
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400
        
    serializer = get_serializer()
    try:
        # Token expires in 15 minutes (900 seconds)
        email = serializer.loads(token, salt='password-reset-salt', max_age=900)
    except SignatureExpired:
        return jsonify({'error': 'The password reset token has expired'}), 403
    except (BadTimeSignature, Exception):
        return jsonify({'error': 'Invalid or tampered password reset token'}), 403
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User matching token signature not found'}), 404
        
    try:
        user.set_password(new_password)
        db.session.commit()
        return jsonify({'message': 'Password has been reset successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Database transaction failed', 'details': str(e)}), 500
