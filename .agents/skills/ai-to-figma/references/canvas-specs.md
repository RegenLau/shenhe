# Canvas specifications

## Web

- Width: `1440px`.
- Minimum height: `900px`.
- Height: grow naturally with content; never scale down or clip content to preserve 900 px.
- Capture root: explicit opaque background and `data-figma-capture-root`.

An explicit user size may override these defaults. Record the override in `design.md`.

## iOS mobile

- Width: `375px`.
- Minimum total height: `812px`.
- Status bar: `44px`.
- Content: minimum `734px`, grow naturally.
- Home area: `34px`.
- Total height: `44 + max(734, contentHeight) + 34`.

Use these semantic nodes exactly once:

```html
<header data-ios-status-bar>...</header>
<section data-ios-content>...</section>
<footer data-ios-home-area>
  <div data-ios-home-indicator></div>
</footer>
```

The status bar contains `9:41`, cellular signal, Wi-Fi, and battery. Build the symbols with HTML/CSS or inline SVG. Use a black or white foreground selected for the actual top background.

The home indicator is `134px × 5px`, fully rounded, horizontally centered, and 8 px from the bottom edge. Select black or white for the actual bottom background.

For a long page, render the status bar once at the top and the home area once after all content. Do not repeat system chrome every 812 px. Do not make either bar fixed or sticky in the capture HTML.

Do not draw a device frame, notch, or Dynamic Island unless the user explicitly asks for it.
