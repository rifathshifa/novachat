"""
chat.py — Socket.IO event handlers for 1-to-1 direct messaging.
Covers: typing, message_send, message_read, message_edit,
        message_delete (for_me / for_everyone), message_pin,
        message_react.
"""
from flask import session
from flask_socketio import emit
from app.extensions import socketio, db
from app.models import Message, User, BlockedUser, MessageReaction
from app.sockets import connected_users
import datetime


# ─────────────────────────────────────────────────────────
# Typing indicators
# ─────────────────────────────────────────────────────────
@socketio.on('typing_start')
def on_typing_start(data):
    sender_id    = session.get('user_id')
    recipient_id = data.get('recipient_id')
    if not sender_id or not recipient_id:
        return
    if BlockedUser.query.filter_by(blocker_id=recipient_id, blocked_id=sender_id).first():
        return
    socketio.emit('typing_start', {'sender_id': sender_id}, room=f'user_{recipient_id}')


@socketio.on('typing_stop')
def on_typing_stop(data):
    sender_id    = session.get('user_id')
    recipient_id = data.get('recipient_id')
    if not sender_id or not recipient_id:
        return
    socketio.emit('typing_stop', {'sender_id': sender_id}, room=f'user_{recipient_id}')


# ─────────────────────────────────────────────────────────
# Send a new message
# ─────────────────────────────────────────────────────────
@socketio.on('message_send')
def on_message_send(data):
    sender_id = session.get('user_id')
    if not sender_id:
        emit('message_error', {'error': 'Unauthorized session'})
        return

    recipient_id = data.get('recipient_id')
    content      = data.get('content', '').strip()
    content_type = data.get('content_type', 'text')
    parent_id    = data.get('parent_id')
    file_url     = data.get('file_url')
    file_name    = data.get('file_name')
    file_size    = data.get('file_size')

    if not recipient_id:
        emit('message_error', {'error': 'recipient_id is required'})
        return

    # For non-text types, content holds the file URL
    if content_type != 'text' and not content and file_url:
        content = file_url

    if not content:
        emit('message_error', {'error': 'Message content cannot be empty'})
        return

    recipient_id = int(recipient_id)

    # Block check
    is_blocked    = BlockedUser.query.filter_by(blocker_id=sender_id,    blocked_id=recipient_id).first() is not None
    is_blocked_by = BlockedUser.query.filter_by(blocker_id=recipient_id, blocked_id=sender_id).first() is not None
    if is_blocked or is_blocked_by:
        emit('message_error', {'error': 'Cannot send message. Block restriction active.'})
        return

    is_online      = recipient_id in connected_users
    initial_status = 'delivered' if is_online else 'sent'

    try:
        new_msg = Message(
            sender_id    = sender_id,
            receiver_id  = recipient_id,
            content      = content,
            content_type = content_type,
            file_url     = file_url,
            file_name    = file_name,
            file_size    = int(file_size) if file_size else None,
            status       = initial_status,
            parent_id    = int(parent_id) if parent_id else None,
            created_at   = datetime.datetime.utcnow(),
        )
        db.session.add(new_msg)
        db.session.commit()

        msg_dict = new_msg.to_dict(viewer_id=sender_id)

        # Deliver to recipient
        socketio.emit('message_new', msg_dict, room=f'user_{recipient_id}')
        # Confirm to all sender sessions
        socketio.emit('message_sent_confirm', msg_dict, room=f'user_{sender_id}')

    except Exception as e:
        db.session.rollback()
        emit('message_error', {'error': 'Failed to save message', 'details': str(e)})


# ─────────────────────────────────────────────────────────
# Mark messages as read
# ─────────────────────────────────────────────────────────
@socketio.on('message_read')
def on_message_read(data):
    current_user_id = session.get('user_id')
    contact_id      = data.get('contact_id')
    if not current_user_id or not contact_id:
        return

    contact_id = int(contact_id)

    try:
        unread = Message.query.filter(
            Message.sender_id == contact_id,
            Message.receiver_id == current_user_id,
            Message.status.in_(['sent', 'delivered'])
        ).all()

        if unread:
            for msg in unread:
                msg.status = 'read'
            db.session.commit()

            for msg in unread:
                socketio.emit('message_status', {
                    'message_id': msg.id,
                    'status':     'read'
                }, room=f'user_{contact_id}')

            socketio.emit('messages_marked_read', {
                'contact_id': contact_id
            }, room=f'user_{current_user_id}')

    except Exception:
        db.session.rollback()


# ─────────────────────────────────────────────────────────
# Edit a message
# ─────────────────────────────────────────────────────────
@socketio.on('message_edit')
def on_message_edit(data):
    sender_id   = session.get('user_id')
    message_id  = data.get('message_id')
    new_content = data.get('new_content', '').strip()

    if not sender_id or not message_id or not new_content:
        return

    msg = Message.query.get(int(message_id))
    if not msg or msg.sender_id != sender_id or msg.is_deleted or msg.content_type != 'text':
        return

    try:
        msg.content   = new_content
        msg.is_edited = True
        msg.edited_at = datetime.datetime.utcnow()
        db.session.commit()

        payload = {
            'message_id': msg.id,
            'content':    new_content,
            'is_edited':  True,
            'edited_at':  msg.edited_at.isoformat(),
        }
        socketio.emit('message_update', payload, room=f'user_{msg.sender_id}')
        socketio.emit('message_update', payload, room=f'user_{msg.receiver_id}')

    except Exception:
        db.session.rollback()


# ─────────────────────────────────────────────────────────
# Delete a message  (for_me | for_everyone)
# ─────────────────────────────────────────────────────────
@socketio.on('message_delete')
def on_message_delete(data):
    user_id    = session.get('user_id')
    message_id = data.get('message_id')
    scope      = data.get('scope', 'for_everyone')  # 'for_me' | 'for_everyone'

    if not user_id or not message_id:
        return

    msg = Message.query.get(int(message_id))
    if not msg or msg.is_deleted:
        return

    # Only sender can delete for everyone
    if scope == 'for_everyone' and msg.sender_id != user_id:
        scope = 'for_me'

    # Must be a participant
    if msg.sender_id != user_id and msg.receiver_id != user_id:
        return

    try:
        if scope == 'for_everyone':
            msg.is_deleted = True
            msg.content    = 'This message was deleted'
            db.session.commit()

            payload = {'message_id': msg.id, 'content': 'This message was deleted', 'is_deleted': True}
            socketio.emit('message_update', payload, room=f'user_{msg.sender_id}')
            socketio.emit('message_update', payload, room=f'user_{msg.receiver_id}')

        else:  # for_me only
            msg.add_deleted_for(user_id)
            db.session.commit()

            # Only notify the requesting user's sessions
            socketio.emit('message_update', {
                'message_id': msg.id,
                'deleted_for_me': True,
            }, room=f'user_{user_id}')

    except Exception:
        db.session.rollback()


# ─────────────────────────────────────────────────────────
# Pin / Unpin a message
# ─────────────────────────────────────────────────────────
@socketio.on('message_pin')
def on_message_pin(data):
    user_id    = session.get('user_id')
    message_id = data.get('message_id')
    is_pinned  = bool(data.get('is_pinned', False))

    if not user_id or not message_id:
        return

    msg = Message.query.get(int(message_id))
    if not msg or (msg.sender_id != user_id and msg.receiver_id != user_id) or msg.is_deleted:
        return

    try:
        msg.is_pinned = is_pinned
        db.session.commit()

        payload = {'message_id': msg.id, 'is_pinned': is_pinned}
        socketio.emit('message_update', payload, room=f'user_{msg.sender_id}')
        socketio.emit('message_update', payload, room=f'user_{msg.receiver_id}')

    except Exception:
        db.session.rollback()


# ─────────────────────────────────────────────────────────
# React to a message  (add / remove emoji reaction)
# ─────────────────────────────────────────────────────────
@socketio.on('message_react')
def on_message_react(data):
    user_id    = session.get('user_id')
    message_id = data.get('message_id')
    emoji      = data.get('emoji', '').strip()
    action     = data.get('action', 'toggle')   # 'add' | 'remove' | 'toggle'

    if not user_id or not message_id or not emoji:
        return

    msg = Message.query.get(int(message_id))
    if not msg or msg.is_deleted:
        return

    if msg.sender_id != user_id and msg.receiver_id != user_id:
        return

    try:
        existing = MessageReaction.query.filter_by(
            message_id=msg.id, user_id=user_id, emoji=emoji
        ).first()

        if action == 'remove' or (action == 'toggle' and existing):
            if existing:
                db.session.delete(existing)
                db.session.commit()
                final_action = 'removed'
            else:
                return
        else:
            if not existing:
                reaction = MessageReaction(message_id=msg.id, user_id=user_id, emoji=emoji)
                db.session.add(reaction)
                db.session.commit()
            final_action = 'added'

        payload = {
            'message_id': msg.id,
            'user_id':    user_id,
            'emoji':      emoji,
            'action':     final_action,
        }
        socketio.emit('message_reaction', payload, room=f'user_{msg.sender_id}')
        if msg.receiver_id != msg.sender_id:
            socketio.emit('message_reaction', payload, room=f'user_{msg.receiver_id}')

    except Exception:
        db.session.rollback()
