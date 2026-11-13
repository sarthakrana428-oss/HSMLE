import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    PROJECT_NAME: str = "HSMLE India Corporation B2B Portal"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "hsmle-corp-secret-key-2026-super-secure-production-ready-jwt-token")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Rate Limiting
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/data/hsmle.db")
    
    # Static & Catalogues
    STATIC_DIR: str = str(BASE_DIR / "static")
    CATALOGUES_DIR: str = str(BASE_DIR / "static" / "catalogues")
    IMAGES_DIR: str = str(BASE_DIR / "static" / "images")
    
    # Initial Admin Credentials
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "info@hsmleindia.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin@HSMLE2026!")

settings = Settings()
