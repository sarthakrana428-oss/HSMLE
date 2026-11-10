import sys
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

db_path = Path(__file__).resolve().parent.parent / "data" / "hsmle.db"
conn = sqlite3.connect(str(db_path))
c = conn.cursor()

# 1. products table
c.execute("PRAGMA table_info(products)")
cols = [r[1] for r in c.fetchall()]
if "is_active" not in cols:
    c.execute("ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT 1")
    print("Added is_active column to products")
else:
    print("products already has is_active")

# 2. admin_users table
c.execute("PRAGMA table_info(admin_users)")
cols = [r[1] for r in c.fetchall()]
if "role" not in cols:
    c.execute("ALTER TABLE admin_users ADD COLUMN role VARCHAR(20) DEFAULT 'super_admin'")
    print("Added role column to admin_users")
else:
    print("admin_users already has role")

# 3. admin_audit_logs table
c.execute("""
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    admin_username VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    details TEXT,
    ip_address VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
)
""")
print("admin_audit_logs table verified")

# 4. Create a test staff user if not exists for testing role-based access
from app.security import get_password_hash
c.execute("SELECT id FROM admin_users WHERE username = 'staff_editor'")
staff = c.fetchone()
if not staff:
    h = get_password_hash("Staff@HSMLE2026!")
    c.execute("""
    INSERT INTO admin_users (username, email, hashed_password, role, is_active, is_superadmin)
    VALUES ('staff_editor', 'staff@hsmleindia.com', ?, 'staff', 1, 0)
    """, (h,))
    print("Created staff_editor user for role verification")
else:
    print("staff_editor already exists")

conn.commit()
conn.close()
print("Migration completed successfully.")
