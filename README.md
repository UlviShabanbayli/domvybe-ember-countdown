# Ember countdown — UI component

**[Live demo](https://domvybe.com/components/ember-countdown/)** · [Step-by-step tutorial](https://domvybe.com/library/ember-countdown/) · [Download the ZIP](https://github.com/UlviShabanbayli/domvybe-ember-countdown/releases/latest/download/ember-countdown-source.zip)

A sale countdown forged in fire: every digit is poured white-hot into the timer and cools to dark iron as it ages, embers rise from the metal, and the last ten seconds blaze.

Open `index.html` through any local static server (for example `python3 -m http.server`) and try it with a mouse,
a finger or the keyboard. Plain HTML, CSS and JavaScript; no build step, no libraries.

- `index.html` — the sale page: the skip link, the hero with the room canvas and the CSS embers, the nav (logo, four links, the cart), the pill, the headline, the role=timer with its spoken reading, the eight digits as DOM text with the metal canvas and the SVG clip over them, the units, the lede, Shop the sale and Remind me with its email form and status line, the caption, Preview the final 10 seconds, the toast and the live region, and a pre-paint script (old keys, the WebGL 2 test, ?nofx)
- `css` — ember.css: the room, the nav, the pill and the headline, the digit strip, colons and units, the buttons and the Remind form, the foot, the MM:SS phone and portrait-tablet layout, the phone on its side, the hot-metal CSS digits and CSS embers without WebGL 2, reduced motion
- `js` — app.js (the countdown and the stored end, the heat of every digit from its age, the pour, the final ten seconds and the end, the pointer bellows, the preview, the Remind form, the toasts and announcements, the scheduler that slows and sleeps, context-loss recovery), forge.js (the two WebGL 2 canvases: the room and the metal), shaders.js (the room light, flames and floor, the blackbody metal with its cooling scale and the pour, the ember particles), atlas.js (the glyph atlas the shaders read), gl.js (a small WebGL 2 helper)

Forge & Hearth and its sale are made up, and the page sends nothing: Shop the sale and the nav show a demo note, and
Remind me checks the email and simulates the request, so put your own in `js/app.js`. Everything is made in code: the
room light, the flames, the steel floor, the embers and the glowing iron of every digit are WebGL 2 shaders, while the
digits themselves stay DOM text (the visible glyph edge is an SVG text clip, sharp at any zoom) inside a real
`role=timer`; no AI pictures. A first visit counts down from 2 days 14 hours 37 minutes 9 seconds and the end is kept in
`localStorage` (`dv85.v1.end`); Remind me keeps only a flag (`dv85.v1.remind`), never the address. `?left=SECONDS` or
`?preview` starts near the end, `?nointro` skips the opening pour and `?fast` shortens the reminder delay. The scheduler
drops to 60 and 30 fps and sleeps when nothing changes. Without WebGL 2 (or with `?nofx`, or when the context is lost)
the digits are a hot-metal CSS fill with CSS embers. The page reads Google Fonts (Abril Fatface, Inter, Playfair
Display).

It respects `prefers-reduced-motion`. Made by Ulvi (Code with Ulvi) · domvybe.com

## Licence

MIT — see [LICENSE](LICENSE). Use it in your own projects, commercial ones included.
