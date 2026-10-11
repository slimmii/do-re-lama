# Lama Reis

Een volledig-scherm gitaarspel: speel de noot op je gitaar en de lama springt over het monster.
Afgesplitst uit de lama-modus van de [Simisol-notentrainer](../simisol). Alles (ook de notenbalk,
de menu's en de knoppen) wordt op één canvas getekend.

## Starten

Dubbelklik op `start.command`, of in een terminal:

```
python3 serve.py
```

De browser opent op <http://localhost:8770>. Klik op **Spelen** (het spel gaat dan op volledig scherm)
en geef toestemming voor de microfoon. De microfoon werkt enkel via `http://localhost` of `https`.

## Spelvormen

- **De reis**: negen landschappen, elk met een nieuwe noot. Speel 30 noten juist (80% raak) en er staat
  een **poortwachter** aan de grens: speel 5 keer de nieuwe noot en je reist verder (+15 munten).
  Bereikte landschappen kan je opnieuw spelen op de kaart.
- **Vrij oefenen**: kies zelf je noten (bv. wat de leerkracht vraagt). Alle bereikte landschappen wisselen af.
  Minder munten, geen poortwachters; sterren tellen vanaf 3 noten.
- **Lama Run**: zonder gitaar. Spatie / pijltje omhoog / tik om te springen, dubbele sprong in de lucht,
  spring óp een monster om het weg te krijgen.

Speel de noot terwijl ze in de **blauwe balk** staat. Fout of te laat: de lama botst en verliest een leven.
Een **munt** in de lucht? Speel die noot en de lama vangt ze. Met munten koop je in de **winkel** hoedjes,
brillen, gitaren, vachtkleuren en sporen; met sterren (per noot, voor hoe vaak je ze juist speelt) krijg je
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

**Gegevens**: met *Code maken* / *Code plakken* zet je munten, spulletjes en je reis over naar een ander
toestel. De codes (`LAMA-…`) zijn dezelfde als in Simisol, dus je kan je lama ook van daar overhalen.

Alles wordt bewaard in de browser (`localStorage`, sleutel `lama-reis:save`). Met `?test` achter de url
is alles van jou en wordt niets bewaard.

## Code

- `js/engine.js`: canvas over het hele scherm (minstens 720×540 logische eenheden), lus, scènes, overgangen
- `js/ui.js`: knoppen, schakelaars, schuifregelaars, schuifgebieden, toetsenbordnavigatie (op het canvas)
- `js/draw.js`: kleuren, tekst, panelen, vector-iconen
- `js/game.js`: het lama-spel (uit Simisol, nu met de notenbalk op het canvas: `js/staff.js`)
- `js/scenes/`: laadscherm, titel, reis, vrij oefenen, spel, pauze, instellingen, winkel, Lama Run
- Uit Simisol overgenomen: `notes.js`, `pitch.js` + `detector-worklet.js` (toonhoogteherkenning),
  `lama-style.js` (lama + winkelspulletjes), `lama-world.js` (landschappen), `lama-journey.js` (de reis)
- `img/lama/`: de beelden; de bronbestanden en scripts om ze te maken staan nog in `simisol/art` en `simisol/tools`
- `fonts/`: Nunito (SIL Open Font License)
