#!/usr/bin/env python3

import argparse
import json
import math
from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image, ImageFilter


NAMED_KEYS = {
    "black": (0, 0, 0),
    "white": (255, 255, 255),
    "green": (0, 255, 0),
    "magenta": (255, 0, 255),
}

MODES = (
    "solid-key",
    "light-on-black",
    "dark-on-white",
    "chroma-matte",
)


def parse_key(value, image):
    lowered = value.lower()
    if lowered in NAMED_KEYS:
        return NAMED_KEYS[lowered]
    if lowered.startswith("#") and len(lowered) == 7:
        return tuple(int(lowered[index:index + 2], 16) for index in (1, 3, 5))
    if lowered != "auto":
        raise ValueError("--key must be auto, black, white, green, magenta, or #RRGGBB")

    width, height = image.size
    step = max(1, min(width, height) // 100)
    border = []
    for x in range(0, width, step):
        border.append(image.getpixel((x, 0))[:3])
        border.append(image.getpixel((x, height - 1))[:3])
    for y in range(0, height, step):
        border.append(image.getpixel((0, y))[:3])
        border.append(image.getpixel((width - 1, y))[:3])
    return tuple(int(median(pixel[channel] for pixel in border)) for channel in range(3))


def distance(rgb, key):
    return math.sqrt(sum((rgb[index] - key[index]) ** 2 for index in range(3)))


def connected_background(image, key, opaque_threshold):
    width, height = image.size
    pixels = image.load()
    queue = deque()
    visited = set()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        if distance(pixels[x, y][:3], key) > opaque_threshold:
            continue
        visited.add((x, y))
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))
    return visited


def unmatte(channel, key_channel, alpha):
    if alpha <= 0.01:
        return 0
    value = (channel - key_channel * (1.0 - alpha)) / alpha
    return max(0, min(255, round(value)))


def matte_alpha(rgb, key, mode, transparent_threshold, opaque_threshold):
    if mode == "solid-key":
        delta = distance(rgb, key)
        if delta <= transparent_threshold:
            return 0.0
        if delta >= opaque_threshold:
            return 1.0
        return (delta - transparent_threshold) / (opaque_threshold - transparent_threshold)

    if mode == "light-on-black":
        foreground_signal = max(rgb)
    elif mode == "dark-on-white":
        foreground_signal = 255 - min(rgb)
    elif key == NAMED_KEYS["green"]:
        foreground_signal = max(rgb[0], rgb[2], 255 - rgb[1])
    else:
        foreground_signal = max(rgb[1], 255 - rgb[0], 255 - rgb[2])

    if foreground_signal <= transparent_threshold:
        return 0.0
    return foreground_signal / 255.0


def validate_mode(mode, key, connected_only):
    if mode == "light-on-black" and key != NAMED_KEYS["black"]:
        raise ValueError("--mode light-on-black requires a pure black key")
    if mode == "dark-on-white" and key != NAMED_KEYS["white"]:
        raise ValueError("--mode dark-on-white requires a pure white key")
    if mode == "chroma-matte" and key not in (NAMED_KEYS["green"], NAMED_KEYS["magenta"]):
        raise ValueError("--mode chroma-matte requires a pure green or pure magenta key")
    if connected_only and mode != "solid-key":
        raise ValueError("--connected-only is supported only with --mode solid-key")


def remove_background(
    image,
    key,
    mode,
    transparent_threshold,
    opaque_threshold,
    despill,
    edge_contract,
    connected_only,
):
    source = image.convert("RGBA")
    width, height = source.size
    source_pixels = source.load()
    connected = connected_background(source, key, opaque_threshold) if connected_only else None
    result = Image.new("RGBA", source.size)
    output = result.load()

    for y in range(height):
        for x in range(width):
            red, green, blue, source_alpha = source_pixels[x, y]
            if connected is not None and (x, y) not in connected:
                output[x, y] = (red, green, blue, source_alpha)
                continue
            matte_fraction = matte_alpha(
                (red, green, blue),
                key,
                mode,
                transparent_threshold,
                opaque_threshold,
            )
            alpha = round(source_alpha * matte_fraction)
            if despill and 0 < alpha < 255:
                red = unmatte(red, key[0], matte_fraction)
                green = unmatte(green, key[1], matte_fraction)
                blue = unmatte(blue, key[2], matte_fraction)
            output[x, y] = (red, green, blue, alpha)

    if edge_contract > 0:
        alpha = result.getchannel("A")
        for _ in range(edge_contract):
            alpha = alpha.filter(ImageFilter.MinFilter(3))
        result.putalpha(alpha)
    return result


def main():
    parser = argparse.ArgumentParser(description="Remove a keyed background or matte and write a transparent PNG.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--key", default="auto")
    parser.add_argument("--mode", choices=MODES, default="solid-key")
    parser.add_argument("--transparent-threshold", type=float, default=12.0)
    parser.add_argument("--opaque-threshold", type=float, default=90.0)
    parser.add_argument("--edge-contract", type=int, default=0)
    parser.add_argument("--connected-only", action="store_true", help="Remove only key-colored regions connected to the image border")
    parser.add_argument("--no-despill", action="store_true")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.out).expanduser().resolve()
    if input_path == output_path:
        raise SystemExit("Refusing to overwrite the input image")
    if args.transparent_threshold < 0 or args.opaque_threshold <= args.transparent_threshold:
        raise SystemExit("Thresholds must satisfy 0 <= transparent < opaque")
    if args.edge_contract < 0 or args.edge_contract > 4:
        raise SystemExit("--edge-contract must be from 0 to 4")

    image = Image.open(input_path).convert("RGBA")
    key = parse_key(args.key, image)
    try:
        validate_mode(args.mode, key, args.connected_only)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    result = remove_background(
        image,
        key,
        args.mode,
        args.transparent_threshold,
        args.opaque_threshold,
        not args.no_despill,
        args.edge_contract,
        args.connected_only,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, format="PNG", optimize=True)
    alpha = result.getchannel("A")
    report = {
        "input": str(input_path),
        "output": str(output_path),
        "key": "#%02x%02x%02x" % key,
        "mode": args.mode,
        "size": list(result.size),
        "alphaExtrema": list(alpha.getextrema()),
        "subjectBounds": list(alpha.getbbox()) if alpha.getbbox() else None,
    }
    print(json.dumps(report))


if __name__ == "__main__":
    main()
