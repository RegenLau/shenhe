#!/usr/bin/env python3

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


def composite(image, color):
    background = Image.new("RGBA", image.size, (*color, 255))
    return Image.alpha_composite(background, image).convert("RGB")


def checkerboard(size, tile=16):
    image = Image.new("RGBA", size, (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, min(x + tile - 1, size[0] - 1), min(y + tile - 1, size[1] - 1)), fill=(210, 210, 210, 255))
    return image


def validate(image, min_padding, corner_threshold, source_key="unknown"):
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    width, height = rgba.size
    minimum, maximum = alpha.getextrema()
    bounds = alpha.point(lambda value: 255 if value > corner_threshold else 0).getbbox()
    errors = []
    warnings = []

    if minimum == 255:
        errors.append("Image has no transparent pixels")
    if maximum == 0 or bounds is None:
        errors.append("Image has no visible subject")

    corners = {
        "topLeft": alpha.getpixel((0, 0)),
        "topRight": alpha.getpixel((width - 1, 0)),
        "bottomLeft": alpha.getpixel((0, height - 1)),
        "bottomRight": alpha.getpixel((width - 1, height - 1)),
    }
    for name, value in corners.items():
        if value > corner_threshold:
            errors.append(f"{name} corner is not transparent enough: alpha={value}")

    if bounds:
        left, top, right, bottom = bounds
        padding = {
            "left": left,
            "top": top,
            "right": width - right,
            "bottom": height - bottom,
        }
        for name, value in padding.items():
            if value < min_padding:
                errors.append(f"Subject padding on {name} is {value}px; expected at least {min_padding}px")
    else:
        padding = None

    pixels = rgba.load()
    spill = 0
    partial = 0
    for y in range(height):
        for x in range(width):
            red, green, blue, value = pixels[x, y]
            if 0 < value < 255:
                partial += 1
                green_spill = (
                    source_key in ("unknown", "green")
                    and green > 96
                    and green > red * 1.45
                    and green > blue * 1.45
                )
                magenta_spill = (
                    source_key in ("unknown", "magenta")
                    and red > 96
                    and blue > 96
                    and green * 1.7 < min(red, blue)
                )
                if green_spill or magenta_spill:
                    spill += 1
    if partial and spill / partial > 0.03:
        errors.append(f"Likely chroma-key spill on {spill}/{partial} partial-alpha pixels")
    elif partial == 0:
        warnings.append("No soft alpha edge pixels found; inspect for a hard or jagged cutout")

    return {
        "valid": not errors,
        "size": [width, height],
        "alphaExtrema": [minimum, maximum],
        "subjectBounds": list(bounds) if bounds else None,
        "padding": padding,
        "corners": corners,
        "partialAlphaPixels": partial,
        "suspectedSpillPixels": spill,
        "sourceKey": source_key,
        "errors": errors,
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser(description="Validate an alpha image and create inspection composites.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--preview-dir", required=True)
    parser.add_argument("--min-padding", type=int, default=1)
    parser.add_argument("--corner-threshold", type=int, default=8)
    parser.add_argument(
        "--source-key",
        choices=("unknown", "black", "white", "green", "magenta"),
        default="unknown",
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    preview_dir = Path(args.preview_dir).expanduser().resolve()
    image = Image.open(input_path).convert("RGBA")
    report = validate(image, args.min_padding, args.corner_threshold, args.source_key)
    report["input"] = str(input_path)
    preview_dir.mkdir(parents=True, exist_ok=True)

    composite(image, (255, 255, 255)).save(preview_dir / "on-white.png")
    composite(image, (0, 0, 0)).save(preview_dir / "on-black.png")
    Image.alpha_composite(checkerboard(image.size), image).convert("RGB").save(preview_dir / "on-checkerboard.png")
    (preview_dir / "alpha-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for error in report["errors"]:
            print(f"ERROR: {error}")
        for warning in report["warnings"]:
            print(f"WARN: {warning}")
        print("Alpha validation passed" if report["valid"] else "Alpha validation failed")
    raise SystemExit(0 if report["valid"] else 1)


if __name__ == "__main__":
    main()
