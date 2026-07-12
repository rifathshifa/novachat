"""
groups.py — Socket.IO event handlers for group chat.
Covers: group_join_room, group_message_send, group_typing_start/stop,
        group_message_edit, group_message_delete.
"""
from flask import request
from flask_socketio import join_room, leave_room, emit
from app.extensions import socketio, db
from app.models import GroupMember, GroupMessage, Group, User
from app.sockets import get_user_id_from_sid
import datetime


def _room(group_id):
    return f'group_{group_id}'


def _is_member(group_id, user_id):
    return GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first() is not None


def _is_admin(group_id, user_id):
    m = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    return m is not None and m.is_admin


# ─────────────────────────────────────────────────────────
# Join all group rooms the user belongs to (called on connect)
# ─────────────────────────────────────────────────────────
@socketio.on('group_join_rooms')
def on_group_join_rooms(data=None):
    user_id = get_user_id_from_sid(request.sid)
    if not user_id:
        return
    memberships = GroupMember.query.filter_by(user_id=user_id).all()
    for gm in memberships:
        join_room(_room(gm.group_id))


# ─────────────────────────────────────────────────────────
# Send group message
# ─────────────────────────────────────────────────────────
@socketio.on('group_message_send')
def on_group_message_send(data):
    user_id  = get_user_id_from_sid(request.sid)
    group_id = data.get('group_id')
    if not user_id or not group_id:
        return

    group_id = int(group_id)
    if not _is_member(group_id, user_id):
        emit('group_error', {'error': 'Not a member of this group'})
        return

    content      = data.get('content', '').strip()
    content_type = data.get('content_type', 'text')
    file_url     = data.get('file_url')
    file_name    = data.get('file_name')
    file_size    = data.get('file_size')
    parent_id    = data.get('parent_id')
    mention_ids  = data.get('mention_ids', [])  # list of user_ids for @mentions

    if content_type != 'text' and not content and file_url:
        content = file_url

    if not content:
        emit('group_error', {'error': 'Message content cannot be empty'})
        return

    try:
        msg = GroupMessage(
            group_id     = group_id,
            sender_id    = user_id,
            content      = content,
            content_type = content_type,
            file_url     = file_url,
            file_name    = file_name,
            file_size    = int(file_size) if file_size else None,
            parent_id    = int(parent_id) if parent_id else None,
            created_at   = datetime.datetime.utcnow(),
        )
        db.session.add(msg)
        db.session.commit()

        msg_dict = msg.to_dict()
        msg_dict['mention_ids'] = mention_ids

        # Broadcast to all group members
        socketio.emit('group_message_new', msg_dict, room=_room(group_id))

        # If there are @mentions, send targeted notifications
        for uid in mention_ids:
            socketio.emit('group_mention', {
                'group_id':   group_id,
                'message_id': msg.id,
                'from_user_id': user_id,
            }, room=f'user_{uid}')

    except Exception as e:
        db.session.rollback()
        emit('group_error', {'error': 'Failed to send group message', 'details': str(e)})


# ─────────────────────────────────────────────────────────
# Group typing indicators
# ─────────────────────────────────────────────────────────
@socketio.on('group_typing_start')
def on_group_typing_start(data):
    user_id  = get_user_id_from_sid(request.sid)
    group_id = data.get('group_id')
    if not user_id or not group_id:
        return
    group_id = int(group_id)
    if not _is_member(group_id, user_id):
        return
    user = User.query.get(user_id)
    username = user.username if user else 'Someone'
    socketio.emit('group_typing_start', {
        'group_id': group_id,
        'user_id':  user_id,
        'username': username,
    }, room=_room(group_id), include_self=False)


@socketio.on('group_typing_stop')
def on_group_typing_stop(data):
    user_id  = get_user_id_from_sid(request.sid)
    group_id = data.get('group_id')
    if not user_id or not group_id:
        return
    group_id = int(group_id)
    socketio.emit('group_typing_stop', {
        'group_id': group_id,
        'user_id':  user_id,
    }, room=_room(group_id), include_self=False)


# ─────────────────────────────────────────────────────────
# Edit group message
# ─────────────────────────────────────────────────────────
@socketio.on('group_message_edit')
def on_group_message_edit(data):
    user_id     = get_user_id_from_sid(request.sid)
    message_id  = data.get('message_id')
    new_content = data.get('new_content', '').strip()
    if not user_id or not message_id or not new_content:
        return

    msg = GroupMessage.query.get(int(message_id))
    if not msg or msg.sender_id != user_id or msg.is_deleted or msg.content_type != 'text':
        return

    try:
        msg.content   = new_content
        msg.is_edited = True
        msg.edited_at = datetime.datetime.utcnow()
        db.session.commit()

        socketio.emit('group_message_update', {
            'message_id': msg.id,
            'group_id':   msg.group_id,
            'content':    new_content,
            'is_edited':  True,
            'edited_at':  msg.edited_at.isoformat(),
        }, room=_room(msg.group_id))

    except Exception:
        db.session.rollback()


# ─────────────────────────────────────────────────────────
# Delete group message
# ─────────────────────────────────────────────────────────
@socketio.on('group_message_delete')
def on_group_message_delete(data):
    user_id    = get_user_id_from_sid(request.sid)
    message_id = data.get('message_id')
    if not user_id or not message_id:
        return

    msg = GroupMessage.query.get(int(message_id))
    if not msg or msg.is_deleted:
        return

    # Only the sender or a group admin can delete
    if msg.sender_id != user_id and not _is_admin(msg.group_id, user_id):
        return

    try:
        msg.is_deleted = True
        msg.content    = 'This message was deleted'
        db.session.commit()

        socketio.emit('group_message_update', {
            'message_id': msg.id,
            'group_id':   msg.group_id,
            'content':    'This message was deleted',
            'is_deleted': True,
        }, room=_room(msg.group_id))

    except Exception:
        db.session.rollback()
