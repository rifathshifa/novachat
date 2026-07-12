import unittest
import json
from app import create_app
from app.extensions import db
from app.models import User
from app.config import Config

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    JWT_COOKIE_SECURE = False

class AuthTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_register_successful(self):
        payload = {
            'username': 'novatester',
            'email': 'tester@nova.com',
            'password': 'password123'
        }
        response = self.client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertIn('User registered successfully', data['message'])

    def test_register_invalid_email(self):
        payload = {
            'username': 'novatester',
            'email': 'tester-at-nova.com',
            'password': 'password123'
        }
        response = self.client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('Invalid email format', data['error'])

    def test_register_short_password(self):
        payload = {
            'username': 'novatester',
            'email': 'tester@nova.com',
            'password': '123'
        }
        response = self.client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('Password must be at least 8 characters long', data['error'])

    def test_login_successful(self):
        # Register a test user
        user = User(username='novatester', email='tester@nova.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()

        # Login
        payload = {
            'login_id': 'tester@nova.com',
            'password': 'password123'
        }
        response = self.client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('access_token', data)
        self.assertEqual(data['user']['username'], 'novatester')

        # Check that the HttpOnly refresh token cookie is set
        cookie_header = response.headers.get('Set-Cookie')
        self.assertIsNotNone(cookie_header)
        self.assertIn('refresh_token', cookie_header)
        self.assertIn('HttpOnly', cookie_header)

    def test_login_failure(self):
        # Login with non-existent user
        payload = {
            'login_id': 'nobody@nova.com',
            'password': 'password123'
        }
        response = self.client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertIn('Invalid email/username or password', data['error'])

    def test_cors_headers(self):
        # Test that localhost dynamic ports get CORS headers
        response = self.client.post(
            '/api/auth/login',
            headers={'Origin': 'http://localhost:5176'}
        )
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5176')
        self.assertEqual(response.headers.get('Access-Control-Allow-Credentials'), 'true')

        # Test that standard config CORS origins get CORS headers
        response = self.client.post(
            '/api/auth/login',
            headers={'Origin': 'http://127.0.0.1:5173'}
        )
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5173')

        # Test that untrusted origins do not get CORS headers
        response = self.client.post(
            '/api/auth/login',
            headers={'Origin': 'http://attacker.com'}
        )
        self.assertIsNone(response.headers.get('Access-Control-Allow-Origin'))

if __name__ == '__main__':
    unittest.main()
