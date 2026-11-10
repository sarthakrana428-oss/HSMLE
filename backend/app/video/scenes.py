"""
HSMLE Advanced Broadcast Scene Director
Renders a fast-paced, high-information-density 30-second industrial product video
in the modern Platinum & Charcoal theme with persistent HSMLE golden watermark.
"""

import math
from PIL import Image, ImageDraw, ImageFilter
from typing import Dict, Any, List, Tuple
from .branding import (
    COLOR_NAVY_DEEP, COLOR_NAVY_SURFACE, COLOR_BLUE, COLOR_BLUE_LIGHT,
    COLOR_GOLD, COLOR_GOLD_LIGHT, COLOR_EMERALD, COLOR_WHITE, COLOR_SLATE_LIGHT,
    COLOR_SLATE_MUTED, COLOR_SLATE_BORDER, COLOR_HEADER_BG, branding
)
from .animations import (
    studio_bg, MachineCompositor, MotionGraphicsRenderer,
    ease_in_out, ease_out_cubic, ease_in_cubic, lerp
)

TOTAL_FRAMES = 750 # Exactly 30.0 seconds at 25 FPS (smooth broadcast standard)

class SceneDirector:
    def __init__(self, product_data: Dict[str, Any], machine_im: Image.Image):
        self.prod = product_data
        self.machine_im = machine_im
        self.width = 1920
        self.height = 1080

        target_h = int(self.height * 0.70)
        self.base_scale = target_h / max(1, self.machine_im.height)
        self.base_cx = self.width * 0.54
        self.base_cy = int(self.height * 0.52)

    def render_frame(self, f: int) -> Image.Image:
        # 750 frames divided into 6 distinct scenes:
        # Scene 1: 0 - 124 (0 - 5.0s)
        # Scene 2: 125 - 274 (5.0 - 11.0s)
        # Scene 3: 275 - 424 (11.0 - 17.0s)
        # Scene 4: 425 - 574 (17.0 - 23.0s)
        # Scene 5: 575 - 674 (23.0 - 27.0s)
        # Scene 6: 675 - 749 (27.0 - 30.0s)
        if f < 125:
            return self._render_scene_1(f)
        elif f < 275:
            return self._render_scene_2(f - 125)
        elif f < 425:
            return self._render_scene_3(f - 275)
        elif f < 575:
            return self._render_scene_4(f - 425)
        elif f < 675:
            return self._render_scene_5(f - 575)
        else:
            return self._render_scene_6(f - 675)

    # -------------------------------------------------------------
    # SCENE 1: RAPID HERO & HEADLINE SPECIFICATIONS (0 - 5.0s, 125f)
    # -------------------------------------------------------------
    def _render_scene_1(self, f: int) -> Image.Image:
        progress = f / 125.0
        canvas = studio_bg.get_background()

        zoom = lerp(0.96, 1.04, ease_out_cubic(progress))
        cx = lerp(self.width * 0.60, self.width * 0.56, ease_in_out(progress))
        mbox = MachineCompositor.composite_machine(
            canvas, self.machine_im,
            center_x=cx, center_y=self.base_cy,
            scale=self.base_scale * zoom
        )

        MotionGraphicsRenderer.draw_top_telemetry_bar(
            canvas,
            self.prod.get('model_number', 'PRO'),
            self.prod.get('category_name', 'Industrial Testing'),
            f
        )

        draw = ImageDraw.Draw(canvas, 'RGBA')
        fade = min(1.0, f / 20.0)
        a_int = int(255 * fade)

        lx = 90
        # Category Tag
        draw.rectangle([(lx, 100), (lx + 340, 136)], fill=(*COLOR_HEADER_BG, a_int), outline=(*COLOR_GOLD, a_int), width=1)
        draw.text((lx + 16, 108), f"INDUSTRIAL {self.prod.get('category_name', 'EQUIPMENT').upper()[:24]}", font=branding.font_mono_bold, fill=(*COLOR_GOLD_LIGHT, a_int))

        # Big Machine Title
        name = self.prod.get('product_name', 'Industrial Machine').upper()
        if len(name) > 30:
            words = name.split(' ')
            p1 = ' '.join(words[:3])
            p2 = ' '.join(words[3:7])
            draw.text((lx, 150), p1, font=branding.font_title_med, fill=(*COLOR_WHITE, a_int))
            draw.text((lx, 195), p2, font=branding.font_title_med, fill=(*COLOR_WHITE, a_int))
            headline_y = 250
        else:
            draw.text((lx, 150), name, font=branding.font_title_large, fill=(*COLOR_WHITE, a_int))
            headline_y = 220

        # Model Number Badge
        draw.text((lx, headline_y), f"MODEL: {self.prod.get('model_number', 'STANDARD')}", font=branding.font_title_small, fill=(*COLOR_GOLD, a_int))

        # Headline Badges Strip (3-4 high-impact specs)
        badges = self.prod.get('headline_badges', [])
        by = headline_y + 45
        for i, b in enumerate(badges[:4]):
            bx0, bx1 = lx, lx + 460
            b_alpha = min(1.0, max(0.0, (f - 10 - i * 10) / 16.0))
            if b_alpha > 0:
                ba = int(255 * b_alpha)
                draw.rectangle([(bx0, by), (bx1, by + 46)], fill=(255, 255, 255, ba), outline=(*COLOR_SLATE_BORDER, ba), width=1)
                draw.rectangle([(bx0, by), (bx0 + 5, by + 46)], fill=(*COLOR_GOLD, ba))
                draw.text((bx0 + 18, by + 12), f"•  {b}", font=branding.font_mono_bold, fill=(*COLOR_WHITE, ba))
            by += 54

        return canvas

    # -------------------------------------------------------------
    # SCENE 2: 3D METROLOGY SCAN & COMPONENT CALLOUTS (5.0 - 11.0s, 150f)
    # -------------------------------------------------------------
    def _render_scene_2(self, f: int) -> Image.Image:
        progress = f / 150.0
        canvas = studio_bg.get_background()

        cx = self.width * 0.52 + math.sin(progress * math.pi) * 20
        cy = self.base_cy
        scale = self.base_scale * 1.02

        mbox = MachineCompositor.composite_machine(
            canvas, self.machine_im,
            center_x=cx, center_y=cy,
            scale=scale
        )

        MotionGraphicsRenderer.draw_top_telemetry_bar(
            canvas,
            self.prod.get('model_number', 'PRO'),
            "COMPONENT ANATOMY & METROLOGY SCAN",
            f + 125
        )

        # Laser Scanline
        laser_prog = (progress * 2.0) % 1.0
        MotionGraphicsRenderer.draw_laser_scanline(canvas, mbox, laser_prog)

        # Callout Pointers
        callouts = self.prod.get('component_callouts', [])
        for i, c in enumerate(callouts):
            tx = int(cx + c['target_rel_x'] * mbox[2])
            ty = int(cy + c['target_rel_y'] * mbox[3])
            start_f = i * 22
            c_alpha = min(1.0, max(0.0, (f - start_f) / 16.0))

            MotionGraphicsRenderer.draw_component_callout(
                canvas,
                target_x=tx,
                target_y=ty,
                title=c['title'],
                detail=c['detail'],
                side=c['side'],
                alpha=c_alpha,
                frame=f
            )

        return canvas

    # -------------------------------------------------------------
    # SCENE 3: OPERATIONAL TELEMETRY & LIVE HUD (11.0 - 17.0s, 150f)
    # -------------------------------------------------------------
    def _render_scene_3(self, f: int) -> Image.Image:
        progress = f / 150.0
        canvas = studio_bg.get_background()

        cx = lerp(self.width * 0.52, self.width * 0.68, ease_out_cubic(min(1.0, progress * 2.5)))
        mbox = MachineCompositor.composite_machine(
            canvas, self.machine_im,
            center_x=cx, center_y=self.base_cy,
            scale=self.base_scale * 0.96
        )

        MotionGraphicsRenderer.draw_top_telemetry_bar(
            canvas,
            self.prod.get('model_number', 'PRO'),
            "OPERATIONAL TELEMETRY & METROLOGY HUD",
            f + 275
        )

        draw = ImageDraw.Draw(canvas, 'RGBA')
        fade = min(1.0, f / 18.0)
        fa = int(255 * fade)

        telem = self.prod.get('telemetry', {})
        dx0, dy0 = 80, 80
        # Elevated White Dashboard Container
        draw.rectangle([(dx0, dy0), (dx0 + 600, dy0 + 860)], fill=(255, 255, 255, int(250 * fade)), outline=(*COLOR_SLATE_BORDER, fa), width=1)
        draw.rectangle([(dx0, dy0), (dx0 + 600, dy0 + 6)], fill=(*COLOR_GOLD, fa))

        draw.text((dx0 + 24, dy0 + 24), "LIVE TELEMETRY MONITOR", font=branding.font_title_small, fill=(*COLOR_WHITE, fa))
        draw.text((dx0 + 24, dy0 + 56), telem.get('hud_status', 'SYSTEM ACTIVE')[:42], font=branding.font_mono_bold, fill=(*COLOR_EMERALD, fa))
        draw.line([(dx0 + 24, dy0 + 85), (dx0 + 576, dy0 + 85)], fill=(*COLOR_SLATE_BORDER, fa), width=1)

        # Circular Gauge
        target_val = float(telem.get('gauge_target', 100))
        cur_val = target_val * min(1.0, ease_out_cubic(progress * 1.8))
        gauge_cx = dx0 + 300
        gauge_cy = dy0 + 225
        MotionGraphicsRenderer.draw_circular_gauge(
            canvas,
            cx=gauge_cx, cy=gauge_cy, radius=85,
            current_val=cur_val, target_val=target_val,
            unit=telem.get('gauge_unit', ''),
            label=telem.get('gauge_label', 'PERFORMANCE')
        )

        # Live Waveform Graph
        MotionGraphicsRenderer.draw_waveform(
            canvas,
            x0=dx0 + 24, y0=dy0 + 360,
            width=552, height=130,
            progress=progress
        )

        # 4 Metric Cards
        metrics = [
            telem.get('metric_1', ('METRIC 1', 'Standard')),
            telem.get('metric_2', ('METRIC 2', 'Active')),
            telem.get('metric_3', ('METRIC 3', 'Verified')),
            telem.get('metric_4', ('METRIC 4', 'Pass'))
        ]
        my0 = dy0 + 525
        for i, (m_label, m_val) in enumerate(metrics):
            rx = dx0 + 24 + (i % 2) * 284
            ry = my0 + (i // 2) * 110
            draw.rectangle([(rx, ry), (rx + 268, ry + 92)], fill=(248, 250, 252, fa), outline=(*COLOR_SLATE_BORDER, fa), width=1)
            draw.rectangle([(rx, ry), (rx + 4, ry + 92)], fill=(*COLOR_GOLD, fa))
            draw.text((rx + 16, ry + 14), m_label.upper(), font=branding.font_mono, fill=(*COLOR_SLATE_MUTED, fa))
            draw.text((rx + 16, ry + 42), m_val, font=branding.font_body_bold, fill=(*COLOR_WHITE, fa))

        return canvas

    # -------------------------------------------------------------
    # SCENE 4: COMPREHENSIVE 6-POINT SPECIFICATION MATRIX (17.0 - 23.0s, 150f)
    # -------------------------------------------------------------
    def _render_scene_4(self, f: int) -> Image.Image:
        progress = f / 150.0
        canvas = studio_bg.get_background()

        mx = self.width * 0.82
        my = self.height * 0.52
        MachineCompositor.composite_machine(
            canvas, self.machine_im,
            center_x=mx, center_y=my,
            scale=self.base_scale * 0.90,
            opacity=0.30
        )

        MotionGraphicsRenderer.draw_top_telemetry_bar(
            canvas,
            self.prod.get('model_number', 'PRO'),
            "VERIFIED ENGINEERING PARAMETERS",
            f + 425
        )

        draw = ImageDraw.Draw(canvas, 'RGBA')
        draw.text((80, 80), "ENGINEERING SPECIFICATION MATRIX", font=branding.font_title_med, fill=COLOR_WHITE)
        draw.text((80, 125), f"Authentic factory specifications for Model {self.prod.get('model_number', '')} • 100% Guaranteed Parameters", font=branding.font_body, fill=COLOR_SLATE_MUTED)

        matrix = self.prod.get('spec_matrix', [])
        grid_x0 = 80
        grid_y0 = 175
        col_w = 540
        row_h = 220
        gap_x = 35
        gap_y = 25

        for i, card in enumerate(matrix[:6]):
            col = i % 2
            row = i // 2
            cx0 = grid_x0 + col * (col_w + gap_x)
            cy0 = grid_y0 + row * (row_h + gap_y)

            card_f = min(1.0, max(0.0, (f - i * 7) / 14.0))
            if card_f <= 0:
                continue

            ca = int(255 * card_f)
            slide_x = int((1.0 - ease_out_cubic(card_f)) * 30)

            # Elevated White Card
            draw.rectangle([(cx0 + slide_x, cy0), (cx0 + col_w + slide_x, cy0 + row_h)],
                           fill=(255, 255, 255, int(ca * 0.96)), outline=(*COLOR_SLATE_BORDER, ca), width=1)
            draw.rectangle([(cx0 + slide_x, cy0), (cx0 + col_w + slide_x, cy0 + 4)], fill=(*COLOR_GOLD, ca))

            draw.text((cx0 + 20 + slide_x, cy0 + 16), card['category'], font=branding.font_mono_bold, fill=(*COLOR_GOLD, ca))
            draw.text((cx0 + 20 + slide_x, cy0 + 48), card['title'], font=branding.font_title_small, fill=(*COLOR_WHITE, ca))

            val = card['value']
            if len(val) > 42:
                v1, v2 = val[:42], val[42:]
                draw.text((cx0 + 20 + slide_x, cy0 + 95), v1, font=branding.font_body_bold, fill=(*COLOR_SLATE_LIGHT, ca))
                draw.text((cx0 + 20 + slide_x, cy0 + 125), v2, font=branding.font_body_bold, fill=(*COLOR_SLATE_LIGHT, ca))
            else:
                draw.text((cx0 + 20 + slide_x, cy0 + 105), val, font=branding.font_body_bold, fill=(*COLOR_SLATE_LIGHT, ca))

            draw.text((cx0 + col_w - 110 + slide_x, cy0 + 16), "✔ VERIFIED", font=branding.font_mono_bold, fill=(*COLOR_EMERALD, ca))

        return canvas

    # -------------------------------------------------------------
    # SCENE 5: INDUSTRIAL SECTORS & QUALITY ASSURANCE (23.0 - 27.0s, 100f)
    # -------------------------------------------------------------
    def _render_scene_5(self, f: int) -> Image.Image:
        progress = f / 100.0
        canvas = studio_bg.get_background()

        cx = self.width * 0.32
        MachineCompositor.composite_machine(
            canvas, self.machine_im,
            center_x=cx, center_y=self.base_cy,
            scale=self.base_scale * 1.0
        )

        MotionGraphicsRenderer.draw_top_telemetry_bar(
            canvas,
            self.prod.get('model_number', 'PRO'),
            "INDUSTRY APPLICATIONS & QUALITY AUDIT ASSURANCE",
            f + 575
        )

        draw = ImageDraw.Draw(canvas, 'RGBA')
        fade = min(1.0, f / 18.0)
        fa = int(255 * fade)

        rx0 = self.width * 0.55
        draw.text((rx0, 95), "APPROVED FOR TIER-1 INDUSTRY SECTORS", font=branding.font_title_med, fill=(*COLOR_WHITE, fa))
        draw.text((rx0, 140), "Supplied to leading manufacturing plants & NABL certified laboratories across India", font=branding.font_body, fill=(*COLOR_SLATE_MUTED, fa))

        sectors = [
            ("AUTOMOTIVE & OEM VENDORS", "Gearboxes, Engine Components, Axles & Fasteners"),
            ("AEROSPACE & DEFENSE ESTABLISHMENTS", "Critical Alloy Metallurgy, Armor & Ordinance"),
            ("HEAVY ENGINEERING & RAILWAYS", "Rails, Wheels, Rolling Stock & Structural Steels"),
            ("R&D LABS & UNIVERSITIES", "Material Science, Heat Treatment & Metallography")
        ]

        sy0 = 195
        for i, (sec_title, sec_desc) in enumerate(sectors):
            draw.rectangle([(rx0, sy0), (rx0 + 720, sy0 + 82)], fill=(255, 255, 255, fa), outline=(*COLOR_SLATE_BORDER, fa), width=1)
            draw.rectangle([(rx0, sy0), (rx0 + 5, sy0 + 82)], fill=(*COLOR_GOLD, fa))
            draw.text((rx0 + 20, sy0 + 14), sec_title, font=branding.font_mono_bold, fill=(*COLOR_WHITE, fa))
            draw.text((rx0 + 20, sy0 + 44), sec_desc, font=branding.font_body_small, fill=(*COLOR_SLATE_MUTED, fa))
            sy0 += 98

        # Stamp box
        draw.rectangle([(rx0, sy0 + 10), (rx0 + 720, sy0 + 115)], fill=(236, 253, 245, fa), outline=(*COLOR_EMERALD, fa), width=2)
        draw.text((rx0 + 24, sy0 + 24), "100% PRE-DISPATCH RUN TESTED & CALIBRATED", font=branding.font_title_small, fill=(*COLOR_WHITE, fa))
        draw.text((rx0 + 24, sy0 + 64), "DIRECT 12-MONTH OEM FACTORY WARRANTY • NABL TRACEABLE MASTERS", font=branding.font_mono_bold, fill=(*COLOR_EMERALD, fa))

        return canvas

    # -------------------------------------------------------------
    # SCENE 6: HSMLE BRAND OUTRO & TURNKEY CTA (27.0 - 30.0s, 75f)
    # -------------------------------------------------------------
    def _render_scene_6(self, f: int) -> Image.Image:
        canvas = studio_bg.get_background()
        draw = ImageDraw.Draw(canvas, 'RGBA')

        alpha = min(1.0, f / 12.0)
        if f > 60:
            alpha = max(0.0, (75 - f) / 15.0)
        a_int = int(255 * alpha)

        logo_w = 240
        logo_h = int(branding.watermark_master.height * (logo_w / float(branding.watermark_master.width)))
        logo_scaled = branding.watermark_master.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
        lx = (self.width - logo_w) // 2
        ly = 200
        canvas.paste(logo_scaled, (lx, ly), logo_scaled)

        draw.text((self.width // 2 - 360, 360), "HSMLE INDIA CORPORATION", font=branding.font_outro, fill=(*COLOR_WHITE, a_int))
        draw.text((self.width // 2 - 270, 450), "Precision • Reliability • Engineering Excellence", font=branding.font_title_small, fill=(*COLOR_GOLD, a_int))
        draw.text((self.width // 2 - 440, 520), "Morta Works, Near Morta Bijlighar, Pillar No. 663, Meerut Road, Ghaziabad - 201003, Uttar Pradesh", font=branding.font_mono_bold, fill=(*COLOR_SLATE_LIGHT, a_int))

        # CTA Button
        draw.rectangle([(self.width // 2 - 320, 600), (self.width // 2 + 320, 670)], fill=(*COLOR_HEADER_BG, a_int))
        draw.rectangle([(self.width // 2 - 320, 600), (self.width // 2 + 320, 604)], fill=(*COLOR_GOLD, a_int))
        draw.text((self.width // 2 - 240, 622), "REQUEST OFFICIAL QUOTATION & SPEC SHEET", font=branding.font_mono_bold, fill=(255, 255, 255, a_int))

        draw.text((self.width // 2 - 170, 710), "www.hsmleindia.com • info@hsmleindia.com", font=branding.font_mono, fill=(*COLOR_SLATE_MUTED, a_int))

        return canvas
