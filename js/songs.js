// De liedjesbibliotheek (vrij oefenen): bekende liedjes, enkel met de beginnersnoten die je ook bij Vrij oefenen
// kan kiezen (PRACTICE_NOTES: eerste positie, zonder kruisen of mollen).
// Een liedje is een rij tokens: 'E4' (een tel), 'E4/.5' (een halve tel), 'r/1' (een rust van een tel).
// '|' is een maatstreep: enkel om te lezen en om te controleren (elke maat telt 'meter' tellen; de eerste
// maat mag een opmaat van 'up' tellen zijn). Een tel = een noot van het gewone spel, dus een halve tel
// betekent dat de lama twee keer zo snel moet springen.
// 'rep' = zo vaak na elkaar (een riff); group: 'rock' = in de groep Rock-riffs in plaats van bij de liedjes.
// Nieuw liedje: één regel in RAW. De moeilijkheid wordt vanzelf berekend (difficulty).
import { FRETBOARD, PRACTICE_NOTES, writtenMidi } from './notes.js';
import { diatonic } from './staff.js';
import { STAGES } from './lama-journey.js';

const RAW = [
  { id: 'kortjakje', name: 'Altijd is Kortjakje ziek', from: 'kinderliedje', meter: 4,
    tune: 'C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2 | G4 G4 F4 F4 | E4 E4 D4/2 | G4 G4 F4 F4 | E4 E4 D4/2 | C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2' },
  { id: 'buns', name: 'Hot Cross Buns', from: 'Engels kinderliedje', meter: 4,
    tune: 'E4 D4 C4/2 | E4 D4 C4/2 | C4/.5 C4/.5 C4/.5 C4/.5 D4/.5 D4/.5 D4/.5 D4/.5 | E4 D4 C4/2' },
  { id: 'mary', name: 'Mary Had a Little Lamb', from: 'Engels kinderliedje', meter: 4,
    tune: 'E4 D4 C4 D4 | E4 E4 E4/2 | D4 D4 D4/2 | E4 G4 G4/2 | E4 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4/4' },
  { id: 'ode', name: 'Ode an die Freude', from: 'Beethoven', meter: 4,
    tune: 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/1.5 D4/.5 D4/2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/.5 C4/2' },
  { id: 'jacob', name: 'Vader Jacob', from: 'kinderliedje', meter: 4,
    tune: 'G4 A4 B4 G4 | G4 A4 B4 G4 | B4 C5 D5/2 | B4 C5 D5/2 | D5/.5 E5/.5 D5/.5 C5/.5 B4 G4 | D5/.5 E5/.5 D5/.5 C5/.5 B4 G4 | G4 D4 G4/2 | G4 D4 G4/2' },
  { id: 'eendjes', name: 'Alle eendjes zwemmen in het water', from: 'kinderliedje', meter: 4,
    tune: 'C4/.5 D4/.5 E4/.5 F4/.5 G4 G4 | A4/.5 A4/.5 A4/.5 A4/.5 G4/2 | A4/.5 A4/.5 A4/.5 A4/.5 G4/2 | F4/.5 F4/.5 F4/.5 F4/.5 E4 E4 | D4/.5 D4/.5 D4/.5 D4/.5 C4/2' },
  { id: 'rhody', name: 'Go Tell Aunt Rhody', from: 'Amerikaans volksliedje', meter: 4,
    tune: 'E4/2 E4 D4 | C4/2 C4/2 | D4/2 D4 F4 | E4 D4 C4/2 | G4/2 G4 F4 | E4/2 C4/2 | D4/2 D4 F4 | E4 D4 C4/2' },
  { id: 'kumbaya', name: 'Kumbaya', from: 'spiritual', meter: 4,
    tune: 'C4 E4 G4 G4 | G4/2 A4 A4 | G4/4 | C4 E4 G4 G4 | G4/2 F4 E4 | D4/4 | C4 E4 G4 G4 | G4/2 A4 A4 | G4/4 | F4/2 E4 E4 | D4 D4 C4/2' },
  { id: 'michael', name: 'Michael, Row the Boat Ashore', from: 'spiritual', meter: 4,
    tune: 'C4 E4 G4/1.5 E4/.5 | G4 A4 G4/2 | E4 G4 A4/2 | G4/4 | E4 G4 G4/1.5 E4/.5 | F4 E4 D4/2 | C4 D4 E4/1.5 D4/.5 | C4/4' },
  { id: 'macdonald', name: 'Old MacDonald Had a Farm', from: 'Amerikaans kinderliedje', meter: 4,
    tune: 'G4 G4 G4 D4 | E4 E4 D4/2 | B4 B4 A4 A4 | G4/3 D4 | G4 G4 G4 D4 | E4 E4 D4/2 | B4 B4 A4 A4 | G4/4' },
  { id: 'saints', name: 'When the Saints Go Marching In', from: 'spiritual', meter: 4, up: 3,
    tune: 'C4 E4 F4 | G4/4 | r/1 C4 E4 F4 | G4/4 | r/1 C4 E4 F4 | G4/2 E4/2 | C4/2 E4/2 | D4/4 | r/1 E4 E4 D4 | C4/3 C4 | E4/2 G4/2 | G4 F4/2 E4/.5 F4/.5 | G4/2 E4/2 | C4/2 D4/2 | C4/4' },
  { id: 'hansje', name: 'Hansje klein', from: 'Duits kinderliedje', meter: 4,
    tune: 'G4 E4 E4/2 | F4 D4 D4/2 | C4 D4 E4 F4 | G4 G4 G4/2 | G4 E4 E4/2 | F4 D4 D4/2 | C4 E4 G4 G4 | C4/4 | D4 D4 D4 D4 | D4 E4 F4/2 | E4 E4 E4 E4 | E4 F4 G4/2 | G4 E4 E4/2 | F4 D4 D4/2 | C4 E4 G4 G4 | C4/4' },
  { id: 'london', name: 'London Bridge Is Falling Down', from: 'Engels kinderliedje', meter: 4,
    tune: 'G4/1.5 A4/.5 G4 F4 | E4 F4 G4/2 | D4 E4 F4/2 | E4 F4 G4/2 | G4/1.5 A4/.5 G4 F4 | E4 F4 G4/2 | D4/2 G4/2 | E4 C4/3' },
  { id: 'row', name: 'Row, Row, Row Your Boat', from: 'Engels kinderliedje', meter: 3,
    tune: 'C4/1.5 C4/1.5 | C4 D4/.5 E4/1.5 | E4 D4/.5 E4 F4/.5 | G4/3 | C5/.5 C5/.5 C5/.5 G4/.5 G4/.5 G4/.5 | E4/.5 E4/.5 E4/.5 C4/.5 C4/.5 C4/.5 | G4 F4/.5 E4 D4/.5 | C4/3' },
  { id: 'jingle', name: 'Jingle Bells', from: 'kerstliedje', meter: 4,
    tune: 'E4 E4 E4/2 | E4 E4 E4/2 | E4 G4 C4/1.5 D4/.5 | E4/4 | F4 F4 F4/1.5 F4/.5 | F4 E4 E4 E4/.5 E4/.5 | E4 D4 D4 E4 | D4/2 G4/2 | E4 E4 E4/2 | E4 E4 E4/2 | E4 G4 C4/1.5 D4/.5 | E4/4 | F4 F4 F4/1.5 F4/.5 | F4 E4 E4 E4/.5 E4/.5 | G4 G4 F4 D4 | C4/4' },
  { id: 'oldman', name: 'This Old Man', from: 'Engels kinderliedje', meter: 4,
    tune: 'G4 E4 G4/2 | G4 E4 G4/2 | A4 G4 F4 E4 | D4 E4 F4/2 | E4/.5 F4/.5 G4 C4 C4/.5 C4/.5 | C4/.5 D4/.5 E4/.5 F4/.5 G4/2 | G4 D4 D4 F4 | E4 D4 C4/2' },
  { id: 'maneschijn', name: 'In de maneschijn', from: 'kinderliedje', meter: 4,
    tune: 'C5 C5 C5 D5 | E5/2 D5/2 | C5 E5 D5 D5 | C5/4 | C5 C5 C5 D5 | E5/2 D5/2 | C5 E5 D5 D5 | C5/4 | D5 D5 D5 D5 | A4/2 A4/2 | D5 C5 B4 A4 | G4/4 | C5 C5 C5 D5 | E5/2 D5/2 | C5 E5 D5 D5 | C5/4' },
  { id: 'lente', name: 'De lente', from: 'Vivaldi, De vier jaargetijden', meter: 4,
    tune: 'C4 E4 E4 E4 | D4/.5 C4/.5 G4/3 | G4/.5 F4/.5 E4 E4 E4 | D4/.5 C4/.5 G4/3 | G4/.5 F4/.5 E4/.5 F4/.5 G4 F4 | E4 D4 C4/2' },
  { id: 'nachtmusik', name: 'Eine kleine Nachtmusik', from: 'Mozart', meter: 4,
    tune: 'C5 r/.5 G4/.5 C5 r/.5 G4/.5 | C5/.5 G4/.5 C5/.5 E5/.5 G5/2 | F5 r/.5 D5/.5 F5 r/.5 D5/.5 | F5/.5 D5/.5 B4/.5 D5/.5 G4/2 | C5 r/.5 G4/.5 C5 r/.5 G4/.5 | C5/.5 G4/.5 C5/.5 E5/.5 G5/2 | F5 r/.5 D5/.5 F5 r/.5 D5/.5 | F5/.5 D5/.5 B4/.5 D5/.5 G4/2' },
  { id: 'brahms', name: 'Wiegenlied', from: 'Brahms', meter: 3, up: 1,
    tune: 'E4/.5 E4/.5 | G4/2 E4/.5 E4/.5 | G4/2 E4/.5 G4/.5 | C5 B4/1.5 A4/.5 | A4 G4 D4/.5 E4/.5 | F4 D4 D4/.5 E4/.5 | F4/2 D4/.5 F4/.5 | B4/.5 A4/.5 G4 B4 | C5/2' },
  { id: 'stillenacht', name: 'Stille nacht', from: 'kerstliedje', meter: 3,
    tune: 'G4/1.5 A4/.5 G4 | E4/3 | G4/1.5 A4/.5 G4 | E4/3 | D5/2 D5 | B4/3 | C5/2 C5 | G4/3 | A4/2 A4 | C5/1.5 B4/.5 A4 | G4/1.5 A4/.5 G4 | E4/3 | A4/2 A4 | C5/1.5 B4/.5 A4 | G4/1.5 A4/.5 G4 | E4/3 | D5/2 D5 | F5/1.5 D5/.5 B4 | C5/3 | E5/3 | C5 G4 E4 | G4/1.5 F4/.5 D4 | C4/3' },
  { id: 'merry', name: 'We Wish You a Merry Christmas', from: 'kerstliedje', meter: 3, up: 1,
    tune: 'G4 | C5 C5/.5 D5/.5 C5/.5 B4/.5 | A4 A4 A4 | D5 D5/.5 E5/.5 D5/.5 C5/.5 | B4 G4 G4 | E5 E5/.5 F5/.5 E5/.5 D5/.5 | C5 A4 G4/.5 G4/.5 | A4 D5 B4 | C5/2' },
  { id: 'deck', name: 'Deck the Halls', from: 'kerstliedje', meter: 4,
    tune: 'G5/1.5 F5/.5 E5 D5 | C5 D5 E5 C5 | D5/.5 E5/.5 F5/.5 D5/.5 E5/1.5 D5/.5 | C5 B4 C5/2 | G5/1.5 F5/.5 E5 D5 | C5 D5 E5 C5 | D5/.5 E5/.5 F5/.5 D5/.5 E5/1.5 D5/.5 | C5 B4 C5/2' },
  { id: 'joy', name: 'Joy to the World', from: 'kerstliedje', meter: 4,
    tune: 'C5/2 B4/1.5 A4/.5 | G4/3 F4 | E4/2 D4/2 | C4/3 G4 | A4/3 A4 | B4/3 B4 | C5/3 C5 | C5 B4 A4 G4 | G4/1.5 F4/.5 E4 C5 | C5 B4 A4 G4 | G4/1.5 F4/.5 E4 E4 | E4 E4 E4 E4/.5 F4/.5 | G4/3 F4/.5 E4/.5 | D4 D4 D4 D4/.5 E4/.5 | F4/3 E4/.5 D4/.5 | C4 C5/2 A4 | G4/1.5 F4/.5 E4 F4 | E4/2 D4/2 | C4/4' },
  { id: 'cancan', name: 'Cancan', from: 'Offenbach', meter: 4,
    tune: 'C4/2 D4/.5 F4/.5 E4/.5 D4/.5 | G4 G4 G4/.5 A4/.5 E4/.5 F4/.5 | D4 D4 D4/.5 F4/.5 E4/.5 D4/.5 | C4/.5 C5/.5 B4/.5 A4/.5 G4/.5 F4/.5 E4/.5 D4/.5 | C4/2 D4/.5 F4/.5 E4/.5 D4/.5 | G4 G4 G4/.5 A4/.5 E4/.5 F4/.5 | D4 D4 D4/.5 F4/.5 E4/.5 D4/.5 | C4/.5 G4/.5 D4/.5 E4/.5 C4/2' },
  { id: 'cucaracha', name: 'La cucaracha', from: 'Mexicaans volksliedje', meter: 4, up: 1.5,
    tune: 'C4/.5 C4/.5 C4/.5 | F4/1.5 A4 C4/.5 C4/.5 C4/.5 | F4/1.5 A4/2.5 | r/1 F4/.5 F4/.5 E4/.5 E4/.5 D4/.5 D4/.5 | C4/4' },
  { id: 'wheels', name: 'The Wheels on the Bus', from: 'Amerikaans kinderliedje', meter: 4, up: 1,
    tune: 'C4 | F4 F4/.5 F4/.5 F4 A4 | C5 A4 F4/2 | G4 E4 C4/2 | C5 A4 F4 C4 | F4 F4/.5 F4/.5 F4 A4 | C5 A4 F4/2 | G4/2 C4 C4 | F4/3' },
  { id: 'spider', name: 'Itsy Bitsy Spider', from: 'Engels kinderliedje', meter: 3, up: 0.5,
    tune: 'D4/.5 | G4 G4/.5 G4 A4/.5 | B4/1.5 B4 A4/.5 | G4 A4/.5 B4 G4/.5 | G4/2.5 B4/.5 | B4 C5/.5 D5/1.5 | D5 C5/.5 B4 C5/.5 | D5 B4/.5 B4/1.5 | G4/2.5 G4/.5 | G4 A4/.5 B4/1.5 | B4 A4/.5 G4 A4/.5 | B4 G4/.5 G4/1.5 | r/2 D4/.5 D4/.5 | G4 G4/.5 G4 A4/.5 | B4/1.5 B4 A4/.5 | G4 A4/.5 B4 G4/.5 | G4/3' },
  { id: 'auldlang', name: 'Auld Lang Syne', from: 'Schots volksliedje', meter: 4, up: 1,
    tune: 'C4 | F4/1.5 F4/.5 F4 A4 | G4/1.5 F4/.5 G4 A4/.5 G4/.5 | F4/1.5 F4/.5 A4 C5 | D5/3 D5 | C5/1.5 A4/.5 A4 F4 | G4/1.5 F4/.5 G4 A4 | F4/1.5 D4/.5 D4 C4 | F4/3' },
  { id: 'alouette', name: 'Alouette', from: 'Frans-Canadees volksliedje', meter: 4,
    tune: 'F4/1.5 G4/.5 A4 A4 | G4/.5 F4/.5 G4/.5 A4/.5 F4 C4 | F4/1.5 G4/.5 A4 A4 | G4/.5 F4/.5 G4/.5 A4/.5 F4/2' },
  { id: 'yankee', name: 'Yankee Doodle', from: 'Amerikaans volksliedje', meter: 4,
    tune: 'C5/.5 C5/.5 D5/.5 E5/.5 C5/.5 E5/.5 D5/.5 G4/.5 | C5/.5 C5/.5 D5/.5 E5/.5 C5 B4 | C5/.5 C5/.5 D5/.5 E5/.5 F5/.5 E5/.5 D5/.5 C5/.5 | B4/.5 G4/.5 A4/.5 B4/.5 C5 C5' },
  { id: 'jolly', name: "For He's a Jolly Good Fellow", from: 'Engels feestliedje', meter: 3, up: 0.5,
    tune: 'C4/.5 | E4 E4/.5 E4/.5 D4/.5 E4/.5 | F4/1.5 E4 E4/.5 | D4 D4/.5 D4/.5 C4/.5 D4/.5 | E4/1.5 C4 C4/.5 | E4 E4/.5 E4/.5 D4/.5 E4/.5 | F4/1.5 A4 A4/.5 | G4 G4/.5 F4 D4/.5 | C4/2.5' },
  { id: 'camptown', name: 'Camptown Races', from: 'Stephen Foster', meter: 4,
    tune: 'G4/.5 G4/.5 E4/.5 G4/.5 A4/.5 G4/.5 E4 | E4 D4/3 | G4/.5 G4/.5 E4/.5 G4/.5 A4/.5 G4/.5 E4 | D4/.5 E4/.5 D4 C4/2 | C4/.5 C4/.5 E4/.5 G4/.5 C5/2 | A4/.5 A4/.5 C5/.5 A4/.5 G4/2 | G4/.5 G4/.5 E4/.5 G4/.5 A4/.5 G4/.5 E4 | D4/.5 E4/.5 D4 C4/2' },
  { id: 'largo', name: 'Largo', from: 'Dvořák, Uit de Nieuwe Wereld', meter: 4,
    tune: 'E4/1.5 G4/.5 G4/2 | E4/1.5 D4/.5 C4/2 | D4 E4 G4 E4 | D4/4 | E4/1.5 G4/.5 G4/2 | E4/1.5 D4/.5 C4/2 | D4 E4 D4 C4 | C4/4' },
  { id: 'surprise', name: 'Verrassingssymfonie', from: 'Haydn', meter: 4,
    tune: 'C5/.5 C5/.5 E5/.5 E5/.5 G5/.5 G5/.5 E5 | F5/.5 F5/.5 D5/.5 D5/.5 B4/.5 B4/.5 G4 | C5/.5 C5/.5 E5/.5 E5/.5 G5/.5 G5/.5 E5 | F5/.5 F5/.5 D5/.5 D5/.5 B4/.5 B4/.5 G4' },
  { id: 'tell', name: 'Wilhelm Tell', from: 'Rossini', meter: 4,
    tune: 'G4/.25 G4/.25 G4/.5 G4/.25 G4/.25 G4/.5 G4/.25 G4/.25 C5/.5 D5/.5 E5/.5 | G4/.25 G4/.25 G4/.5 G4/.25 G4/.25 G4/.5 G4/.25 G4/.25 C5/.5 E5/.5 D5/.5 | G4/.25 G4/.25 G4/.5 G4/.25 G4/.25 G4/.5 G4/.25 G4/.25 C5/.5 D5/.5 E5/.5 | C5/.5 E5/.5 G5/.5 E5/.5 C5/2' },
  { id: 'canon', name: 'Canon', from: 'Pachelbel', meter: 4,
    tune: 'E5/2 D5/2 | C5/2 B4/2 | A4/2 G4/2 | A4/2 B4/2 | C5 E5 G5 F5 | E5 C5 E5 D5 | C5 A4 C5 G4 | F4 A4 G4 F4' },
  { id: 'sailor', name: 'What Shall We Do with the Drunken Sailor', from: 'zeemanslied', meter: 4,
    tune: 'A4 A4/.5 A4/.5 A4 A4/.5 A4/.5 | A4 D4 F4 A4 | G4 G4/.5 G4/.5 G4 G4/.5 G4/.5 | G4 C4 E4 G4 | A4 A4/.5 A4/.5 A4 A4/.5 A4/.5 | A4 B4 C5 D5 | C5 A4 G4 E4 | D4/2 D4/2' },
  { id: 'swanee', name: 'Swanee River', from: 'Stephen Foster', meter: 4,
    tune: 'E4/1.5 D4/.5 C4/.5 E4/.5 D4/.5 C4/.5 | C5/2 A4 C5 | G4/3 E4/.5 C4/.5 | D4/4 | E4/1.5 D4/.5 C4/.5 E4/.5 D4/.5 C4/.5 | C5/2 A4 C5 | G4/3 E4/.5 C4/.5 | D4/1.5 D4/.5 C4/2' },
  { id: 'bonnie', name: 'My Bonnie Lies over the Ocean', from: 'Schots volksliedje', meter: 3, up: 1,
    tune: 'G4 | E5 D5 C5 | D5 C5 A4 | G4 E4/2 | r/2 G4 | E5 D5 C5 | C5 B4 C5 | D5/3 | r/2 G4 | E5 D5 C5 | D5 C5 A4 | G4 E4/2 | r/2 G4 | A4 D5 C5 | B4 A4 B4 | C5/2' },
  { id: 'bigben', name: 'De klokken van de Big Ben', from: 'Westminster', meter: 3,
    tune: 'E5 C5 D5 | G4/3 | G4 D5 E5 | C5/3 | E5 D5 C5 | G4/3 | G4 D5 E5 | C5/3' },
  { id: 'vos', name: 'Vos, je hebt de gans gestolen', from: 'Duits kinderliedje', meter: 4,
    tune: 'C4 D4 E4 F4 | G4/2 G4/2 | A4 F4 C5 A4 | G4/4 | A4 F4 C5 A4 | G4/4 | G4 F4 F4 F4 | F4 E4 E4 E4 | E4 D4 E4 D4 | C4 E4 G4/2 | G4 F4 F4 F4 | F4 E4 E4 E4 | E4 D4 E4 D4 | C4/4' },
  { id: 'grace', name: 'Amazing Grace', from: 'gospel', meter: 3, up: 1,
    tune: 'D4 | G4/2 B4/.5 G4/.5 | B4/2 A4 | G4/2 E4 | D4/2 D4 | G4/2 B4/.5 G4/.5 | B4/2 A4 | D5/3 | D5/2 B4 | D5/1.5 B4/.5 G4 | D4/2 E4 | G4/1.5 E4/.5 D4 | D4/2 D4 | G4/2 B4/.5 G4/.5 | B4/2 A4 | G4/2' },
  { id: 'taps', name: 'Taptoe', from: 'trompetsignaal', meter: 4, up: 1,
    tune: 'G4/.75 G4/.25 | C5/3 G4/.75 C5/.25 | E5/3 G4/.5 C5/.5 | E5 G4/.5 C5/.5 E5 G4/.5 C5/.5 | E5/2 C5 E5 | G5/2 E5 C5 | G4/3 G4/.75 G4/.25 | C5/3' },
  { id: 'birthday', name: 'Happy Birthday', from: 'verjaardagsliedje', meter: 3, up: 1,
    tune: 'G4/.75 G4/.25 | A4 G4 C5 | B4/2 G4/.75 G4/.25 | A4 G4 D5 | C5/2 G4/.75 G4/.25 | G5 E5 C5 | B4 A4 F5/.75 F5/.25 | E5 C5 D5 | C5/2' },
  { id: 'susanna', name: 'Oh! Susanna', from: 'Stephen Foster', meter: 4, up: 1,
    tune: 'C4/.5 D4/.5 | E4 G4 G4/1.5 A4/.5 | G4 E4 C4/1.5 D4/.5 | E4 E4 D4 C4 | D4/3 C4/.5 D4/.5 | E4 G4 G4/1.5 A4/.5 | G4 E4 C4/1.5 D4/.5 | E4 E4 D4 D4 | C4/3 r/1 | F4/2 F4/2 | A4 A4/2 A4 | G4 G4 E4 C4 | D4/3 C4/.5 D4/.5 | E4 G4 G4/1.5 A4/.5 | G4 E4 C4/1.5 D4/.5 | E4 E4 D4 D4 | C4/3' },
  { id: 'donau', name: 'An der schönen blauen Donau', from: 'Johann Strauss', meter: 3, up: 1,
    tune: 'C4 | C4 E4 G4 | G4/3 | r/1 G5 G5 | r/1 E5 E5 | r/2 C4 | C4 E4 G4 | G4/3 | r/1 G5 G5 | r/1 F5 F5' },

  // ---------- rock-riffs: getransponeerd naar de noten van het spel (de lage snaren zitten er niet in) ----------
  { id: 'sevennation', group: 'rock', name: 'Seven Nation Army', from: 'The White Stripes', meter: 4, rep: 4,
    tune: 'A4/1.5 A4/.5 C5/.75 A4/.75 G4/.5 | F4/2 E4/2' },
  { id: 'bitesdust', group: 'rock', name: 'Another One Bites the Dust', from: 'Queen', meter: 4, rep: 4,
    tune: 'E4/.5 E4/.5 E4/.5 r/1.5 E4/.25 E4/.25 E4/.5 | G4/.5 E4/.25 A4/.75 r/2.5' },
  { id: 'ironman', group: 'rock', name: 'Iron Man', from: 'Black Sabbath', meter: 4, rep: 2,
    tune: 'E4 G4 G4/.5 A4/1.5 | C5/.25 B4/.25 C5/.25 B4/.25 C5/.5 B4/.5 G4 G4/.5 A4/.5 | A4/2 r/2' },
  { id: 'layla', group: 'rock', name: 'Layla', from: 'Eric Clapton (Derek and the Dominos)', meter: 4, rep: 2,
    tune: 'A4/.25 C5/.25 D5/.25 F5/.25 D5/.25 C5/.25 D5/1.5 r/1 | A4/.25 C5/.25 D5/.25 F5/.25 D5/.25 C5/.25 D5/.5 C5/.5 A4 r/.5' },
  { id: 'sweetchild', group: 'rock', name: "Sweet Child o' Mine", from: "Guns N' Roses", meter: 4,
    tune: 'C4/.5 C5/.5 G4/.5 F4/.5 F5/.5 G4/.5 E5/.5 G4/.5 | C4/.5 C5/.5 G4/.5 F4/.5 F5/.5 G4/.5 E5/.5 G4/.5 | D4/.5 C5/.5 G4/.5 F4/.5 F5/.5 G4/.5 E5/.5 G4/.5 | D4/.5 C5/.5 G4/.5 F4/.5 F5/.5 G4/.5 E5/.5 G4/.5 | F4/.5 C5/.5 G4/.5 F4/.5 F5/.5 G4/.5 E5/.5 G4/.5 | F4/.5 C5/.5 G4/.5 F4/.5 F5/.5 G4/.5 E5/.5 G4/.5 | C4/.5 C5/.5 G4/.5 F4/.5 F5/.5 G4/.5 E5/.5 G4/.5 | C4/.5 C5/.5 G4/.5 F4/.5 F5/.5 G4/.5 E5/.5 G4/.5' },
  { id: 'countdown', group: 'rock', name: 'The Final Countdown', from: 'Europe', meter: 4, rep: 2,
    tune: 'E5/.25 D5/.25 E5 A4/2.5 | F5/.25 E5/.25 F5/.5 E5/.5 D5/2.5 | F5/.25 E5/.25 F5 A4/2.5 | D5/.25 C5/.25 D5/.5 C5/.5 B4/.5 D5/.5 C5/1.5' },
  { id: 'nothingelse', group: 'rock', name: 'Nothing Else Matters', from: 'Metallica (intro, losse snaren)', meter: 3, rep: 4,
    tune: 'r/.5 G4/.5 B4/.5 E5/.5 B4/.5 G4/.5' },
  { id: 'pressure', group: 'rock', name: 'Under Pressure', from: 'Queen & David Bowie', meter: 4, rep: 4,
    tune: 'D5/.5 D5/.5 D5/.5 D5/.25 D5/.25 D5/.5 A4/.5 D5' },
  { id: 'billiejean', group: 'rock', name: 'Billie Jean', from: 'Michael Jackson', meter: 4, rep: 4,
    tune: 'A4/.5 E4/.5 G4/.5 A4/.5 G4/.5 E4/.5 D4/.5 E4/.5' },
  { id: 'petergunn', group: 'rock', name: 'Peter Gunn', from: 'Henry Mancini', meter: 4, rep: 4,
    tune: 'A4/.5 A4/.5 B4/.5 A4/.5 C5/.5 A4/.5 D5/.5 C5/.5' },
  { id: 'hitroad', group: 'rock', name: 'Hit the Road Jack', from: 'Ray Charles', meter: 4, rep: 4,
    tune: 'A4/1.5 G4/.5 F4 E4' },
  { id: 'money', group: 'rock', name: 'Money', from: 'Pink Floyd', meter: 7, rep: 2,
    tune: 'A4 E5/.5 A4/.5 E5/.5 G4/.5 A4 C5/.5 A4/1.5 E5/.5 A4/.5' },
  { id: 'comeasyouare', group: 'rock', name: 'Come As You Are', from: 'Nirvana', meter: 4, rep: 2,
    tune: 'A4/.5 A4/.5 B4/.5 C5/.5 r/.5 E5/.5 C5/.5 E5/.5 | C5/.5 C5/.5 B4/.5 A4/.5 E4/.5 A4/.5 A4/.5 E4/.5' },
  { id: 'louie', group: 'rock', name: 'Louie Louie', from: 'The Kingsmen', meter: 4, rep: 4,
    tune: 'A4/.5 A4/.5 A4 r/.5 D5/.5 D5 | E5/.5 E5/.5 E5 r/.5 D5/.5 D5' },
  { id: 'rockyou', group: 'rock', name: 'We Will Rock You (stamp-stamp-klap)', from: 'Queen', meter: 4, rep: 8,
    tune: 'E4 E4 B4 r/1' },
  { id: 'wildthing', group: 'rock', name: 'Wild Thing', from: 'The Troggs', meter: 4, rep: 4,
    tune: 'A4 D5 E5/1.5 D5/.5 | A4/4' },
  { id: 'reallygotme', group: 'rock', name: 'You Really Got Me', from: 'The Kinks', meter: 4,
    tune: 'F4/.5 G4 r/.5 F4/.5 G4 r/.5 | F4/.5 G4 r/.5 F4/.5 G4 r/.5 | G4/.5 A4 r/.5 G4/.5 A4 r/.5 | G4/.5 A4 r/.5 G4/.5 A4 r/.5 | C5/.5 D5 r/.5 C5/.5 D5 r/.5 | C5/.5 D5 r/.5 C5/.5 D5 r/.5 | F4/.5 G4 r/.5 F4/.5 G4 r/.5 | F4/.5 G4/3.5' },
  { id: 'shouldistay', group: 'rock', name: 'Should I Stay or Should I Go', from: 'The Clash', meter: 4, rep: 4,
    tune: 'D5/.5 D5/.5 r/.5 D5/.5 G5 D5' },
  { id: 'proudmary', group: 'rock', name: 'Proud Mary (intro)', from: 'Creedence Clearwater Revival', meter: 4, rep: 2,
    tune: 'C5/.5 A4 C5/.5 A4 C5/.5 A4/.5 | C5/.5 A4 G4/.5 F4/.5 F4/.5 F4/.5 D4/.5 | D4/4' },
  { id: 'gloria', group: 'rock', name: 'Gloria', from: 'Them', meter: 4, rep: 4,
    tune: 'E5 D5/.5 A4/1.5 D5' },
  { id: 'labamba', group: 'rock', name: 'La Bamba', from: 'Ritchie Valens', meter: 4, rep: 4,
    tune: 'C4/.5 E4/.5 G4 F4/.5 A4/.5 C5 | G4/.5 B4/.5 D5 F4/.5 A4/.5 C5' },
];

// 'E4/.5 r/1 | G4' -> {notes: [{p, at, dur}], beats, bars: [tel van elke maatstreep]}
export function parseTune(song) {
  const notes = [], bars = [];
  let at = 0;
  const tune = Array(song.rep || 1).fill(song.tune.trim()).join(' | '); // een riff een paar keer na elkaar
  for (const tok of tune.split(/\s+/)) {
    if (tok === '|') { bars.push(at); continue; }
    const [p, d] = tok.split('/');
    const dur = d == null ? 1 : +d;
    if (!(dur > 0)) throw new Error(`${song.id}: rare duur in ${tok}`);
    if (p !== 'r') {
      if (!PRACTICE_NOTES.includes(p)) throw new Error(`${song.id}: ${p} is geen beginnersnoot`);
      notes.push({ p, at, dur });
    }
    at += dur;
  }
  return { notes, beats: at, bars };
}

// Moeilijkheid: hoeveel verschillende noten, hoe ver uit elkaar, hoe snel (halve en kwart tellen), grote sprongen,
// hoe lang, en hoe laat je de noten op de reis leert (de losse snaren zijn het makkelijkst).
const STAGE_OF = Object.fromEntries(STAGES.flatMap((s, i) => s.notes.map((n) => [n, i])));
function difficulty(s) {
  const ns = s.notes, used = new Set(ns.map((n) => n.p));
  const mids = [...used].map(writtenMidi);
  const range = Math.max(...mids) - Math.min(...mids);
  const minDur = Math.min(...ns.map((n) => n.dur));
  const fast = ns.filter((n) => n.dur < 1).length / ns.length;
  let leap = 0;
  for (let i = 1; i < ns.length; i++) leap += Math.max(0, Math.abs(diatonic(ns[i].p) - diatonic(ns[i - 1].p)) - 2);
  const late = [...used].reduce((a, p) => a + (STAGE_OF[p] ?? 9), 0) / used.size;
  return used.size * 1.2 + range / 5 + (minDur < 0.5 ? 3 : minDur < 1 ? 1.5 : 0) + fast * 4 + (leap / ns.length) * 4 + ns.length / 25 + late * 0.35;
}

export const LEVELS = ['heel makkelijk', 'makkelijk', 'gemiddeld', 'moeilijk', 'heel moeilijk'];

// Alle liedjes, van makkelijk naar moeilijk; level 0..4. De gewone liedjes worden in vijf even grote groepen
// verdeeld; een rock-riff krijgt het niveau van de gewone liedjes met een gelijkaardige moeilijkheid.
export const SONGS = RAW.map((r) => {
  const s = { up: 0, ...r, ...parseTune(r) };
  s.used = [...new Set(s.notes.map((n) => n.p))].sort((a, b) => writtenMidi(a) - writtenMidi(b));
  s.minDur = Math.min(...s.notes.map((n) => n.dur));
  s.score = difficulty(s);
  return s;
}).sort((a, b) => a.score - b.score);
const plain = SONGS.filter((s) => !s.group);
plain.forEach((s, i) => { s.level = Math.min(LEVELS.length - 1, Math.floor((i * LEVELS.length) / plain.length)); });
const bounds = LEVELS.slice(1).map((_, l) => plain.find((s) => s.level === l + 1).score);
for (const s of SONGS) if (s.group) s.level = bounds.filter((b) => s.score >= b).length;

// Groepen in het schema: de gewone liedjes per niveau, daarna de rock-riffs.
export const GROUPS = [
  ...LEVELS.map((name, l) => ({ name, level: l, songs: plain.filter((s) => s.level === l) })),
  { name: 'rock-riffs', rock: true, songs: SONGS.filter((s) => s.group === 'rock') },
];

// Sterren voor een liedje (beste % juist), zoals bij de noten.
export const songStars = (pct) => (pct >= 95 ? 3 : pct >= 85 ? 2 : pct >= 70 ? 1 : 0);

export const songById = (id) => SONGS.find((s) => s.id === id) || null;

// Noten die in minstens één liedje voorkomen, van laag naar hoog (de kolommen van het schema).
export const SONG_NOTES = Object.keys(FRETBOARD).filter((p) => SONGS.some((s) => s.used.includes(p))).sort((a, b) => writtenMidi(a) - writtenMidi(b));
