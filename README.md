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
