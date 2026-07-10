import sqlite3

conn = sqlite3.connect('novachat.db')
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
for t in tables:
    tname = t[0]
    cols = [r[1] for r in conn.execute(f'PRAGMA table_info("{tname}")').fetchall()]
    print(f"{tname}: {cols}")
conn.close()
