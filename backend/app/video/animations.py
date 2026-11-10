"""
HSMLE Advanced Animation & Cinematic Motion Graphics Engine
Light Platinum & Charcoal Industrial Studio Theme.
Fast rendering, smooth 25 FPS motion, no neon-blue sci-fi effects.
"""

import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from typing import Tuple, List, Optional, Dict, Any
from .branding import (
    COLOR_NAVY_DEEP, COLOR_NAVY_SURFACE, COLOR_BLUE, COLOR_BLUE_LIGHT,
    COLOR_GOLD, COLOR_GOLD_LIGHT, COLOR_EMERALD, COLOR_WHITE, COLOR_SLATE_LIGHT,
    COLOR_SLATE_MUTED, COLOR_SLATE_BORDER, COLOR_HEADER_BG, branding
)

# Easing Functions
def ease_in_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)

def ease_out_cubic(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1.0 - math.pow(1.0 - t, 3)

def ease_in_cubic(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * t

def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t

class StudioBackgroundRenderer:
    """Renders elegant light industrial studio background with soft floor plane."""
    def __init__(self, width: int = 1920, height: int = 1080):
        self.width = width
        self.height = height
        self._cached_bg: Optional[Image.Image] = None
        self._generate_static_bg()

    def _generate_static_bg(self):
        """Generate static base studio backdrop."""
        top_c = (248, 250, 252)    # #F8FAFC
        bot_c = (226, 232, 240)    # #E2E8F0
        arr = np.zeros((self.height, self.width, 3), dtype=np.float32)
        for y in range(self.height):
            t = y / float(self.height)
            arr[y, :, 0] = top_c[0] * (1.0 - t) + bot_c[0] * t
            arr[y, :, 1] = top_c[1] * (1.0 - t) + bot_c[1] * t
            arr[y, :, 2] = top_c[2] * (1.0 - t) + bot_c[2] * t

        # Radial soft spotlight centered behind machine
        cx, cy = self.width * 0.52, self.height * 0.50
        y_idx, x_idx = np.ogrid[:self.height, :self.width]
        dist = np.sqrt((x_idx - cx)**2 + (y_idx - cy)**2)
        glow = np.clip(1.0 - (dist / 920.0), 0.0, 1.0) ** 2.0
        arr += glow[:, :, None] * 18.0
        arr = np.clip(arr, 0, 255).astype(np.uint8)

        base_im = Image.fromarray(arr).convert('RGBA')
        draw = ImageDraw.Draw(base_im)

        # Subtle floor horizon line
        floor_y = int(self.height * 0.80)
        draw.line([(0, floor_y), (self.width, floor_y)], fill=(203, 213, 225, 180), width=1)

        # Subtle technical dots
        for x in range(80, self.width, 140):
            for y in range(80, floor_y, 100):
                draw.rectangle([(x, y), (x+1, y+1)], fill=(180, 195, 215, 80))

        self._cached_bg = base_im

    def get_background(self) -> Image.Image:
        return self._cached_bg.copy()

class MachineCompositor:
    """Composites machine with realistic soft floor shadow and cinematic positioning."""
    _cache = {}

    @staticmethod
    def composite_machine(
        canvas: Image.Image,
        machine_im: Image.Image,
        center_x: float,
        center_y: float,
        scale: float = 1.0,
        opacity: float = 1.0
    ):
        s_round = round(scale, 2)
        o_round = round(opacity, 2)
        key = (id(machine_im), machine_im.size, s_round, o_round)
        if key not in MachineCompositor._cache:
            if len(MachineCompositor._cache) > 48:
                MachineCompositor._cache.clear()
            new_w = max(10, int(machine_im.width * s_round))
            new_h = max(10, int(machine_im.height * s_round))

            scaled = machine_im.resize((new_w, new_h), Image.Resampling.BILINEAR)
            if o_round < 1.0:
                arr = np.array(scaled)
                arr[:, :, 3] = (arr[:, :, 3] * o_round).astype(np.uint8)
                scaled = Image.fromarray(arr)

            pad = 40
            shadow_w = int(new_w * 0.88)
            shadow_h = max(14, int(shadow_w * 0.12))
            shadow = Image.new('RGBA', (shadow_w + pad * 2, shadow_h + pad * 2), (0, 0, 0, 0))
            s_draw = ImageDraw.Draw(shadow)
            s_draw.ellipse([pad, pad, pad + shadow_w, pad + shadow_h], fill=(0, 0, 0, int(90 * o_round)))
            shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(6, shadow_h // 3)))
            MachineCompositor._cache[key] = (scaled, shadow, new_w, new_h, shadow_w, shadow_h, pad)

        scaled, shadow, new_w, new_h, shadow_w, shadow_h, pad = MachineCompositor._cache[key]
        x0 = int(center_x - new_w // 2)
        y0 = int(center_y - new_h // 2)
        bottom_y = y0 + new_h
        shadow_x = int(center_x - (shadow_w + pad * 2) // 2)
        shadow_y = bottom_y - int(shadow_h * 0.45) - pad

        canvas.alpha_composite(shadow, (shadow_x, shadow_y))
        canvas.alpha_composite(scaled, (x0, y0))

        return x0, y0, new_w, new_h

class MotionGraphicsRenderer:
    """Renders high-tech dynamic telemetry, laser scanning, and leader callouts in Platinum theme."""

    @staticmethod
    def draw_top_telemetry_bar(canvas: Image.Image, model: str, category: str, frame: int):
        """Persistent deep-slate engineering telemetry strip across the top of every frame."""
        draw = ImageDraw.Draw(canvas, 'RGBA')
        draw.rectangle([(0, 0), (1920, 52)], fill=(*COLOR_HEADER_BG, 255))
        draw.line([(0, 52), (1920, 52)], fill=(*COLOR_GOLD, 255), width=2)

        # Pulse indicator
        pulse = (math.sin(frame * 0.15) + 1.0) * 0.5
        dot_a = int(180 + 75 * pulse)
        draw.ellipse([(45, 20), (57, 32)], fill=(*COLOR_EMERALD, dot_a))

        # Branding & Location
        draw.text((70, 16), "HSMLE INDIA CORPORATION", font=branding.font_mono_bold, fill=(255, 255, 255, 255))
        draw.text((345, 16), "|", font=branding.font_mono, fill=(100, 116, 139, 255))
        draw.text((365, 16), "MORTA WORKS, GHAZIABAD", font=branding.font_mono, fill=(*COLOR_GOLD_LIGHT, 255))

        # Model
        draw.text((630, 16), "|", font=branding.font_mono, fill=(100, 116, 139, 255))
        draw.text((650, 16), f"MODEL: {model[:20]}", font=branding.font_mono_bold, fill=(241, 245, 249, 255))

        # Right-aligned Live Status
        draw.text((1580, 16), "ISO 9001:2015 CERTIFIED", font=branding.font_mono_bold, fill=(*COLOR_EMERALD, 255))

    @staticmethod
    def draw_laser_scanline(canvas: Image.Image, machine_box: Tuple[int, int, int, int], progress: float):
        """Renders precision golden-amber metrology laser scan across the machine."""
        x0, y0, mw, mh = machine_box
        scan_y = int(y0 + mh * progress)
        draw = ImageDraw.Draw(canvas, 'RGBA')

        margin = 40
        lx0 = max(20, x0 - margin)
        lx1 = min(1900, x0 + mw + margin)

        # Multi-layer gold laser glow
        draw.line([(lx0, scan_y), (lx1, scan_y)], fill=(*COLOR_GOLD_LIGHT, 255), width=2)
        draw.line([(lx0, scan_y-1), (lx1, scan_y-1)], fill=(*COLOR_GOLD_LIGHT, 120), width=1)
        draw.line([(lx0, scan_y+1), (lx1, scan_y+1)], fill=(*COLOR_GOLD_LIGHT, 120), width=1)

        badge_text = f"3D LASER METROLOGY SCAN • Y: {int(progress * 1000)} mm"
        draw.text((lx0 + 10, scan_y - 20), badge_text, font=branding.font_mono, fill=(*COLOR_GOLD, 220))

    @staticmethod
    def draw_component_callout(
        canvas: Image.Image,
        target_x: int,
        target_y: int,
        title: str,
        detail: str,
        side: str = 'left',
        alpha: float = 1.0,
        frame: int = 0
    ):
        """Renders technical leader line with targeting reticle and clean white card."""
        if alpha <= 0.05:
            return

        draw = ImageDraw.Draw(canvas, 'RGBA')
        a_int = int(255 * alpha)

        # Target node on machine
        r_pulse = 5 + int(3 * (math.sin(frame * 0.25) + 1.0) * 0.5)
        draw.ellipse([(target_x - r_pulse, target_y - r_pulse), (target_x + r_pulse, target_y + r_pulse)],
                     outline=(*COLOR_GOLD_LIGHT, a_int), width=2)
        draw.ellipse([(target_x - 3, target_y - 3), (target_x + 3, target_y + 3)],
                     fill=(*COLOR_GOLD, a_int))

        line_len = 110
        shelf_len = 280
        if side == 'left':
            elbow_x = target_x - line_len
            elbow_y = target_y - 30
            end_x = elbow_x - shelf_len
            card_x0, card_x1 = end_x, elbow_x
        else:
            elbow_x = target_x + line_len
            elbow_y = target_y - 30
            end_x = elbow_x + shelf_len
            card_x0, card_x1 = elbow_x, end_x

        draw.line([(target_x, target_y), (elbow_x, elbow_y)], fill=(*COLOR_GOLD, int(a_int * 0.85)), width=2)
        draw.line([(elbow_x, elbow_y), (end_x, elbow_y)], fill=(*COLOR_GOLD, a_int), width=2)

        # Elevated white card
        card_y0 = elbow_y - 54
        card_y1 = elbow_y - 4
        draw.rectangle([(card_x0, card_y0), (card_x1, card_y1)],
                       fill=(255, 255, 255, int(a_int * 0.95)), outline=(*COLOR_SLATE_BORDER, a_int), width=1)
        draw.rectangle([(card_x0, card_y0), (card_x0 + 4, card_y1)], fill=(*COLOR_GOLD, a_int))

        text_x = card_x0 + 12
        draw.text((text_x, card_y0 + 8), title.upper()[:28], font=branding.font_mono_bold, fill=(*COLOR_WHITE, a_int))
        draw.text((text_x, card_y0 + 30), detail[:36], font=branding.font_body_small, fill=(*COLOR_SLATE_MUTED, a_int))

    @staticmethod
    def draw_circular_gauge(
        canvas: Image.Image,
        cx: int,
        cy: int,
        radius: int,
        current_val: float,
        target_val: float,
        unit: str,
        label: str
    ):
        """Renders live circular arc gauge with numeric readout."""
        draw = ImageDraw.Draw(canvas, 'RGBA')
        # Background track
        bbox = [(cx - radius, cy - radius), (cx + radius, cy + radius)]
        draw.arc(bbox, start=135, end=405, fill=(*COLOR_SLATE_BORDER, 255), width=10)

        # Active progress arc
        pct = min(1.0, max(0.0, current_val / max(1.0, target_val)))
        end_angle = 135 + int(pct * 270)
        draw.arc(bbox, start=135, end=end_angle, fill=(*COLOR_GOLD, 255), width=10)

        # Value readout
        val_str = f"{int(current_val)}"
        draw.text((cx - 35, cy - 25), val_str, font=branding.font_title_med, fill=COLOR_WHITE)
        draw.text((cx - 20, cy + 15), unit, font=branding.font_mono, fill=COLOR_SLATE_MUTED)
        draw.text((cx - 60, cy + radius + 15), label, font=branding.font_mono_bold, fill=COLOR_GOLD)

    @staticmethod
    def draw_waveform(canvas: Image.Image, x0: int, y0: int, width: int, height: int, progress: float):
        """Renders dynamic oscillograph / stability telemetry waveform."""
        draw = ImageDraw.Draw(canvas, 'RGBA')
        draw.rectangle([(x0, y0), (x0 + width, y0 + height)], fill=(248, 250, 252, 255), outline=(*COLOR_SLATE_BORDER, 255), width=1)

        # Baseline
        mid_y = y0 + height // 2
        draw.line([(x0, mid_y), (x0 + width, mid_y)], fill=(*COLOR_SLATE_BORDER, 150), width=1)

        # Draw waveform points
        points = []
        for i in range(0, width, 4):
            x = x0 + i
            phase = (i / 40.0) - (progress * 12.0)
            y = mid_y + int(math.sin(phase) * 28.0 + math.sin(phase * 2.3) * 12.0)
            points.append((x, y))

        if len(points) > 1:
            draw.line(points, fill=(*COLOR_GOLD, 255), width=2)

        draw.text((x0 + 10, y0 + 8), "CLOSED-LOOP LOAD CELL TELEMETRY (STABLE)", font=branding.font_mono, fill=(*COLOR_SLATE_MUTED, 255))

studio_bg = StudioBackgroundRenderer()
