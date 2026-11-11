import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

def _load_env_file(filepath: Path):
    """Safely loads key-value pairs from .env into os.environ if file exists."""
    if not filepath.exists():
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip()
                if v.startswith(('"', "'")):
                    q = v[0]
                    end_idx = v.find(q, 1)
                    v = v[1:end_idx] if end_idx != -1 else v.strip(q)
                else:
                    if " #" in v:
                        v = v.split(" #", 1)[0].strip()
                    elif "\t#" in v:
                        v = v.split("\t#", 1)[0].strip()
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

_load_env_file(ROOT_DIR / ".env")
_load_env_file(BASE_DIR / ".env")

class Settings:
    PROJECT_NAME: str = "HSMLE India B2B Portal"
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

    # Email & Notifications (Google Apps Script Integration)
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "google_apps_script").lower()
    GOOGLE_APPS_SCRIPT_URL: str = os.getenv("GOOGLE_APPS_SCRIPT_URL", "")
    GOOGLE_APPS_SCRIPT_SECRET: str = os.getenv("GOOGLE_APPS_SCRIPT_SECRET", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "info@hsmleindia.com")
    EMAIL_FROM_NAME: str = os.getenv("EMAIL_FROM_NAME", "HSMLE India")
    RFQ_NOTIFICATION_EMAIL: str = os.getenv("RFQ_NOTIFICATION_EMAIL", "sales@hsmleindia.com")

    # Corporate Contact Details (Strictly "HSMLE India" branding)
    BRAND_NAME: str = "HSMLE India"
    LEGAL_STATUS: str = "ISO 9001:2015 Certified Manufacturer & Supplier"
    GSTIN: str = "09AANFH3126K1Z4"
    PRIMARY_PHONE: str = "+91-7942841070"
    LANDLINE_PHONE: str = "0120-4017357"
    OFFICIAL_EMAIL: str = "info@hsmleindia.com"
    SALES_EMAIL: str = "sales@hsmleindia.com"
    PRIMARY_DOMAIN: str = "https://www.hsmleindia.in/"
    OFFICE_ADDRESS: str = "UGF-12 / 12A, Ansal Plaza-1, Chiranjeev Vihar, Ghaziabad, Uttar Pradesh 201002, India"
    FACTORY_ADDRESS: str = "Plot-63, Village Bayana, Near Wave City, Ghaziabad, Uttar Pradesh 201002, India"

    @property
    def is_gas_url_valid(self) -> bool:
        """Returns True if GOOGLE_APPS_SCRIPT_URL is a valid Web App deployment ending in /exec."""
        u = (self.GOOGLE_APPS_SCRIPT_URL or "").strip()
        return (
            u.startswith("https://script.google.com/macros/s/")
            and u.endswith("/exec")
            and "YOUR_DEPLOYMENT_ID" not in u
        )

    @property
    def is_gas_secret_configured(self) -> bool:
        """Returns True if GOOGLE_APPS_SCRIPT_SECRET is non-empty and not a placeholder."""
        s = (self.GOOGLE_APPS_SCRIPT_SECRET or "").strip()
        return bool(s) and ("YOUR_LONG_RANDOM" not in s)

    @property
    def is_gas_secret_url(self) -> bool:
        """Returns True if secret is accidentally set to an HTTP/HTTPS URL."""
        s = (self.GOOGLE_APPS_SCRIPT_SECRET or "").strip()
        return s.startswith("http://") or s.startswith("https://")

    @property
    def is_gas_secret_length_valid(self) -> bool:
        """Returns True if secret has 64 hex characters and is not a URL."""
        s = (self.GOOGLE_APPS_SCRIPT_SECRET or "").strip()
        return len(s) == 64 and not self.is_gas_secret_url

    def get_gas_diagnostic(self) -> dict:
        """Returns safe diagnostic dictionary without exposing secret values."""
        return {
            "Google Apps Script URL valid": self.is_gas_url_valid,
            "Google Apps Script secret configured": self.is_gas_secret_configured,
            "Google Apps Script secret is URL": self.is_gas_secret_url,
            "Google Apps Script secret length valid": self.is_gas_secret_length_valid,
        }

settings = Settings()
