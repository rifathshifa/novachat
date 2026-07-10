import os
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import User, BlockedUser
from app.utils.security import (
    validate_file_signature, 
    strip_exif_and_save, 
    generate_secure_unique_filename
)

users_bp = Blueprint('users', __name__)

@users_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(int(current_user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict(include_private=True)), 200


@users_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(int(current_user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    # Handle multipart/form-data for bio/status and file uploads
    bio = request.form.get('bio')
    custom_status = request.form.get('custom_status')
    
    if bio is not None:
        user.bio = bio.strip()
    if custom_status is not None:
        user.custom_status = custom_status.strip()
        
    # Handle profile image file upload
    if 'profile_image' in request.files:
        file = request.files['profile_image']
        if file and file.filename:
            # File validation
            content_type = file.content_type
            if content_type not in ['image/png', 'image/jpeg', 'image/jpg']:
                return jsonify({'error': 'Invalid image format. Only PNG and JPG are allowed.'}), 400
                
            # Perform magic number signature check
            if not validate_file_signature(file, content_type):
                return jsonify({'error': 'File signature mismatch. Fake extension detected.'}), 400
                
            # File size validation (limit 5MB for profile picture)
            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)
            if size > 5 * 1024 * 1024:
                return jsonify({'error': 'Image size exceeds maximum limit of 5MB.'}), 400
                
            # Generate secure filename
            secure_fname = generate_secure_unique_filename(file.filename)
            upload_dir = current_app.config['UPLOAD_FOLDER']
            if not os.path.exists(upload_dir):
                os.makedirs(upload_dir)
                
            destination = os.path.join(upload_dir, secure_fname)
            
            # Strip EXIF and save
            strip_exif_and_save(file, destination)
            
            # Save path inside User model
            user.profile_image = f"/uploads/{secure_fname}"
            
    try:
        db.session.commit()
        
        # We will broadcast profile updates dynamically via Socket.IO in the socket layer.
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict(include_private=True)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Database transaction failed', 'details': str(e)}), 500


@users_bp.route('/search', methods=['GET'])
@jwt_required()
def search_users():
    current_user_id = int(get_jwt_identity())
    query_str = request.args.get('q', '').strip()
    
    if not query_str:
        return jsonify([]), 200
        
    # Search users matching query, excluding current user
    results = User.query.filter(
        (User.id != current_user_id) & 
        ((User.username.like(f"%{query_str}%")) | (User.email.like(f"%{query_str}%")))
    ).limit(20).all()
    
    users_list = []
    for u in results:
        # Check block status
        is_blocked = BlockedUser.query.filter_by(blocker_id=current_user_id, blocked_id=u.id).first() is not None
        is_blocked_by = BlockedUser.query.filter_by(blocker_id=u.id, blocked_id=current_user_id).first() is not None
        
        user_data = u.to_dict()
        user_data['is_blocked'] = is_blocked
        user_data['is_blocked_by'] = is_blocked_by
        users_list.append(user_data)
        
    return jsonify(users_list), 200


@users_bp.route('/block', methods=['POST'])
@jwt_required()
def block_user():
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    target_id = data.get('user_id')
    
    if not target_id:
        return jsonify({'error': 'Target user_id is required'}), 400
        
    target_id = int(target_id)
    if current_user_id == target_id:
        return jsonify({'error': 'You cannot block yourself'}), 400
        
    target_user = User.query.get(target_id)
    if not target_user:
        return jsonify({'error': 'Target user not found'}), 404
        
    # Check if already blocked
    existing = BlockedUser.query.filter_by(blocker_id=current_user_id, blocked_id=target_id).first()
    if existing:
        return jsonify({'message': 'User is already blocked'}), 200
        
    try:
        block = BlockedUser(blocker_id=current_user_id, blocked_id=target_id)
        db.session.add(block)
        db.session.commit()
        return jsonify({'message': f'User {target_user.username} blocked successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Database transaction failed', 'details': str(e)}), 500


@users_bp.route('/unblock', methods=['POST'])
@jwt_required()
def unblock_user():
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    target_id = data.get('user_id')
    
    if not target_id:
        return jsonify({'error': 'Target user_id is required'}), 400
        
    target_id = int(target_id)
    block = BlockedUser.query.filter_by(blocker_id=current_user_id, blocked_id=target_id).first()
    
    if not block:
        return jsonify({'error': 'Block relationship not found'}), 404
        
    try:
        db.session.delete(block)
        db.session.commit()
        return jsonify({'message': 'User unblocked successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Database transaction failed', 'details': str(e)}), 500


@users_bp.route('/blocked', methods=['GET'])
@jwt_required()
def get_blocked_users():
    current_user_id = int(get_jwt_identity())
    blocked_relations = BlockedUser.query.filter_by(blocker_id=current_user_id).all()
    
    blocked_list = []
    for rel in blocked_relations:
        u = User.query.get(rel.blocked_id)
        if u:
            blocked_list.append(u.to_dict())
            
    return jsonify(blocked_list), 200
