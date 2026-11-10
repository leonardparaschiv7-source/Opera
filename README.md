# Opera Pforzheim

Site-ul restaurantului Opera (Restaurant & Pizzeria, Pforzheim): pagină statică, fără framework.
Conține meniul 3D (carte cu pagini care se întorc), galeria cu lightbox și bara de contact.

## Rulare locală

Servește folderul cu orice server static, de exemplu:

```
python -m http.server 5200
```

apoi deschide `http://localhost:5200/`.

## Modificarea meniului

Meniul este generat din `karte/data.mjs`. După o modificare:

```
node karte/build.mjs      # regenerează index.src.html și index.html
node karte/messen.mjs     # (opțional) remăsoară paginile, cere serverul pe portul 5200 și Chrome/Edge
node karte/build.mjs
```

`index.src.html` și `index.html` sunt identice; `index.html` este fișierul publicat.

## Publicare pe Cloudflare

Site static, fără build. Proiectul este un **Worker cu static assets** (`wrangler.jsonc`), conectat la acest depozit:
**Build command** gol, **Deploy command** `npx wrangler deploy`. Fișierele care nu fac parte din site sunt excluse în `.assetsignore`.
La fiecare push pe `main` Cloudflare publică automat. Adresa demo apare la **Settings → Domains & Routes → workers.dev**.
`_headers` setează cache-ul pentru imagini/video.

> **Demo fără domeniu:** pagina are `noindex` (în `index.html`, în `_headers` ca `X-Robots-Tag` și în `index.src.html`).
> Înainte de lansarea pe un domeniu real, scoate `<meta name="robots" ...>` din `index.src.html`, linia `X-Robots-Tag` din `_headers`,
> rulează `node karte/build.mjs` și completează `og:url`/`og:image` și `url` în datele JSON-LD cu adresa reală.
