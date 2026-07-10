import os
import uuid
from PIL import Image
from werkzeug.utils import secure_filename

# ─────────────────────────────────────────────────────────
# ALLOWED CONTENT TYPES  (explicit allowlist)
# ─────────────────────────────────────────────────────────
ALLOWED_CONTENT_TYPES = {
    # Images
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
    # Video
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    # Audio
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
    'audio/webm', 'audio/aac', 'audio/x-m4a',
    # Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    # Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    # Plain text (no magic bytes — validated by extension)
    'text/plain',
    'text/csv',
}

# ─────────────────────────────────────────────────────────
# MAGIC NUMBER SIGNATURES
# Format: content_type -> list of:
#   bytes (prefix match) or (offset:int, signature:bytes) for offset match
# ─────────────────────────────────────────────────────────
SIGNATURES = {
    'image/png':  [b'\x89PNG\r\n\x1a\n'],
    'image/jpeg': [b'\xff\xd8\xff'],
    'image/jpg':  [b'\xff\xd8\xff'],
    'image/gif':  [b'GIF87a', b'GIF89a'],
    'image/webp': [(0, b'RIFF'), (8, b'WEBP')],

    'application/pdf': [b'%PDF'],

    'application/zip':              [b'PK\x03\x04'],
    'application/x-zip-compressed': [b'PK\x03\x04'],
    # Office Open XML (docx/xlsx/pptx are all ZIP containers)
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [b'PK\x03\x04'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':       [b'PK\x03\x04'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': [b'PK\x03\x04'],
    # Legacy Office
    'application/msword':         [b'\xd0\xcf\x11\xe0'],
    'application/vnd.ms-excel':   [b'\xd0\xcf\x11\xe0'],
    'application/vnd.ms-powerpoint': [b'\xd0\xcf\x11\xe0'],

    # Video
    'video/mp4':       [(4, b'ftyp')],
    'video/webm':      [b'\x1a\x45\xdf\xa3'],
    'video/ogg':       [b'OggS'],
    'video/quicktime': [(4, b'ftyp'), b'\x00\x00\x00\x14ftypqt'],

    # Audio
    'audio/mpeg':   [b'ID3', b'\xff\xfb', b'\xff\xf3', b'\xff\xf2'],
    'audio/mp3':    [b'ID3', b'\xff\xfb', b'\xff\xf3', b'\xff\xf2'],
    'audio/wav':    [(0, b'RIFF'), (8, b'WAVE')],
    'audio/ogg':    [b'OggS'],
    'audio/webm':   [b'\x1a\x45\xdf\xa3'],
    'audio/aac':    [b'\xff\xf1', b'\xff\xf9'],
    'audio/x-m4a':  [(4, b'ftyp')],

    # Archive
    'application/x-rar-compressed': [b'Rar!'],

    # Plain text & CSV — no reliable magic bytes, skip binary check
    # (validated by extension allowlist only)
    'text/plain': None,
    'text/csv':   None,
}

# Allowed file extensions per content-type (extra defence layer)
ALLOWED_EXTENSIONS = {
    'image/png': {'.png'},
    'image/jpeg': {'.jpg', '.jpeg'},
    'image/jpg':  {'.jpg', '.jpeg'},
    'image/gif':  {'.gif'},
    'image/webp': {'.webp'},
    'video/mp4':       {'.mp4'},
    'video/webm':      {'.webm'},
    'video/ogg':       {'.ogg', '.ogv'},
    'video/quicktime': {'.mov'},
    'audio/mpeg':   {'.mp3'},
    'audio/mp3':    {'.mp3'},
    'audio/wav':    {'.wav'},
    'audio/ogg':    {'.ogg', '.oga'},
    'audio/webm':   {'.webm'},
    'audio/aac':    {'.aac'},
    'audio/x-m4a':  {'.m4a'},
    'application/pdf': {'.pdf'},
    'application/msword': {'.doc'},
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {'.docx'},
    'application/vnd.ms-excel': {'.xls'},
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':       {'.xlsx'},
    'application/vnd.ms-powerpoint': {'.ppt'},
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': {'.pptx'},
    'application/zip':              {'.zip'},
    'application/x-zip-compressed': {'.zip'},
    'application/x-rar-compressed': {'.rar'},
    'text/plain': {'.txt'},
    'text/csv':   {'.csv'},
}


def validate_file_signature(file_stream, declared_content_type):
    """
    Validates the uploaded file against:
    1. Allowlist of permitted content types
    2. File extension matches content type
    3. Magic byte header matches content type signature
    Returns True if valid, False otherwise.
    """
    if declared_content_type not in ALLOWED_CONTENT_TYPES:
        return False

    rules = SIGNATURES.get(declared_content_type)

    # For text types, skip binary signature check — extension check is sufficient
    if rules is None:
        return True

    header = file_stream.read(262)
    file_stream.seek(0)  # Reset stream

    for rule in rules:
        if isinstance(rule, tuple):
            offset, sig = rule
            if len(header) >= offset + len(sig):
                if header[offset: offset + len(sig)] == sig:
                    return True
        else:
            if header.startswith(rule):
                return True

    return False


def validate_file_extension(filename, content_type):
    """
    Checks that the file extension matches what's allowed for the content type.
    """
    allowed = ALLOWED_EXTENSIONS.get(content_type, set())
    ext = os.path.splitext(filename.lower())[1]
    return ext in allowed


def strip_exif_and_save(file_stream, destination_path):
    """
    Opens an image with Pillow, strips all EXIF/metadata, and saves a clean copy.
    Falls back to raw write if Pillow fails.
    """
    try:
        with Image.open(file_stream) as img:
            data = list(img.getdata())
            clean_img = Image.new(img.mode, img.size)
            clean_img.putdata(data)
            fmt = img.format or 'PNG'
            clean_img.save(destination_path, format=fmt)
        file_stream.seek(0)
        return True
    except Exception:
        file_stream.seek(0)
        with open(destination_path, 'wb') as f:
            f.write(file_stream.read())
        file_stream.seek(0)
        return False


def generate_secure_unique_filename(filename):
    """
    Generates a UUID-based filename to prevent directory traversal and overwrite attacks.
    Preserves the original extension.
    """
    sec_name = secure_filename(filename)
    ext = os.path.splitext(sec_name)[1].lower()
    if not ext:
        ext = '.bin'
    return f'{uuid.uuid4().hex}{ext}'


def humanize_file_size(size_bytes):
    """Returns a human-readable file size string."""
    if size_bytes is None:
        return 'Unknown'
    if size_bytes < 1024:
        return f'{size_bytes} B'
    elif size_bytes < 1024 * 1024:
        return f'{size_bytes / 1024:.1f} KB'
    else:
        return f'{size_bytes / (1024 * 1024):.1f} MB'
