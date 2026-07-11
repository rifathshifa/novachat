from app.extensions import socketio, db
from flask import request, session
from flask_jwt_extended import decode_token
from app.models import User
import datetime

# Memory store mapping: user_id (int) -> set of socket sids (str)
connected_users = {}

def get_online_users():
    return list(connected_users.keys())

def register_socket_events(app):
    # Import modules to ensure event handlers are registered with the socketio instance
    from . import chat
    from . import signaling
    from . import groups
    
    @socketio.on('connect')
    def handle_connect(auth=None):
        # Authenticate user from handshake token
        token = None
        if auth and isinstance(auth, dict):
            token = auth.get('token')
        if not token:
            token = request.args.get('token')
            
        if not token:
            # Reject connection
            return False
            
        try:
            decoded = decode_token(token)
            user_id = int(decoded['sub'])
            
            # Associate sid with user_id
            sid = request.sid
            session['user_id'] = user_id
            
            if user_id not in connected_users:
                connected_users[user_id] = set()
                
            connected_users[user_id].add(sid)
            
            # Join user's individual room for targeted routing
            from flask_socketio import join_room
            join_room(f"user_{user_id}")
            
            # Update presence in database
            user = User.query.get(user_id)
            if user:
                user.status = "Online"
                db.session.commit()
                
                # Update all 'sent' messages addressed to this user to 'delivered'
                from app.models import Message
                sent_messages = Message.query.filter_by(receiver_id=user_id, status='sent').all()
                if sent_messages:
                    for msg in sent_messages:
                        msg.status = 'delivered'
                    db.session.commit()
                    
                    # Notify the senders of these messages
                    for msg in sent_messages:
                        socketio.emit('message_status', {
                            'message_id': msg.id,
                            'status': 'delivered'
                        }, room=f'user_{msg.sender_id}')
                
                # Broadcast presence update to everyone
                socketio.emit('presence_change', {
                    'user_id': user_id,
                    'status': 'Online'
                }, include_self=False)
                
        except Exception as e:
            # Reject connection on invalid token
            return False

    @socketio.on('disconnect')
    def handle_disconnect():
        user_id = session.get('user_id')
        sid = request.sid
        
        if user_id and user_id in connected_users:
            connected_users[user_id].discard(sid)
            
            # If no remaining connections, user is officially offline
            if not connected_users[user_id]:
                del connected_users[user_id]
                
                # Update presence in database
                user = User.query.get(user_id)
                if user:
                    user.status = "Offline"
                    user.last_seen = datetime.datetime.utcnow()
                    db.session.commit()
                    
                    # Broadcast status change
                    socketio.emit('presence_change', {
                        'user_id': user_id,
                        'status': 'Offline',
                        'last_seen': user.last_seen.isoformat()
                    }, include_self=False)
