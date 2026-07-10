"""
Migration script to add missing columns to the novachat.db SQLite database.
This aligns the DB schema with the current SQLAlchemy models.
"""
import sqlite3

conn = sqlite3.connect('novachat.db')
cursor = conn.cursor()

# ── Message table: add missing columns ──
migrations = [
    ('message', 'file_url',    'VARCHAR(512) DEFAULT NULL'),
    ('message', 'file_name',   'VARCHAR(255) DEFAULT NULL'),
    ('message', 'file_size',   'INTEGER DEFAULT NULL'),
    ('message', 'deleted_for', "TEXT DEFAULT '[]'"),
    ('message', 'is_edited',   'BOOLEAN DEFAULT 0'),
    ('message', 'edited_at',   'DATETIME DEFAULT NULL'),
    # ── CallHistory table: add missing column ──
    ('call_history', 'call_type', "VARCHAR(10) DEFAULT 'audio'"),
]

for table, column, col_type in migrations:
    # Check if column already exists
    existing = [r[1] for r in cursor.execute(f'PRAGMA table_info("{table}")').fetchall()]
    if column not in existing:
        sql = f'ALTER TABLE "{table}" ADD COLUMN {column} {col_type}'
        print(f"  Adding: {table}.{column}")
        cursor.execute(sql)
    else:
        print(f"  Skipped (exists): {table}.{column}")

conn.commit()
conn.close()
print("\nMigration complete!")
