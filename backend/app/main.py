import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import engine, Base
from .routers import categories, products, enquiries, quotations, admin, videos

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Official B2B API for HSMLE India Corporation Industrial Quality Control & Metrology Instruments"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*" # Allow all for local preview
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Mount Static Files
os.makedirs(settings.STATIC_DIR, exist_ok=True)
os.makedirs(settings.CATALOGUES_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")
app.mount("/catalogues", StaticFiles(directory=settings.CATALOGUES_DIR), name="catalogues")

# Mount Frontend if available for direct single-server browsing
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(settings.STATIC_DIR)), "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/portal", StaticFiles(directory=FRONTEND_DIR, html=True), name="portal")
    FRONTEND_ASSETS = os.path.join(FRONTEND_DIR, "assets")
    if os.path.exists(FRONTEND_ASSETS):
        app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="assets")

# Include Routers
app.include_router(categories.router, prefix=settings.API_V1_STR)
app.include_router(products.router, prefix=settings.API_V1_STR)
app.include_router(enquiries.router, prefix=settings.API_V1_STR)
app.include_router(quotations.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(videos.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "status": "online",
        "company": "HSMLE India Corporation",
        "message": "Welcome to HSMLE India Corporation B2B API",
        "docs_url": "/docs",
        "version": settings.VERSION
    }

@app.get("/health")
def healthcheck():
    return {"status": "healthy"}
