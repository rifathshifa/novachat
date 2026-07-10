"""
groups.py — REST API routes for group management.
"""
import os
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Group, GroupMember, GroupMessage, User
from app.utils.security import (
    validate_file_signature, validate_file_extension,
    strip_exif_and_save, generate_secure_unique_filename,
)

groups_bp = Blueprint('groups', __name__)


def _require_member(group_id, user_id):
    """Helper: returns GroupMember or None."""
    return GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()


def _require_admin(group_id, user_id):
    """Helper: returns GroupMember if admin, else None."""
    m = _require_member(group_id, user_id)
    return m if (m and m.is_admin) else None


def _group_with_members(group):
    members_data = []
    for gm in group.members:
        u = User.query.get(gm.user_id)
        if u:
            d = u.to_dict()
            d['is_admin']  = gm.is_admin
            d['joined_at'] = gm.joined_at.isoformat() if gm.joined_at else None
            members_data.append(d)
    return group.to_dict(member_list=members_data)


# ─────────────────────────────────────────────────────────
# GET /api/groups  — list groups the current user belongs to
# ─────────────────────────────────────────────────────────
@groups_bp.route('', methods=['GET'])
@jwt_required()
def list_groups():
    current_user_id = int(get_jwt_identity())
    memberships = GroupMember.query.filter_by(user_id=current_user_id).all()
    result = []
    for gm in memberships:
        g = Group.query.get(gm.group_id)
        if g:
            result.append(_group_with_members(g))
    return jsonify(result), 200


# ─────────────────────────────────────────────────────────
# POST /api/groups  — create a new group
# ─────────────────────────────────────────────────────────
@groups_bp.route('', methods=['POST'])
@jwt_required()
def create_group():
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    name        = data.get('name', '').strip()
    description = data.get('description', '').strip()
    member_ids  = data.get('member_ids', [])

    if not name:
        return jsonify({'error': 'Group name is required'}), 400

    if len(name) > 100:
        return jsonify({'error': 'Group name is too long (max 100 characters)'}), 400

    try:
        group = Group(name=name, description=description, created_by=current_user_id)
        db.session.add(group)
        db.session.flush()  # get group.id

        # Creator is always an admin member
        creator_membership = GroupMember(group_id=group.id, user_id=current_user_id, is_admin=True)
        db.session.add(creator_membership)

        # Add invited members (skip invalid or duplicate)
        added_ids = {current_user_id}
        for uid in member_ids:
            uid = int(uid)
            if uid in added_ids:
                continue
            if User.query.get(uid):
                db.session.add(GroupMember(group_id=group.id, user_id=uid, is_admin=False))
                added_ids.add(uid)

        db.session.commit()
        return jsonify(_group_with_members(group)), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create group', 'details': str(e)}), 500


# ─────────────────────────────────────────────────────────
# GET /api/groups/<id>
# ─────────────────────────────────────────────────────────
@groups_bp.route('/<int:group_id>', methods=['GET'])
@jwt_required()
def get_group(group_id):
    current_user_id = int(get_jwt_identity())
    if not _require_member(group_id, current_user_id):
        return jsonify({'error': 'Access denied'}), 403

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    return jsonify(_group_with_members(group)), 200


# ─────────────────────────────────────────────────────────
# PUT /api/groups/<id>  — edit name / description (admin only)
# Supports multipart for image upload
# ─────────────────────────────────────────────────────────
@groups_bp.route('/<int:group_id>', methods=['PUT'])
@jwt_required()
def update_group(group_id):
    current_user_id = int(get_jwt_identity())
    if not _require_admin(group_id, current_user_id):
        return jsonify({'error': 'Admin privileges required'}), 403

    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    # Handle JSON or form data
    name        = (request.form.get('name')        or (request.get_json() or {}).get('name', '')).strip()
    description = (request.form.get('description') or (request.get_json() or {}).get('description', '')).strip()

    if name:
        if len(name) > 100:
            return jsonify({'error': 'Name too long'}), 400
        group.name = name
    if description is not None:
        group.description = description

    # Group image upload
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename:
            ct = file.content_type
            if ct not in ('image/png', 'image/jpeg', 'image/jpg', 'image/webp'):
                return jsonify({'error': 'Invalid image type. Use PNG or JPG.'}), 400

            if not validate_file_signature(file, ct):
                return jsonify({'error': 'Image signature mismatch'}), 400

            file.seek(0, os.SEEK_END)
            if file.tell() > 5 * 1024 * 1024:
                return jsonify({'error': 'Image exceeds 5 MB limit'}), 400
            file.seek(0)

            fname = generate_secure_unique_filename(file.filename)
            upload_dir = current_app.config['UPLOAD_FOLDER']
            os.makedirs(upload_dir, exist_ok=True)
            strip_exif_and_save(file, os.path.join(upload_dir, fname))
            group.image = f'/uploads/{fname}'

    try:
        db.session.commit()
        return jsonify(_group_with_members(group)), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update group', 'details': str(e)}), 500


# ─────────────────────────────────────────────────────────
# DELETE /api/groups/<id>  — only creator or admin can delete
# ─────────────────────────────────────────────────────────
@groups_bp.route('/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_group(group_id):
    current_user_id = int(get_jwt_identity())
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if not _require_admin(group_id, current_user_id):
        return jsonify({'error': 'Admin privileges required'}), 403

    try:
        db.session.delete(group)
        db.session.commit()
        return jsonify({'message': 'Group deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete group', 'details': str(e)}), 500


# ─────────────────────────────────────────────────────────
# POST /api/groups/<id>/members  { user_id }
# ─────────────────────────────────────────────────────────
@groups_bp.route('/<int:group_id>/members', methods=['POST'])
@jwt_required()
def add_member(group_id):
    current_user_id = int(get_jwt_identity())
    if not _require_admin(group_id, current_user_id):
        return jsonify({'error': 'Admin privileges required'}), 403

    data    = request.get_json() or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400

    user_id = int(user_id)
    if not User.query.get(user_id):
        return jsonify({'error': 'User not found'}), 404

    if _require_member(group_id, user_id):
        return jsonify({'message': 'User is already a member'}), 200

    try:
        db.session.add(GroupMember(group_id=group_id, user_id=user_id, is_admin=False))
        db.session.commit()
        return jsonify({'message': 'Member added'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add member', 'details': str(e)}), 500


# ─────────────────────────────────────────────────────────
# DELETE /api/groups/<id>/members/<user_id>
# ─────────────────────────────────────────────────────────
@groups_bp.route('/<int:group_id>/members/<int:user_id>', methods=['DELETE'])
@jwt_required()
def remove_member(group_id, user_id):
    current_user_id = int(get_jwt_identity())
    # Admin can remove others; any member can remove themselves (leave)
    if user_id != current_user_id and not _require_admin(group_id, current_user_id):
        return jsonify({'error': 'Admin privileges required'}), 403

    member = _require_member(group_id, user_id)
    if not member:
        return jsonify({'error': 'Member not found in group'}), 404

    try:
        db.session.delete(member)
        db.session.commit()
        return jsonify({'message': 'Member removed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to remove member', 'details': str(e)}), 500


# ─────────────────────────────────────────────────────────
# PUT /api/groups/<id>/members/<user_id>/admin  { is_admin: bool }
# ─────────────────────────────────────────────────────────
@groups_bp.route('/<int:group_id>/members/<int:user_id>/admin', methods=['PUT'])
@jwt_required()
def toggle_admin(group_id, user_id):
    current_user_id = int(get_jwt_identity())
    if not _require_admin(group_id, current_user_id):
        return jsonify({'error': 'Admin privileges required'}), 403

    member = _require_member(group_id, user_id)
    if not member:
        return jsonify({'error': 'Member not found'}), 404

    data     = request.get_json() or {}
    is_admin = bool(data.get('is_admin', False))
    member.is_admin = is_admin

    try:
        db.session.commit()
        return jsonify({'message': 'Admin status updated', 'is_admin': is_admin}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────────────────
# GET /api/groups/<id>/messages?limit=&before_id=
# ─────────────────────────────────────────────────────────
@groups_bp.route('/<int:group_id>/messages', methods=['GET'])
@jwt_required()
def get_group_messages(group_id):
    current_user_id = int(get_jwt_identity())
    if not _require_member(group_id, current_user_id):
        return jsonify({'error': 'Access denied'}), 403

    limit     = request.args.get('limit', 30, type=int)
    before_id = request.args.get('before_id', type=int)

    query = GroupMessage.query.filter_by(group_id=group_id)
    if before_id:
        query = query.filter(GroupMessage.id < before_id)

    messages = query.order_by(GroupMessage.id.desc()).limit(limit).all()
    messages.reverse()

    return jsonify([m.to_dict() for m in messages]), 200
