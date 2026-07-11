import os
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models import Message, User, BlockedUser, MessageReaction
from app.utils.security import (
    validate_file_signature,
    validate_file_extension,
    strip_exif_and_save,
    generate_secure_unique_filename,
    ALLOWED_CONTENT_TYPES,
)

messages_bp = Blueprint('messages', __name__)


# ─────────────────────────────────────────────────────────
# GET /api/messages/history?contact_id=&limit=&before_id=
# ─────────────────────────────────────────────────────────
@messages_bp.route('/history', methods=['GET'])
@jwt_required()
def get_chat_history():
    current_user_id = int(get_jwt_identity())
    contact_id = request.args.get('contact_id')
    limit      = request.args.get('limit', 30, type=int)
    before_id  = request.args.get('before_id', type=int)

    if not contact_id:
        return jsonify({'error': 'contact_id is required'}), 400

    contact_id = int(contact_id)

    query = Message.query.filter(
        ((Message.sender_id == current_user_id) & (Message.receiver_id == contact_id)) |
        ((Message.sender_id == contact_id)       & (Message.receiver_id == current_user_id))
    )

    if before_id:
        query = query.filter(Message.id < before_id)

    messages = query.order_by(Message.id.desc()).limit(limit).all()
    messages.reverse()

    # Serialize, filtering out messages deleted for this viewer
    result = []
    for msg in messages:
        if msg.is_visible_to(current_user_id):
            result.append(msg.to_dict(viewer_id=current_user_id))

    return jsonify(result), 200


# ─────────────────────────────────────────────────────────
# POST /api/messages/upload
# Handles all file types. Returns file_url, file_name,
# file_size, content_type so the socket event can carry them.
# ─────────────────────────────────────────────────────────
@messages_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_attachment():
    current_user_id = int(get_jwt_identity())

    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request'}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    # Optional: check block relationship
    contact_id = request.form.get('contact_id')
    if contact_id:
        contact_id = int(contact_id)
        blocked    = BlockedUser.query.filter_by(blocker_id=current_user_id, blocked_id=contact_id).first()
        blocked_by = BlockedUser.query.filter_by(blocker_id=contact_id,       blocked_id=current_user_id).first()
        if blocked or blocked_by:
            return jsonify({'error': 'File transfer blocked. Moderation restriction active.'}), 403

    raw_type = file.content_type or ''
    declared_type = raw_type.split(';')[0].strip()

    # ── Allowlist check ──
    if declared_type not in ALLOWED_CONTENT_TYPES:
        return jsonify({'error': f'File type "{declared_type}" is not allowed.'}), 400

    # ── Extension validation ──
    if not validate_file_extension(file.filename, declared_type):
        return jsonify({'error': 'File extension does not match its content type.'}), 400

    # ── Size limits ──
    is_image = declared_type.startswith('image/')
    is_video = declared_type.startswith('video/')
    if is_image:
        max_size = 5 * 1024 * 1024       # 5 MB
    elif is_video:
        max_size = 100 * 1024 * 1024     # 100 MB
    else:
        max_size = 25 * 1024 * 1024      # 25 MB

    file.seek(0, os.SEEK_END)
    size_bytes = file.tell()
    file.seek(0)

    if size_bytes > max_size:
        limit_mb = max_size // (1024 * 1024)
        return jsonify({'error': f'File exceeds the {limit_mb} MB limit for this file type.'}), 400

    # ── Magic byte signature check ──
    if not validate_file_signature(file, declared_type):
        return jsonify({'error': 'File signature validation failed. The file may be corrupted or misrepresented.'}), 400

    # ── Generate safe filename ──
    secure_fname = generate_secure_unique_filename(file.filename)
    upload_dir   = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)
    destination  = os.path.join(upload_dir, secure_fname)

    # ── Save file ──
    if is_image and declared_type in ('image/png', 'image/jpeg', 'image/jpg', 'image/webp'):
        strip_exif_and_save(file, destination)
    else:
        chunk_size = 8192
        with open(destination, 'wb') as f:
            while True:
                chunk = file.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)

    # ── Determine frontend content_type category ──
    if is_image:
        category = 'image'
    elif is_video:
        category = 'video'
    elif declared_type.startswith('audio/'):
        category = 'audio'
    else:
        category = 'file'

    return jsonify({
        'file_url':     f'/uploads/{secure_fname}',
        'file_name':    file.filename,           # original filename for display
        'file_size':    size_bytes,              # bytes
        'content_type': declared_type,           # MIME type
        'category':     category,               # image | video | audio | file
    }), 200


# ─────────────────────────────────────────────────────────
# POST /api/messages/react   { message_id, emoji }
# DELETE /api/messages/react { message_id, emoji }
# ─────────────────────────────────────────────────────────
@messages_bp.route('/react', methods=['POST', 'DELETE'])
@jwt_required()
def react_to_message():
    current_user_id = int(get_jwt_identity())
    data       = request.get_json() or {}
    message_id = data.get('message_id')
    emoji      = data.get('emoji', '').strip()

    if not message_id or not emoji:
        return jsonify({'error': 'message_id and emoji are required'}), 400

    msg = Message.query.get(int(message_id))
    if not msg or msg.is_deleted:
        return jsonify({'error': 'Message not found'}), 404

    # Only participants of the conversation can react
    if msg.sender_id != current_user_id and msg.receiver_id != current_user_id:
        return jsonify({'error': 'Forbidden'}), 403

    if request.method == 'POST':
        existing = MessageReaction.query.filter_by(
            message_id=msg.id,
            user_id=current_user_id,
            emoji=emoji
        ).first()
        if existing:
            return jsonify({'message': 'Already reacted'}), 200

        try:
            reaction = MessageReaction(message_id=msg.id, user_id=current_user_id, emoji=emoji)
            db.session.add(reaction)
            db.session.commit()

            # Emit socket event to both parties (done here via import)
            _emit_reaction_update(msg, emoji, current_user_id, 'added')

            return jsonify({'message': 'Reaction added', 'reaction': reaction.to_dict()}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to save reaction', 'details': str(e)}), 500

    else:  # DELETE
        existing = MessageReaction.query.filter_by(
            message_id=msg.id,
            user_id=current_user_id,
            emoji=emoji
        ).first()
        if not existing:
            return jsonify({'error': 'Reaction not found'}), 404

        try:
            db.session.delete(existing)
            db.session.commit()
            _emit_reaction_update(msg, emoji, current_user_id, 'removed')
            return jsonify({'message': 'Reaction removed'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to remove reaction', 'details': str(e)}), 500


def _emit_reaction_update(msg, emoji, user_id, action):
    """Broadcast reaction change to both conversation participants via Socket.IO."""
    try:
        from app.extensions import socketio
        payload = {
            'message_id': msg.id,
            'user_id':    user_id,
            'emoji':      emoji,
            'action':     action,   # 'added' | 'removed'
        }
        socketio.emit('message_reaction', payload, room=f'user_{msg.sender_id}')
        if msg.receiver_id != msg.sender_id:
            socketio.emit('message_reaction', payload, room=f'user_{msg.receiver_id}')
    except Exception:
        pass  # Non-critical — message will refresh on next load


# ─────────────────────────────────────────────────────────
# GET /api/messages/pinned?contact_id=
# ─────────────────────────────────────────────────────────
@messages_bp.route('/pinned', methods=['GET'])
@jwt_required()
def get_pinned_messages():
    current_user_id = int(get_jwt_identity())
    contact_id = request.args.get('contact_id', type=int)

    if not contact_id:
        return jsonify({'error': 'contact_id is required'}), 400

    pinned = Message.query.filter(
        Message.is_pinned == True,
        Message.is_deleted == False,
        (
            ((Message.sender_id == current_user_id) & (Message.receiver_id == contact_id)) |
            ((Message.sender_id == contact_id)       & (Message.receiver_id == current_user_id))
        )
    ).order_by(Message.created_at.desc()).all()

    return jsonify([m.to_dict(viewer_id=current_user_id) for m in pinned]), 200
