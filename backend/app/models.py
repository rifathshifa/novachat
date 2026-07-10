from datetime import datetime
import json
from app.extensions import db, bcrypt


# ─────────────────────────────────────────────────────────
# User
# ─────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = 'user'

    id             = db.Column(db.Integer, primary_key=True)
    username       = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email          = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash  = db.Column(db.String(256), nullable=False)
    bio            = db.Column(db.String(256), default='')
    status         = db.Column(db.String(20), default='Offline')   # Online | Offline | Away
    custom_status  = db.Column(db.String(100), default='')
    profile_image  = db.Column(db.String(256), default=None)
    last_seen      = db.Column(db.DateTime, default=datetime.utcnow)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    messages_sent     = db.relationship('Message',     foreign_keys='Message.sender_id',
                                        backref='sender',   lazy=True, cascade='all, delete-orphan')
    messages_received = db.relationship('Message',     foreign_keys='Message.receiver_id',
                                        backref='receiver', lazy=True, cascade='all, delete-orphan')

    blocked_initiated = db.relationship('BlockedUser', foreign_keys='BlockedUser.blocker_id',
                                        backref='blocker', lazy=True, cascade='all, delete-orphan')
    blocked_received  = db.relationship('BlockedUser', foreign_keys='BlockedUser.blocked_id',
                                        backref='blocked', lazy=True, cascade='all, delete-orphan')

    calls_made     = db.relationship('CallHistory', foreign_keys='CallHistory.caller_id',
                                     backref='caller', lazy=True, cascade='all, delete-orphan')
    calls_received = db.relationship('CallHistory', foreign_keys='CallHistory.callee_id',
                                     backref='callee', lazy=True, cascade='all, delete-orphan')

    group_memberships = db.relationship('GroupMember', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def is_blocking(self, user_id):
        return BlockedUser.query.filter_by(blocker_id=self.id, blocked_id=user_id).first() is not None

    def is_blocked_by(self, user_id):
        return BlockedUser.query.filter_by(blocker_id=user_id, blocked_id=self.id).first() is not None

    def to_dict(self, include_private=False):
        data = {
            'id':           self.id,
            'username':     self.username,
            'bio':          self.bio,
            'status':       self.status,
            'custom_status': self.custom_status,
            'profile_image': self.profile_image,
            'last_seen':    self.last_seen.isoformat() if self.last_seen else None,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }
        if include_private:
            data['email'] = self.email
        return data


# ─────────────────────────────────────────────────────────
# Message  (1-to-1 direct messages)
# ─────────────────────────────────────────────────────────
class Message(db.Model):
    __tablename__ = 'message'

    id           = db.Column(db.Integer, primary_key=True)
    sender_id    = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    receiver_id  = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    content      = db.Column(db.Text, nullable=False)
    content_type = db.Column(db.String(20), default='text')   # text | image | video | audio | voice | file
    file_url     = db.Column(db.String(512), default=None)    # for non-text messages
    file_name    = db.Column(db.String(255), default=None)    # original filename for display
    file_size    = db.Column(db.Integer, default=None)        # bytes
    status       = db.Column(db.String(20), default='sent')   # sent | delivered | read
    is_deleted   = db.Column(db.Boolean, default=False)       # delete for everyone
    deleted_for  = db.Column(db.Text, default='[]')           # JSON list of user_ids who deleted for themselves
    is_pinned    = db.Column(db.Boolean, default=False)
    is_edited    = db.Column(db.Boolean, default=False)
    edited_at    = db.Column(db.DateTime, default=None)
    parent_id    = db.Column(db.Integer, db.ForeignKey('message.id', ondelete='SET NULL'), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    # Self-referential for replies
    replies = db.relationship('Message', backref=db.backref('parent', remote_side=[id]), lazy=True)
    # Reactions
    reactions = db.relationship('MessageReaction', backref='message', lazy=True, cascade='all, delete-orphan')

    def get_deleted_for(self):
        try:
            return json.loads(self.deleted_for or '[]')
        except (ValueError, TypeError):
            return []

    def add_deleted_for(self, user_id):
        ids = self.get_deleted_for()
        if user_id not in ids:
            ids.append(user_id)
        self.deleted_for = json.dumps(ids)

    def is_visible_to(self, user_id):
        """Returns False if this message was deleted for this specific user."""
        return user_id not in self.get_deleted_for()

    def to_dict(self, viewer_id=None):
        deleted_for_ids = self.get_deleted_for()
        # If globally deleted or deleted for this viewer, mask the content
        effectively_deleted = self.is_deleted or (viewer_id is not None and viewer_id in deleted_for_ids)

        reactions_data = {}
        for r in self.reactions:
            reactions_data.setdefault(r.emoji, []).append(r.user_id)

        parent_preview = None
        if self.parent_id and self.parent:
            parent_preview = {
                'id':           self.parent.id,
                'sender_id':    self.parent.sender_id,
                'content':      self.parent.content if not self.parent.is_deleted else 'Deleted message',
                'content_type': self.parent.content_type,
            }

        return {
            'id':           self.id,
            'sender_id':    self.sender_id,
            'receiver_id':  self.receiver_id,
            'content':      'This message was deleted' if effectively_deleted else self.content,
            'content_type': self.content_type,
            'file_url':     self.file_url,
            'file_name':    self.file_name,
            'file_size':    self.file_size,
            'status':       self.status,
            'is_deleted':   effectively_deleted,
            'is_pinned':    self.is_pinned,
            'is_edited':    self.is_edited,
            'edited_at':    self.edited_at.isoformat() if self.edited_at else None,
            'parent_id':    self.parent_id,
            'parent':       parent_preview,
            'reactions':    reactions_data,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


# ─────────────────────────────────────────────────────────
# MessageReaction  (emoji reactions on DM messages)
# ─────────────────────────────────────────────────────────
class MessageReaction(db.Model):
    __tablename__ = 'message_reaction'
    __table_args__ = (
        db.UniqueConstraint('message_id', 'user_id', 'emoji', name='_msg_user_emoji_uc'),
    )

    id         = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('message.id', ondelete='CASCADE'), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('user.id',    ondelete='CASCADE'), nullable=False)
    emoji      = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'message_id': self.message_id,
            'user_id':    self.user_id,
            'emoji':      self.emoji,
        }


# ─────────────────────────────────────────────────────────
# BlockedUser
# ─────────────────────────────────────────────────────────
class BlockedUser(db.Model):
    __tablename__ = 'blocked_user'
    __table_args__ = (db.UniqueConstraint('blocker_id', 'blocked_id', name='_blocker_blocked_uc'),)

    id         = db.Column(db.Integer, primary_key=True)
    blocker_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    blocked_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'blocker_id': self.blocker_id,
            'blocked_id': self.blocked_id,
            'created_at': self.created_at.isoformat(),
        }


# ─────────────────────────────────────────────────────────
# CallHistory
# ─────────────────────────────────────────────────────────
class CallHistory(db.Model):
    __tablename__ = 'call_history'

    id         = db.Column(db.Integer, primary_key=True)
    caller_id  = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    callee_id  = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    call_type  = db.Column(db.String(10), default='audio')  # audio | video
    status     = db.Column(db.String(20), nullable=False)   # missed | completed | rejected
    duration   = db.Column(db.Integer, default=0)           # seconds
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'caller_id':  self.caller_id,
            'callee_id':  self.callee_id,
            'call_type':  self.call_type,
            'status':     self.status,
            'duration':   self.duration,
            'created_at': self.created_at.isoformat(),
        }


# ─────────────────────────────────────────────────────────
# Group
# ─────────────────────────────────────────────────────────
class Group(db.Model):
    __tablename__ = 'group'

    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300), default='')
    image       = db.Column(db.String(256), default=None)
    created_by  = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members  = db.relationship('GroupMember',  backref='group', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('GroupMessage', backref='group', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, member_list=None):
        return {
            'id':          self.id,
            'name':        self.name,
            'description': self.description,
            'image':       self.image,
            'created_by':  self.created_by,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
            'members':     member_list or [],
        }


# ─────────────────────────────────────────────────────────
# GroupMember
# ─────────────────────────────────────────────────────────
class GroupMember(db.Model):
    __tablename__ = 'group_member'
    __table_args__ = (db.UniqueConstraint('group_id', 'user_id', name='_group_user_uc'),)

    id         = db.Column(db.Integer, primary_key=True)
    group_id   = db.Column(db.Integer, db.ForeignKey('group.id',  ondelete='CASCADE'), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('user.id',   ondelete='CASCADE'), nullable=False)
    is_admin   = db.Column(db.Boolean, default=False)
    joined_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'group_id':  self.group_id,
            'user_id':   self.user_id,
            'is_admin':  self.is_admin,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
        }


# ─────────────────────────────────────────────────────────
# GroupMessage
# ─────────────────────────────────────────────────────────
class GroupMessage(db.Model):
    __tablename__ = 'group_message'

    id           = db.Column(db.Integer, primary_key=True)
    group_id     = db.Column(db.Integer, db.ForeignKey('group.id', ondelete='CASCADE'), nullable=False)
    sender_id    = db.Column(db.Integer, db.ForeignKey('user.id',  ondelete='CASCADE'), nullable=False)
    content      = db.Column(db.Text, nullable=False)
    content_type = db.Column(db.String(20), default='text')  # text | image | video | audio | voice | file
    file_url     = db.Column(db.String(512), default=None)
    file_name    = db.Column(db.String(255), default=None)
    file_size    = db.Column(db.Integer, default=None)
    is_deleted   = db.Column(db.Boolean, default=False)
    is_edited    = db.Column(db.Boolean, default=False)
    edited_at    = db.Column(db.DateTime, default=None)
    parent_id    = db.Column(db.Integer, db.ForeignKey('group_message.id', ondelete='SET NULL'), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    sender  = db.relationship('User', foreign_keys=[sender_id], lazy=True)
    replies = db.relationship('GroupMessage', backref=db.backref('parent', remote_side=[id]), lazy=True)

    def to_dict(self):
        sender_data = None
        if self.sender:
            sender_data = {'id': self.sender.id, 'username': self.sender.username,
                           'profile_image': self.sender.profile_image}
        return {
            'id':           self.id,
            'group_id':     self.group_id,
            'sender_id':    self.sender_id,
            'sender':       sender_data,
            'content':      'This message was deleted' if self.is_deleted else self.content,
            'content_type': self.content_type,
            'file_url':     self.file_url,
            'file_name':    self.file_name,
            'file_size':    self.file_size,
            'is_deleted':   self.is_deleted,
            'is_edited':    self.is_edited,
            'edited_at':    self.edited_at.isoformat() if self.edited_at else None,
            'parent_id':    self.parent_id,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }
