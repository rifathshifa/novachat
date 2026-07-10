from flask import session
from flask_socketio import emit
from app.extensions import socketio, db
from app.models import User, CallHistory, BlockedUser
import datetime

@socketio.on('call_initiate')
def on_call_initiate(data):
    caller_id = session.get('user_id')
    if not caller_id:
        emit('call_error', {'error': 'Unauthorized session'})
        return
        
    recipient_id = data.get('recipient_id')
    media_type = data.get('media_type', 'video')  # video or audio
    
    if not recipient_id:
        emit('call_error', {'error': 'Recipient ID is required'})
        return
        
    recipient_id = int(recipient_id)
    
    # Check block status
    is_blocked = BlockedUser.query.filter_by(blocker_id=caller_id, blocked_id=recipient_id).first() is not None
    is_blocked_by = BlockedUser.query.filter_by(blocker_id=recipient_id, blocked_id=caller_id).first() is not None
    
    if is_blocked or is_blocked_by:
        emit('call_error', {'error': 'Cannot place call. Moderation restriction active.'})
        return
        
    caller = User.query.get(caller_id)
    if not caller:
        return
        
    # Save call history as a default 'missed' call initially (updated if answered/completed)
    try:
        call = CallHistory(
            caller_id=caller_id,
            callee_id=recipient_id,
            status='missed',
            duration=0,
            created_at=datetime.datetime.utcnow()
        )
        db.session.add(call)
        db.session.commit()
        
        # Broadcast incoming call to recipient
        socketio.emit('call_incoming', {
            'call_id': call.id,
            'caller': caller.to_dict(),
            'media_type': media_type
        }, room=f"user_{recipient_id}")
        
        # Send back call_id to caller for confirmation
        emit('call_initiated_confirm', {
            'call_id': call.id,
            'recipient_id': recipient_id
        })
        
    except Exception as e:
        db.session.rollback()
        emit('call_error', {'error': 'Failed to initiate call context', 'details': str(e)})


@socketio.on('call_accept')
def on_call_accept(data):
    recipient_id = session.get('user_id')
    if not recipient_id:
        return
        
    call_id = data.get('call_id')
    caller_id = data.get('caller_id')
    
    if not call_id or not caller_id:
        return
        
    caller_id = int(caller_id)
    
    # Notify caller
    socketio.emit('call_accepted', {
        'call_id': call_id,
        'recipient_id': recipient_id
    }, room=f"user_{caller_id}")


@socketio.on('call_reject')
def on_call_reject(data):
    recipient_id = session.get('user_id')
    if not recipient_id:
        return
        
    call_id = data.get('call_id')
    caller_id = data.get('caller_id')
    
    if not call_id or not caller_id:
        return
        
    caller_id = int(caller_id)
    
    # Update CallHistory status in database
    call = CallHistory.query.get(int(call_id))
    if call and call.status == 'missed':
        try:
            call.status = 'rejected'
            db.session.commit()
        except Exception:
            db.session.rollback()
            
    # Notify caller
    socketio.emit('call_rejected', {
        'call_id': call_id,
        'recipient_id': recipient_id
    }, room=f"user_{caller_id}")


@socketio.on('call_offer')
def on_call_offer(data):
    sender_id = session.get('user_id')
    if not sender_id:
        return
        
    recipient_id = data.get('recipient_id')
    sdp = data.get('sdp')
    
    if not recipient_id or not sdp:
        return
        
    recipient_id = int(recipient_id)
    
    # Relay SDP offer to recipient
    socketio.emit('call_offer', {
        'sender_id': sender_id,
        'sdp': sdp
    }, room=f"user_{recipient_id}")


@socketio.on('call_answer')
def on_call_answer(data):
    sender_id = session.get('user_id')
    if not sender_id:
        return
        
    recipient_id = data.get('recipient_id')
    sdp = data.get('sdp')
    
    if not recipient_id or not sdp:
        return
        
    recipient_id = int(recipient_id)
    
    # Relay SDP answer to recipient
    socketio.emit('call_answer', {
        'sender_id': sender_id,
        'sdp': sdp
    }, room=f"user_{recipient_id}")


@socketio.on('ice_candidate')
def on_ice_candidate(data):
    sender_id = session.get('user_id')
    if not sender_id:
        return
        
    recipient_id = data.get('recipient_id')
    candidate = data.get('candidate')
    
    if not recipient_id or not candidate:
        return
        
    recipient_id = int(recipient_id)
    
    # Relay ICE candidate to recipient
    socketio.emit('ice_candidate', {
        'sender_id': sender_id,
        'candidate': candidate
    }, room=f"user_{recipient_id}")


@socketio.on('call_end')
def on_call_end(data):
    sender_id = session.get('user_id')
    if not sender_id:
        return
        
    call_id = data.get('call_id')
    recipient_id = data.get('recipient_id')
    duration = data.get('duration', 0)  # duration in seconds
    
    if not recipient_id:
        return
        
    recipient_id = int(recipient_id)
    
    # Update call history
    if call_id:
        call = CallHistory.query.get(int(call_id))
        if call:
            try:
                # If the status was not rejected/missed, update it to completed
                call.status = 'completed'
                call.duration = int(duration)
                db.session.commit()
            except Exception:
                db.session.rollback()
                
    # Relay call_ended to recipient
    socketio.emit('call_ended', {
        'sender_id': sender_id,
        'call_id': call_id
    }, room=f"user_{recipient_id}")
