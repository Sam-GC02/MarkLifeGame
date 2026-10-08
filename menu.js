// The menu page only reads the save data that game.js wrote, to show your best ages.
const SAVE_KEY = "lifeCollectorSave1";
let save = { rebirths: 0, found: [], bestAge: 0, bestEndless: 0 };
try {
  const data = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (data) save = Object.assign(save, data);
} catch (e) {}

document.getElementById("menuBest").textContent =
  `Best age (Play Game): ${save.bestAge || "-"}   |   Best age (Endless): ${save.bestEndless || "-"}   |   Rebirths: ${save.rebirths}   |   Relics: ${save.found.length}`;
