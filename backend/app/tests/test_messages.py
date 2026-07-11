import unittest
import json
import io
from app import create_app
from app.extensions import db
from app.models import User, Message, BlockedUser
from app.config import Config
from flask_jwt_extended import create_access_token

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    JWT_COOKIE_SECURE = False
    JWT_SECRET_KEY = 'test-jwt-secret-key'
    UPLOAD_FOLDER = './test_uploads'

class MessagesTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create two test users
        self.user1 = User(username='userone', email='userone@nova.com')
        self.user1.set_password('password123')
        db.session.add(self.user1)

        self.user2 = User(username='usertwo', email='usertwo@nova.com')
        self.user2.set_password('password123')
        db.session.add(self.user2)
        
        db.session.commit()

        # Generate JWT headers
        self.token1 = create_access_token(identity=str(self.user1.id))
        self.headers1 = {'Authorization': f'Bearer {self.token1}'}

        self.token2 = create_access_token(identity=str(self.user2.id))
        self.headers2 = {'Authorization': f'Bearer {self.token2}'}

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
        # Clean up test_uploads if it exists
        if os.path.exists('./test_uploads'):
            import shutil
            shutil.rmtree('./test_uploads')

    def test_get_chat_history(self):
        # Create some mock messages between user1 and user2
        msg1 = Message(sender_id=self.user1.id, receiver_id=self.user2.id, content='Hello')
        msg2 = Message(sender_id=self.user2.id, receiver_id=self.user1.id, content='Hi back')
        db.session.add_all([msg1, msg2])
        db.session.commit()

        # Retrieve history
        response = self.client.get(
            f'/api/messages/history?contact_id={self.user2.id}',
            headers=self.headers1
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['content'], 'Hello')
        self.assertEqual(data[1]['content'], 'Hi back')

    def test_block_and_unblock_user(self):
        # Block user2
        response = self.client.post(
            '/api/users/block',
            data=json.dumps({'user_id': self.user2.id}),
            content_type='application/json',
            headers=self.headers1
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('blocked successfully', data['message'])

        # Verify blocking relationship
        self.assertTrue(self.user1.is_blocking(self.user2.id))
        self.assertTrue(self.user2.is_blocked_by(self.user1.id))

        # Check list of blocked users
        response = self.client.get('/api/users/blocked', headers=self.headers1)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['username'], 'usertwo')

        # Try to upload file when block active - should fail
        png_data = b'\x89PNG\r\n\x1a\n' + b'\x00' * 50
        response = self.client.post(
            '/api/messages/upload',
            data={
                'file': (io.BytesIO(png_data), 'test.png'),
                'contact_id': str(self.user2.id)
            },
            content_type='multipart/form-data',
            headers=self.headers1
        )
        self.assertEqual(response.status_code, 403)

        # Unblock user2
        response = self.client.post(
            '/api/users/unblock',
            data=json.dumps({'user_id': self.user2.id}),
            content_type='application/json',
            headers=self.headers1
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.user1.is_blocking(self.user2.id))

    def test_file_upload_validation(self):
        # 1. Test uploading valid PNG
        png_data = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        response = self.client.post(
            '/api/messages/upload',
            data={
                'file': (io.BytesIO(png_data), 'test.png'),
                'contact_id': str(self.user2.id)
            },
            content_type='multipart/form-data',
            headers=self.headers1
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('file_url', data)
        self.assertEqual(data['content_type'], 'image/png')

        # 1b. Test uploading valid PNG with content type parameter
        response = self.client.post(
            '/api/messages/upload',
            data={
                'file': (io.BytesIO(png_data), 'test.png', 'image/png;charset=utf-8'),
                'contact_id': str(self.user2.id)
            },
            content_type='multipart/form-data',
            headers=self.headers1
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['content_type'], 'image/png')

        # 2. Test fake PNG (extension says .png, but magic bytes are wrong)
        fake_png_data = b'NOT_A_PNG_FILE' + b'\x00' * 100
        response = self.client.post(
            '/api/messages/upload',
            data={
                'file': (io.BytesIO(fake_png_data), 'fake.png'),
                'contact_id': str(self.user2.id)
            },
            content_type='multipart/form-data',
            headers=self.headers1
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('File signature validation failed', data['error'])

        # 3. Test profile picture upload validation
        response = self.client.put(
            '/api/users/profile',
            data={
                'profile_image': (io.BytesIO(png_data), 'profile.png'),
                'bio': 'New Bio',
                'custom_status': 'Coding'
            },
            content_type='multipart/form-data',
            headers=self.headers1
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['user']['bio'], 'New Bio')
        self.assertEqual(data['user']['custom_status'], 'Coding')
        self.assertIsNotNone(data['user']['profile_image'])

    def test_audio_upload_validation(self):
        # List of audio formats to test: (filename, content_type_header, magic_bytes, expected_declared)
        formats = [
            ('voice.webm', 'audio/webm;codecs=opus', b'\x1a\x45\xdf\xa3' + b'\x00' * 50, 'audio/webm'),
            ('voice.webm', 'audio/webm', b'\x1a\x45\xdf\xa3' + b'\x00' * 50, 'audio/webm'),
            ('voice.mp3', 'audio/mp3', b'ID3' + b'\x00' * 50, 'audio/mp3'),
            ('voice.mp3', 'audio/mpeg', b'ID3' + b'\x00' * 50, 'audio/mpeg'),
            ('voice.ogg', 'audio/ogg;codecs=opus', b'OggS' + b'\x00' * 50, 'audio/ogg'),
            ('voice.ogg', 'audio/ogg', b'OggS' + b'\x00' * 50, 'audio/ogg'),
            ('voice.wav', 'audio/wav', b'RIFF\x00\x00\x00\x00WAVE' + b'\x00' * 50, 'audio/wav'),
            ('voice.wav', 'audio/x-wav', b'RIFF\x00\x00\x00\x00WAVE' + b'\x00' * 50, 'audio/x-wav'),
            ('voice.m4a', 'audio/x-m4a', b'\x00\x00\x00\x18ftyp' + b'\x00' * 50, 'audio/x-m4a'),
            ('voice.m4a', 'audio/mp4', b'\x00\x00\x00\x18ftyp' + b'\x00' * 50, 'audio/mp4')
        ]

        for fname, mime_hdr, data_bytes, expected_mime in formats:
            response = self.client.post(
                '/api/messages/upload',
                data={
                    'file': (io.BytesIO(data_bytes), fname, mime_hdr),
                    'contact_id': str(self.user2.id)
                },
                content_type='multipart/form-data',
                headers=self.headers1
            )
            self.assertEqual(response.status_code, 200, f"Failed on {fname} with {mime_hdr}")
            data = json.loads(response.data)
            self.assertIn('file_url', data)
            self.assertEqual(data['content_type'], expected_mime)

import os
if __name__ == '__main__':
    unittest.main()

