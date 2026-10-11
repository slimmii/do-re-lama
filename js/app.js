// Gedeelde dingen voor alle scènes (ingevuld door main.js): de motor, de lama-beelden, de menu-achtergrond.
export const app = {
  engine: null,
  A: null, // lama-beelden en -gegevens (loadLlama)
  backdrop: null,
  scenes: {}, // fabrieken: title(), journey(), free(), play(opts), treehouse(), games(), tune(), settings(), shop(opts), pause(opts)
};
