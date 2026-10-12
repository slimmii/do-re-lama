# Do Re Lama

Een volledig-scherm gitaarspel: speel de noot op je gitaar en de lama springt over het monster.
Afgesplitst uit de lama-modus van de [Simisol-notentrainer](../simisol). Alles (ook de notenbalk,
de menu's en de knoppen) wordt op één canvas getekend.

## Starten

Dubbelklik op `start.command`, of in een terminal:

```
npm install
npm run dev
```

De browser opent op <http://localhost:8770>. Klik op **Spelen** (het spel gaat dan op volledig scherm)
en geef toestemming voor de microfoon. De microfoon werkt enkel via `http://localhost` of `https`.

## Online zetten (Vercel)

`npm run build` maakt de site in `dist/` (`npm run preview` om die lokaal te testen). Op Vercel: importeer de repo,
Vercel herkent Vite vanzelf (build `npm run build`, output `dist`). Vercel serveert via https, dus de microfoon werkt.

## Spelvormen

- **De reis**: negen landschappen, elk met een nieuwe noot. Speel 30 noten juist (80% raak) en er staat
  een **poortwachter** aan de grens: speel 5 keer de nieuwe noot en je reist verder (+15 munten).
  Bereikte landschappen kan je opnieuw spelen op de kaart.
- **Vrij oefenen**: kies zelf je noten (bv. wat de leerkracht vraagt). Alle bereikte landschappen wisselen af.
  Minder munten, geen poortwachters; sterren tellen vanaf 3 noten.
- **Lama-boomhut**: de kamer waar de lama uitrust. In het begin staan er enkel een bedje en een tafeltje; in de
  winkel (afdeling *Boomhut*) koop je bedovertrekjes, posters, een spiegel, matjes, stoelen, bloemen,
  gitaren (twee haakjes aan de muur, dus twee tegelijk) en huisdiertjes.
  Je mag zoveel huisdieren tegelijk hebben als je wil: ze wandelen rond, elk op hun eigen tempo; de goudvis staat in
  zijn bokaal op het tafeltje. Klik op de lama om te springen, op een huisdier voor hartjes, op een gitaar voor een akkoordje. Met *Slapen* (of Z) gaat het licht uit:
  de lama wandelt naar haar bed, springt erin en slaapt onder het dekentje; met *Opstaan* springt ze eruit.
- **De lama eten geven**: in de winkel (afdeling *Eten*) koop je voedsel: lamavoer, fruit, groenten, maaltijden,
  lekkers en drinken (meer dan 50 soorten, 1 tot 15 munten). Eten is op als de lama het opeet, dus munten blijven
  altijd iets waard. In de boomhut open je met *Eten* (of E) de voorraadkast: tik op iets en het vliegt naar de lama.
  Haar buikje (het balkje onder de hartjes) loopt in een dag leeg; heeft ze honger, dan zegt ze dat zelf. Lekkers vult
  weinig, maar dan springt ze van plezier (en dat mag ook als toetje als ze vol zit). De hartjes zijn de helft
  gestemde snaren en de helft een vol buikje. Nieuw eten: één regel in `FOODS` (`js/food.js`).
- **Gitaar stemmen** (boomhut › *Spelen*, of bij Instellingen › Microfoon): tokkel een losse snaar en de
  regenboogmeter toont of ze te laag of te hoog klinkt; hou ze juist tot de ster vol is. De lama is blij (hartjes in de
  boomhut) zolang de snaren onlangs gestemd zijn: een snaar blijft een halve dag vers en zakt dan in drie dagen weg.
  Een droevige lama loopt trager onder een regenwolkje. Alle snaren juist: feest, en hoogstens eens per dag 3 munten.

Speel de noot terwijl ze in de **blauwe balk** staat. Fout of te laat: de lama botst en verliest een leven.
Een **munt** in de lucht? Speel die noot en de lama vangt ze. Met munten koop je in de **winkel** hoedjes,
brillen, gitaren, vachtkleuren en sporen, en spulletjes voor de boomhut; met sterren (per noot, voor hoe vaak je ze juist speelt) krijg je
speciale spulletjes.

## Toetsen

| Toets | Wat |
|---|---|
| Enter / spatie | starten, knop kiezen |
| pijltjes, Tab | door de menu's |
| Esc / P | pauze, terug |
| ← → | snelheid tijdens het spel |
| F | volledig scherm |
| A S D F … | de noten (van laag naar hoog) als *Spelen met het toetsenbord* aanstaat |

## Instellingen

Levens (1–10 of onsterfelijk), snelheid, hoe streng op de maat, grote notennaam, notennamen, vingers (m/i),
metronoom en volume, microfoongevoeligheid, microfoonvertraging (met **meten**), echo-onderdrukking,
spelen met het toetsenbord, geluidjes, volledig scherm.

**Gegevens**: met *Code maken* / *Code plakken* zet je munten, spulletjes, de boomhut, de voorraadkast en je reis over naar een ander
toestel. De codes (`LAMA-…`) zijn dezelfde als in Simisol, dus je kan je lama ook van daar overhalen.

Alles wordt bewaard in de browser (`localStorage`, sleutel `lama-reis:save`: de oude naam, zodat bewaarde spelletjes blijven werken). Met `?test` achter de url
is alles van jou en wordt niets bewaard.

## Code

- `js/engine.js`: canvas over het hele scherm (minstens 720×540 logische eenheden), lus, scènes, overgangen
- `js/ui.js`: knoppen, schakelaars, schuifregelaars, schuifgebieden, toetsenbordnavigatie (op het canvas)
- `js/draw.js`: kleuren, tekst, panelen, vector-iconen
- `js/game.js`: het lama-spel (uit Simisol, nu met de notenbalk op het canvas: `js/staff.js`)
- `js/scenes/`: laadscherm, titel, reis, vrij oefenen, spel, pauze, instellingen, winkel, boomhut
- `js/treehouse.js`: de boomhut: plekken in de kamer, de spulletjes en het tekenen. **Iets nieuws toevoegen**:
  zet een beeld met doorzichtige achtergrond in `public/img/lama/boomhut/<id>.webp` en voeg één regel toe aan
  `HOUSE_ITEMS`. Een nieuw bed heeft ook een `<id>_slaap.webp` nodig (hetzelfde bed met de slapende lama erin,
  even groot); zonder dat beeld slaapt de lama rechtop naast het bed. Een nieuwe soort (bv. lampen) is een extra plek in `HOUSE_SLOTS`; de winkel krijgt er
  vanzelf een tabblad bij. De beelden zijn gemaakt met OpenArt (Nano Banana 2) op magenta en uitgeknipt.
- Uit Simisol overgenomen: `notes.js`, `pitch.js` + `detector-worklet.js` (toonhoogteherkenning),
  `lama-style.js` (lama + winkelspulletjes), `lama-world.js` (landschappen), `lama-journey.js` (de reis)
- `public/img/lama/`: de beelden; de bronbestanden en scripts om ze te maken staan nog in `simisol/art` en `simisol/tools`
- `public/fonts/`: Nunito (SIL Open Font License)
