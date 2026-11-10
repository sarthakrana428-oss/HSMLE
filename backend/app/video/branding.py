"""
HSMLE Official Branding & Visual Asset Module
Renders corporate logos, industrial badges, ISO 9001 accreditation pills,
and watermark graphics using authentic project assets in a modern Platinum & Charcoal theme.
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from typing import Tuple, Optional

# Color Palette Constants: Modern Platinum & Charcoal Industrial Studio
COLOR_NAVY_DEEP = (248, 250, 252)     # #F8FAFC (Clean Pearl Studio Background)
COLOR_NAVY_SURFACE = (255, 255, 255)  # Pure White (Elevated Cards)
COLOR_BLUE = (30, 41, 59)             # #1E293B (Deep Graphite Slate)
COLOR_BLUE_LIGHT = (71, 85, 105)      # #475569 (Mid Slate)
COLOR_GOLD = (217, 119, 6)            # #D97706 (Industrial Amber / Gold)
COLOR_GOLD_LIGHT = (245, 158, 11)     # #F59E0B (Bright Gold)
COLOR_EMERALD = (16, 185, 129)        # #10B981 (Active Green)
COLOR_WHITE = (15, 23, 42)            # #0F172A (Deep Slate text on light cards)
COLOR_SLATE_LIGHT = (51, 65, 85)      # #334155 (Sub-headers)
COLOR_SLATE_MUTED = (100, 116, 139)   # #64748B (Muted text)
COLOR_SLATE_BORDER = (203, 213, 225)  # #CBD5E1 (Clean borders)
COLOR_HEADER_BG = (15, 23, 42)        # #0F172A (Top header bar)

class BrandingManager:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.logo_path = os.path.join(self.base_dir, 'static', 'images', 'branding', 'logo.png')
        if not os.path.exists(self.logo_path):
            self.logo_path = os.path.join(os.path.dirname(self.base_dir), 'frontend', 'assets', 'images', 'logo.png')
        self._load_logo()
        self._load_fonts()
        self._build_watermark_master()

    def _load_logo(self):
        """Load official HSMLE diamond logo."""
        if os.path.exists(self.logo_path):
            self.logo = Image.open(self.logo_path).convert('RGBA')
        else:
            self.logo = self._create_fallback_diamond()

    def _build_watermark_master(self):
        """Build high-resolution centered single golden HSMLE diamond watermark."""
        try:
            import numpy as np
            logo_p = os.path.join(self.base_dir, 'static', 'images', 'branding', 'logo.png')
            if not os.path.exists(logo_p):
                logo_p = self.logo_path
            logo = Image.open(logo_p).convert('RGBA')
            diamond = logo.crop((0, 0, 80, 80))
            w4, h4 = diamond.width * 4, diamond.height * 4
            up = diamond.resize((w4, h4), Image.Resampling.LANCZOS)
            arr = np.array(up)
            # Unify inner text into solid rich gold matching the golden H:
            is_dark = (arr[..., 0] < 120) & (arr[..., 1] < 120) & (arr[..., 2] < 120) & (arr[..., 3] > 100)
            arr[is_dark, 0] = 238
            arr[is_dark, 1] = 178
            arr[is_dark, 2] = 17
            unified = Image.fromarray(arr)
            r, g, b, a = unified.split()
            rgb = Image.merge("RGB", (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=2))
            r2, g2, b2 = rgb.split()
            a2 = a.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))
            self.watermark_master = Image.merge("RGBA", (r2, g2, b2, a2))
        except Exception as e:
            print("Warning building watermark master:", e)
            self.watermark_master = self.logo

    def _create_fallback_diamond(self) -> Image.Image:
        """Create a clean diamond emblem with HSMLE text if file missing."""
        im = Image.new('RGBA', (200, 200), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)
        points = [(100, 10), (190, 100), (100, 190), (10, 100)]
        draw.polygon(points, fill=COLOR_GOLD)
        draw.polygon([(100, 22), (178, 100), (100, 178), (22, 100)], fill=(15, 23, 42))
        return im

    def _load_fonts(self):
        """Load standard Windows typography."""
        font_dir = r"C:\Windows\Fonts"
        try:
            self.font_title_large = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 46)
            self.font_title_med = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 34)
            self.font_title_small = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 24)
            self.font_body = ImageFont.truetype(os.path.join(font_dir, "segoeui.ttf"), 20)
            self.font_body_bold = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 20)
            self.font_body_small = ImageFont.truetype(os.path.join(font_dir, "segoeui.ttf"), 16)
            self.font_mono = ImageFont.truetype(os.path.join(font_dir, "consola.ttf"), 17)
            self.font_mono_bold = ImageFont.truetype(os.path.join(font_dir, "consolab.ttf"), 17)
            self.font_outro = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 58)
        except:
            self.font_title_large = ImageFont.load_default()
            self.font_title_med = ImageFont.load_default()
            self.font_title_small = ImageFont.load_default()
            self.font_body = ImageFont.load_default()
            self.font_body_bold = ImageFont.load_default()
            self.font_body_small = ImageFont.load_default()
            self.font_mono = ImageFont.load_default()
            self.font_mono_bold = ImageFont.load_default()
            self.font_outro = ImageFont.load_default()

    def draw_watermark(self, canvas: Image.Image, center_x: Optional[int] = None, center_y: Optional[int] = None, alpha: float = 0.32):
        """Draw prominent centered golden HSMLE watermark on machine/canvas."""
        if alpha <= 0 or not hasattr(self, 'watermark_master'):
            return
        W, H = canvas.size
        wm_w = int(round(W * 0.32))
        wm_h = int(round(wm_w * (self.watermark_master.height / float(self.watermark_master.width))))
        wm_resized = self.watermark_master.resize((wm_w, wm_h), Image.Resampling.LANCZOS)

        r, g, b, a = wm_resized.split()
        a = a.point(lambda p: int(round(p * alpha)))
        wm_stamped = Image.merge("RGBA", (r, g, b, a))

        if center_x is not None and center_y is not None:
            pos_x = int(center_x - wm_w // 2)
            pos_y = int(center_y - wm_h // 2)
        else:
            pos_x = (W - wm_w) // 2
            pos_y = (H - wm_h) // 2

        pos_x = max(0, min(W - wm_w, pos_x))
        pos_y = max(0, min(H - wm_h, pos_y))
        canvas.paste(wm_stamped, (pos_x, pos_y), wm_stamped)

    def draw_corner_watermark(self, canvas: Image.Image, alpha: float = 1.0):
        self.draw_watermark(canvas, alpha=0.30 * alpha)

    def draw_iso_badge(self, canvas: Image.Image, x: int, y: int, alpha: float = 1.0):
        """Draw official ISO 9001:2015 certification pill."""
        if alpha <= 0:
            return
        draw = ImageDraw.Draw(canvas, 'RGBA')
        pill_w, pill_h = 240, 32
        fill_a = int(240 * alpha)
        draw.rectangle([x, y, x + pill_w, y + pill_h], fill=(255, 255, 255, fill_a), outline=(*COLOR_GOLD, fill_a), width=1)
        dot_r = 4
        draw.ellipse([x + 12, y + 12, x + 12 + dot_r*2, y + 12 + dot_r*2], fill=(*COLOR_GOLD, fill_a))
        draw.text((x + 28, y + 7), "ISO 9001:2015 CERTIFIED", font=self.font_mono_bold, fill=(*COLOR_GOLD, fill_a))

# Global singleton
branding = BrandingManager()
