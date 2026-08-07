# JØNEX Interface Standard

## Design intent

JØNEX uses restrained professional cyberpunk styling. It should resemble
operational equipment rather than a game HUD.

## Palette

```text
Void             #080B0E
Background       #0C1116
Panel            #111820
Raised panel     #17212A
Border           #26333D
Muted border     #1B262F

Primary cyan     #63D7E5
Muted cyan       #3B94A0
Amber warning    #E5A94F
Magenta accent   #B46B9E
Success          #65C98B
Danger           #DF6672

Primary text     #E4EDF1
Secondary text   #91A3AD
Muted text       #657781
```

## Typography

Use system sans-serif fonts for interface text and a monospace stack for
metrics, identifiers, commands, status codes, timestamps, and diagnostics.

## Rules

- Preserve visual hierarchy and whitespace.
- Avoid excessive borders and glow.
- Do not animate continuously without operational meaning.
- Use color as a secondary status indicator.
- Keep critical actions distinct from navigation.
- Respect reduced-motion preferences.
- Provide visible keyboard focus.
- Do not rely on color alone.
