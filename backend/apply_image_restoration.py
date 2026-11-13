import os
import io
import numpy as np
from PIL import Image, ImageDraw
import pypdf

base_dir = r"C:\PORTAL_PROJECT_2\01_APPLICATION\backend"
img_dir = os.path.join(base_dir, "static", "images", "products")
cat_dir = os.path.join(base_dir, "static", "catalogues")

def create_master_clean_projector():
    # Load original product_23_pro.jpg
    src_path = os.path.join(img_dir, "product_23_pro.jpg")
    im = Image.open(src_path).convert("RGB")
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape
    
    cx, cy = 464, 260
    r_glass = 149
    col_x_min, col_x_max = 550, 723
    col_y_min, col_y_max = 85, 430

    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
    glass_mask = dist <= r_glass

    # 1. Ground Glass Screen Synthesis
    r_norm = np.clip(dist / r_glass, 0.0, 1.0)
    center_rgb = np.array([214.0, 220.0, 216.0])
    edge_rgb = np.array([184.0, 190.0, 186.0])
    
    glass_surface = np.zeros((h, w, 3), dtype=np.float32)
    for c in range(3):
        glass_surface[:, :, c] = center_rgb[c] - (center_rgb[c] - edge_rgb[c]) * (r_norm ** 1.4)
    
    # Ground glass micro-texture
    np.random.seed(42)
    noise = np.random.normal(0, 1.5, (h, w, 3))
    glass_surface = np.clip(glass_surface + noise, 0, 255)
    
    # Replace entire glass interior
    for c in range(3):
        arr[:, :, c] = np.where(glass_mask, glass_surface[:, :, c], arr[:, :, c])

    # 2. Inpaint Column Cutouts
    col_mask = (Y >= col_y_min) & (Y <= col_y_max) & (X >= col_x_min) & (X <= col_x_max)
    white_in_col = col_mask & np.all(arr >= 240, axis=-1)
    
    # Inpaint iterative diffusion (35 iterations for smooth metal gradient)
    inpainted = arr.copy()
    for _ in range(35):
        for c in range(3):
            chan = inpainted[:, :, c]
            neighbor_avg = (
                np.roll(chan, 1, axis=0) +
                np.roll(chan, -1, axis=0) +
                np.roll(chan, 1, axis=1) +
                np.roll(chan, -1, axis=1)
            ) / 4.0
            chan[white_in_col] = neighbor_avg[white_in_col]
            inpainted[:, :, c] = chan
            
    # Clean background to the right of column
    for y in range(col_y_min, col_y_max):
        inpainted[y, col_x_max + 1:] = [255.0, 255.0, 255.0]

    # Convert to PIL for sharp reticle rendering
    res_img = Image.fromarray(np.clip(inpainted, 0, 255).astype(np.uint8))
    draw = ImageDraw.Draw(res_img)

    # Reticle outer border ring
    draw.ellipse([cx - r_glass, cy - r_glass, cx + r_glass, cy + r_glass], outline=(50, 55, 55), width=1)
    
    # Reticle Crosshairs: fine dark charcoal lines (width 1)
    reticle_color = (28, 30, 30)
    draw.line([(cx - r_glass + 3, cy), (cx + r_glass - 3, cy)], fill=reticle_color, width=1)
    draw.line([(cx, cy - r_glass + 3), (cx, cy + r_glass - 3)], fill=reticle_color, width=1)
    
    # Center alignment ticks (±6 px)
    draw.line([(cx - 1, cy - 6), (cx - 1, cy + 6)], fill=(45, 50, 50), width=1)
    draw.line([(cx + 1, cy - 6), (cx + 1, cy + 6)], fill=(45, 50, 50), width=1)
    draw.line([(cx - 6, cy - 1), (cx + 6, cy - 1)], fill=(45, 50, 50), width=1)
    draw.line([(cx - 6, cy + 1), (cx + 6, cy + 1)], fill=(45, 50, 50), width=1)

    return res_img

def make_square_image(img, target_size=(1000, 1000)):
    # Create white canvas
    canvas = Image.new("RGB", target_size, (255, 255, 255))
    w, h = img.size
    # Fit into target_size with padding
    pad = 40
    max_w = target_size[0] - 2 * pad
    max_h = target_size[1] - 2 * pad
    ratio = min(max_w / w, max_h / h)
    new_w = int(w * ratio)
    new_h = int(h * ratio)
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    offset_x = (target_size[0] - new_w) // 2
    offset_y = (target_size[1] - new_h) // 2
    canvas.paste(resized, (offset_x, offset_y))
    return canvas

def update_catalogue_pdf(pdf_path, new_img):
    if not os.path.exists(pdf_path):
        print(f"Catalogue not found: {pdf_path}")
        return
    reader = pypdf.PdfReader(pdf_path)
    writer = pypdf.PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    
    # Replace the machine image on page 0
    page0 = writer.pages[0]
    replaced = False
    for img in page0.images:
        # X8.jpg or large image
        if "8" in img.name or len(img.data) > 20000:
            print(f"  Replacing {img.name} in {os.path.basename(pdf_path)}")
            img.replace(new_img)
            replaced = True
            break
            
    if replaced:
        tmp_path = pdf_path + ".tmp"
        with open(tmp_path, "wb") as f:
            writer.write(f)
        os.replace(tmp_path, pdf_path)
        print(f"  [SUCCESS] Updated {os.path.basename(pdf_path)}")
    else:
        print(f"  [WARN] No matching image found in {os.path.basename(pdf_path)}")

print("=== Starting HSMLE Image & Catalogue Restoration ===")
clean_pro = create_master_clean_projector()

# 1. Save product_23_pro.jpg
p23_pro_path = os.path.join(img_dir, "product_23_pro.jpg")
clean_pro.save(p23_pro_path, quality=95)
print(f"[OK] Saved {p23_pro_path} (size={clean_pro.size})")

# 2. Save product_23.jpg and product_24.jpg (1000x1000 square)
clean_sq = make_square_image(clean_pro, (1000, 1000))
p23_path = os.path.join(img_dir, "product_23.jpg")
p24_path = os.path.join(img_dir, "product_24.jpg")
clean_sq.save(p23_path, quality=95)
clean_sq.save(p24_path, quality=95)
print(f"[OK] Saved {p23_path} (size={clean_sq.size})")
print(f"[OK] Saved {p24_path} (size={clean_sq.size})")

# 3. Update Catalogues
cat_vpp200 = os.path.join(cat_dir, "BENCHTOP-VERTICAL-PROFILE-PROJECTOR-VPP-200.pdf")
cat_vpp300 = os.path.join(cat_dir, "BENCHTOP-VERTICAL-PROFILE-PROJECTOR-VPP-300.pdf")

update_catalogue_pdf(cat_vpp200, clean_pro)
# For VPP-300 catalogue, check if 800x800 or clean_sq fits
update_catalogue_pdf(cat_vpp300, clean_sq)

print("=== All Restorations Complete ===")
