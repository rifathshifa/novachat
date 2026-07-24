import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

class Config:
    # Security
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev_secret_key_nova_chat_12345')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt_dev_secret_key_nova_chat_abcde')
    
    # Database
    # Default to SQLite database file in the backend root directory
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 
        f'sqlite:///{os.path.join(BASE_DIR, "novachat.db")}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT Settings
    JWT_TOKEN_LOCATION = ['headers', 'cookies']
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    
    # Cookie settings for Refresh Token
    JWT_COOKIE_SECURE = os.environ.get('JWT_COOKIE_SECURE', 'False').lower() == 'true'
    JWT_COOKIE_CSRF_PROTECT = False  # Set to False to simplify cross-origin refresh for API usage
    JWT_REFRESH_COOKIE_NAME = 'refresh_token'
    JWT_REFRESH_COOKIE_PATH = '/api/auth/refresh'
    
    # Connection Pool (used with PostgreSQL; ignored by SQLite)
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
    
    # Frontend URL (for password reset links, etc.)
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
    
    # Upload Settings
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(BASE_DIR, 'uploads'))
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB max request size
    
    # CORS
    CORS_ALLOWED_ORIGINS = [
        origin.strip() for origin in os.environ.get(
            'CORS_ALLOWED_ORIGINS', 
            'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5176,http://127.0.0.1:5176'
        ).split(',') if origin.strip()
    ]
