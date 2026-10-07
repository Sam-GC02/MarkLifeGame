// ===== SETTINGS (change these to tweak the game) =====
const WORLD_W = 2400;        // world width in pixels. The world loops left/right.
const GROUND_Y = 400;        // top of the ground
const GRAVITY = 0.55;
const JUMP = 12;
const MAX_SPAWNS = 14;       // how many ✨ are in the world at once
const START_AGE = 20;
const MAX_AGE = 100;         // you die of old age here
const YEAR_SECONDS = 30;     // 1 year = 30 seconds, so a decade = 5 minutes. Set to 5 to test fast!
const YEAR_FRAMES = YEAR_SECONDS * 60;
const BASE_MAX_HP = 100;
const REBIRTH_AGE = 60;      // Play Game mode: rebirth unlocks at this age
const SAVE_KEY = "lifeCollectorSave1";

// ✨ pickups: weight = chance, money = $ given, hp = health given, rare = luck makes it more likely
const ITEMS = [
  { emoji: "🪙", name: "Coin",      weight: 35, money: 2000 },
  { emoji: "💵", name: "Cash",      weight: 15, money: 10000 },
  { emoji: "❤️", name: "Heart",     weight: 25, hp: 8 },
  { emoji: "🥇", name: "Gold Bar",  weight: 10, money: 50000,  rare: true },
  { emoji: "💖", name: "Big Heart", weight: 8,  hp: 25,       rare: true },
  { emoji: "💎", name: "Gem",       weight: 4,  money: 200000, rare: true },
  { emoji: "🏆", name: "Jackpot",   weight: 1,  money: 500000, rare: true },
];

// Falling / flying dangers.
// kill = instant death. habit = a bad habit that drains HP. The rest are money traps.
const HAZARDS = [
  { id: "rock",   emoji: "🪨", weight: 12, move: "fall",   kill: "Crushed by a falling rock" },
  { id: "knife",  emoji: "🔪", weight: 8,  move: "side",   kill: "Stabbed by a flying knife" },
  { id: "gun",    emoji: "🔫", weight: 6,  move: "bullet", kill: "Shot by a gun" },
  { id: "junk",   emoji: "🍔", weight: 14, move: "fall",   habit: "junk",  label: "junk food" },
  { id: "smoke",  emoji: "🚬", weight: 10, move: "fall",   habit: "smoke", label: "smoking" },
  { id: "drink",  emoji: "🍺", weight: 10, move: "fall",   habit: "drink", label: "drinking" },
  { id: "car",    emoji: "🚗", weight: 8,  move: "fall",   trap: true },
  { id: "card",   emoji: "💳", weight: 8,  move: "fall",   trap: true },
  { id: "gamble", emoji: "🎰", weight: 8,  move: "fall",   trap: true },
];

// HP lost per second from each bad habit
const HABIT_DRAIN = { junk: 0.4, smoke: 0.6, drink: 0.5 };
const DEBT_DRAIN = 0.5;      // HP lost per second while your money is below zero
const CAR_PAYMENT = 60000;   // paid every year
const CAR_YEARS = 5;

// Relics are hidden around the map. Each gives a permanent boost and you keep them after dying or rebirth.
const RELICS = [
  { id: "clover", emoji: "🍀", name: "Lucky Clover", desc: "+20% luck" },
  { id: "boots",  emoji: "👟", name: "Swift Boots",  desc: "+15% speed" },
  { id: "tome",   emoji: "📖", name: "Wisdom Tome",  desc: "+20% money" },
  { id: "heart",  emoji: "💖", name: "Heart Charm",  desc: "+20 max HP" },
  { id: "shield", emoji: "🛡️", name: "Slow Charm",   desc: "dangers fall 15% slower" },
  { id: "magnet", emoji: "🧲", name: "Magnet",       desc: "bigger pickup range" },
];

// Choices that pop up every 10 years. ok() decides if you can pick it.
const CHOICES = [
  {
    emoji: "🏢", name: "Make a company",
    desc: "Money pickups x2. Costs $800,000 and 30 HP.",
    need: "Needs $800,000 and more than 30 HP",
    ok: () => !run.company && run.money >= 800000 && run.hp > 30,
    apply: () => { run.money -= 800000; run.hp -= 30; run.company = true; return "🏢 Company started! Money pickups are doubled."; },
  },
  {
    emoji: "🌴", name: "Enjoy life",
    desc: "Heal 30 HP. Costs $100,000.",
    need: "Needs $100,000",
    ok: () => run.money >= 100000,
    apply: () => { run.money -= 100000; heal(30); return "🌴 You enjoyed life. +30 HP"; },
  },
  {
    emoji: "💼", name: "Keep working",
    desc: "Nothing changes.",
    need: "",
    ok: () => true,
    apply: () => "💼 Back to work.",
  },
  {
    emoji: "🏋️", name: "Join a gym",
    desc: "Quit all bad habits and heal 10 HP. Costs $50,000.",
    need: "Needs $50,000",
    ok: () => run.money >= 50000,
    apply: () => { run.money -= 50000; run.junk = run.smoke = run.drink = false; heal(10); return "🏋️ Bad habits gone! +10 HP"; },
  },
  {
    emoji: "📈", name: "Invest in stocks",
    desc: "Costs $200,000. 50% chance to win $300,000, 50% chance to lose it all.",
    need: "Needs $200,000",
    ok: () => run.money >= 200000,
    apply: () => {
      if (Math.random() < 0.5) { run.money += 300000; return "📈 The stocks went up! +$300,000 profit."; }
      run.money -= 200000; return "📉 The stocks crashed. You lost $200,000.";
    },
  },
  {
    emoji: "🧾", name: "Pay off debt",
    desc: "Clear your credit card and car payments. Costs $150,000.",
    need: "Needs $150,000 and a debt to pay",
    ok: () => (run.card || run.carYears > 0) && run.money >= 150000,
    apply: () => { run.money -= 150000; run.card = false; run.carYears = 0; return "🧾 Debts cleared."; },
  },
  {
    emoji: "🏖️", name: "Retire early",
    desc: "No more money traps. Health pickups x2, money pickups x0.5.",
    need: "Needs $1,000,000 and age 50+",
    ok: () => !run.retired && run.age >= 50 && run.money >= 1000000,
    apply: () => { run.retired = true; return "🏖️ Retired! No more money traps."; },
  },
];

// ===== SAVE DATA (only things you keep forever) =====
let save = { rebirths: 0, found: [], bestAge: 0, bestEndless: 0 };
function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (data) save = Object.assign(save, data);
  } catch (e) {}
}
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ===== RUN DATA (resets every time you start or die) =====
let run = null;
function newRun() {
  run = {
    age: START_AGE, yearTimer: 0, money: 0, hp: maxHp(),
    junk: false, smoke: false, drink: false,   // bad habits
    carYears: 0, card: false,                  // money traps
    company: false, retired: false,
    drains: { junk: 0, smoke: 0, drink: 0, debt: 0, age: 0 }, // how much HP each cause took (for the death message)
  };
}

let mode = "game";     // "game" or "endless"
let state = "menu";    // "menu", "playing", "choice", "dead"

// ===== STATS =====
const has = (id) => save.found.includes(id);
function luck() { return 1 + save.rebirths * 0.25 + (has("clover") ? 0.2 : 0); }
function moneyMult() {
  return (1 + save.rebirths * 0.10 + (has("tome") ? 0.2 : 0)) * (run.company ? 2 : 1) * (run.retired ? 0.5 : 1);
}
function speed() { return 4 * (1 + save.rebirths * 0.05 + (has("boots") ? 0.15 : 0)); }
function maxHp() { return BASE_MAX_HP + (has("heart") ? 20 : 0); }
function pickupRange() { return 28 + (has("magnet") ? 30 : 0); }
function heal(n) { run.hp = Math.min(maxHp(), run.hp + n); }
const fmt = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();

function rollItem() {
  const weights = ITEMS.map((item) => (item.rare ? item.weight * luck() : item.weight));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ITEMS.length; i++) { r -= weights[i]; if (r <= 0) return ITEMS[i]; }
  return ITEMS[0];
}

// ===== LOOPING WORLD HELPERS =====
const wrap = (x) => ((x % WORLD_W) + WORLD_W) % WORLD_W;
// signed shortest distance from a to b, going around the loop
const wrapDist = (a, b) => ((b - a + WORLD_W / 2) % WORLD_W + WORLD_W) % WORLD_W - WORLD_W / 2;

// ===== ELEMENTS =====
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const toast = document.getElementById("toast");
const rebirthBtn = document.getElementById("rebirthBtn");
const $ = (id) => document.getElementById(id);
const CX = canvas.width / 2;

// ===== WORLD =====
const player = { x: 1200, y: GROUND_Y, vy: 0, onGround: true };
let platforms = [], sparkles = [], relics = [], hazards = [], hazardTimer = 90, tick = 0;
const keys = {};

function makePlatforms() {
  platforms = [];
  for (let i = 0; i < 9; i++) {
    const x = Math.round((i * 256 + Math.random() * 96) / 32) * 32;
    const w = 32 * (3 + Math.floor(Math.random() * 3));
    platforms.push({ x, y: 304, w });
    if (Math.random() < 0.5) platforms.push({ x: x + 32 * Math.floor(Math.random() * 3), y: 208, w: 96 });
  }
}
// random spot on the ground or on top of a platform
function randomSpot() {
  if (Math.random() < 0.5) {
    const p = platforms[Math.floor(Math.random() * platforms.length)];
    return { x: p.x + Math.random() * p.w, y: p.y };
  }
  return { x: Math.random() * WORLD_W, y: GROUND_Y };
}
function spawnSparkle() { sparkles.push(randomSpot()); }
function placeRelics() {
  relics = RELICS.filter((r) => !has(r.id)).map((r) => Object.assign({}, r, randomSpot()));
}
function resetWorld() {
  player.x = 1200; player.y = GROUND_Y; player.vy = 0; player.onGround = true;
  hazards = [];
  sparkles = [];
  hazardTimer = 90;
  makePlatforms();
  placeRelics();
  while (sparkles.length < MAX_SPAWNS) spawnSparkle();
  for (const k in keys) keys[k] = false;
}

// ===== INPUT =====
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  // only block scrolling/space while playing, so menu buttons still work with the keyboard
  if (state === "playing" && (e.key.startsWith("Arrow") || e.key === " ")) e.preventDefault();
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// ===== MESSAGES =====
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.textContent = ""), 4000);
}

// ===== SCREENS (menu, choice popup, death popup) =====
function showOverlay(id) {
  for (const o of document.querySelectorAll(".overlay")) o.classList.remove("show");
  if (id) $(id).classList.add("show");
}
function refreshMenu() {
  $("menuBest").textContent =
    `Best age (Play Game): ${save.bestAge || "-"}   |   Best age (Endless): ${save.bestEndless || "-"}   |   Rebirths: ${save.rebirths}`;
}
function startRun(m) {
  mode = m;
  save.found = save.found.filter((id) => RELICS.some((r) => r.id === id)); // ignore old save data
  newRun();
  resetWorld();
  state = "playing";
  showOverlay(null);
  showToast(m === "game" ? "Collect 💰 and ❤️. Dodge everything that falls!" : "Endless mode: survive as long as you can!");
  updateUI();
}
function backToMenu() {
  state = "menu";
  hazards = [];
  refreshMenu();
  showOverlay("menu");
}

// ===== COLLECTING =====
function collectSparkle() {
  const item = rollItem();
  let text = "";
  if (item.money) {
    const gained = Math.round(item.money * moneyMult());
    run.money += gained;
    text = `+${fmt(gained)}`;
  }
  if (item.hp) {
    const gained = Math.round(item.hp * (run.retired ? 2 : 1));
    heal(gained);
    text = `+${gained} HP`;
  }
  showToast(`${item.rare ? "✨ RARE! " : ""}${item.emoji} ${item.name}  ${text}`);
  updateUI();
}
function collectRelic(r) {
  save.found.push(r.id);
  if (r.id === "heart") run.hp += 20;
  showToast(`${r.emoji} ${r.name} found! ${r.desc}`);
  saveGame();
  updateUI();
}

// ===== DANGERS =====
function spawnHazard() {
  const pool = HAZARDS.filter((h) => !(run.retired && h.trap)); // retired = no money traps
  let r = Math.random() * pool.reduce((a, h) => a + h.weight, 0);
  let def = pool[0];
  for (const h of pool) { r -= h.weight; if (r <= 0) { def = h; break; } }

  const slow = has("shield") ? 0.85 : 1;
  const h = { def, x: 0, y: 0, vx: 0, vy: 0, r: 16, warn: 50, side: 0, life: 0 };
  if (def.move === "fall") {
    h.x = wrap(player.x + (Math.random() * 700 - 350));
    h.y = -30;
    h.vy = (4 + Math.random() * 2 + (run.age - START_AGE) * 0.03) * slow;
    if (def.id === "rock") h.r = 12 + Math.random() * 10;
  } else {
    // knives and bullets fly across the screen. side = direction they move (1 = right)
    h.side = Math.random() < 0.5 ? -1 : 1;
    h.y = GROUND_Y - 15 - Math.random() * 90; // locked in now, so you can see where it will come from
    const spd = def.move === "bullet" ? 10 : 6;
    h.vx = h.side * spd * slow;
    h.r = def.move === "bullet" ? 6 : 14;
    h.warn = def.move === "bullet" ? 55 : 45;
    h.life = Math.ceil((CX * 2 + 80) / Math.abs(h.vx)) + 5;
  }
  hazards.push(h);
}

function touchHazard(h) {
  const d = h.def;
  if (d.kill) { die(d.kill); return; }
  if (d.habit) {
    run[d.habit] = true;
    showToast(`${d.emoji} Bad habit: ${d.label}! It drains your HP. Join a gym to quit.`);
  } else if (d.id === "car") {
    run.carYears = CAR_YEARS;
    showToast(`🚗 Expensive car! You pay ${fmt(CAR_PAYMENT)} every year for ${CAR_YEARS} years.`);
  } else if (d.id === "card") {
    run.card = true;
    run.money -= 80000;
    showToast("💳 Credit card debt! -$80,000, and negative money grows 20% every year.");
  } else if (d.id === "gamble") {
    const amount = run.money > 0 ? Math.floor(run.money / 2) : 50000; // half your money (or $50,000 if you're broke)
    if (Math.random() < 0.5) { run.money += amount; showToast(`🎰 You won ${fmt(amount)}!`); }
    else { run.money -= amount; showToast(`🎰 You lost ${fmt(amount)}.`); }
  }
  updateUI();
}

// ===== YEARS, CHOICES, DEATH =====
function nextYear() {
  run.age++;
  if (run.carYears > 0) {
    run.money -= CAR_PAYMENT;
    run.carYears--;
    showToast(`🚗 Car payment: -${fmt(CAR_PAYMENT)} (${run.carYears} left)`);
  }
  if (run.card) {
    if (run.money < 0) run.money = Math.round(run.money * 1.2);
    else run.card = false;
  }
  if (run.age >= MAX_AGE) { die("Died of old age"); return; }
  if (mode === "game" && run.age === REBIRTH_AGE) showToast("♻️ You are 60! You can Rebirth now.");
  if (run.age % 10 === 0) openChoice();
  updateUI();
}

function openChoice() {
  state = "choice";
  for (const k in keys) keys[k] = false;
  $("choiceAge").textContent = `You are now ${run.age}. What do you do with the next 10 years?`;
  const box = $("choices");
  box.innerHTML = "";
  CHOICES.forEach((c) => {
    const b = document.createElement("button");
    b.className = "choice";
    b.disabled = !c.ok();
    b.innerHTML = `<b>${c.emoji} ${c.name}</b><span>${c.desc}</span>` +
      (b.disabled && c.need ? `<span class="need">🔒 ${c.need}</span>` : "");
    b.addEventListener("click", () => {
      const msg = c.apply();
      state = "playing";
      showOverlay(null);
      showToast(msg);
      updateUI();
    });
    box.appendChild(b);
  });
  showOverlay("choicePopup");
}

function causeFromDrains() {
  const names = {
    junk: "Died from eating too much junk food",
    smoke: "Died from smoking",
    drink: "Died from drinking",
    debt: "Died from the stress of debt",
    age: "Died of old age",
  };
  let best = "age";
  for (const k in run.drains) if (run.drains[k] > run.drains[best]) best = k;
  return names[best];
}

function die(cause) {
  if (state !== "playing") return;
  state = "dead";
  const age = Math.floor(run.age);
  let newBest = false;
  if (mode === "endless") {
    if (age > save.bestEndless) { save.bestEndless = age; newBest = true; }
  } else if (age > save.bestAge) { save.bestAge = age; newBest = true; }
  saveGame();
  $("deathCause").textContent = `${cause} at age ${age}.`;
  $("deathStats").textContent =
    `Mode: ${mode === "game" ? "Play Game" : "Endless"}   |   Money: ${fmt(run.money)}` + (newBest ? "   |   🏅 New best age!" : "");
  updateUI();
  showOverlay("deathPopup");
}

// ===== REBIRTH (Play Game mode only) =====
function canRebirth() { return mode === "game" && state === "playing" && run.age >= REBIRTH_AGE; }
rebirthBtn.addEventListener("click", () => {
  if (!canRebirth()) return;
  if (!confirm("Rebirth? You go back to age 20 and lose your money, but keep your relics and get permanent bonuses.")) return;
  save.bestAge = Math.max(save.bestAge, Math.floor(run.age));
  save.rebirths++;
  saveGame();
  newRun();
  resetWorld();
  showToast(`♻️ REBIRTH ${save.rebirths}! You are 20 again.`);
  updateUI();
});

// ===== UI =====
function updateUI() {
  $("age").textContent = Math.floor(run.age);
  $("coins").textContent = fmt(run.money);
  $("coins").classList.toggle("negative", run.money < 0);
  $("luck").textContent = luck().toFixed(2);
  $("rebirths").textContent = save.rebirths;
  $("nextchoice").textContent = `Next choice at age ${(Math.floor(run.age / 10) + 1) * 10}`;

  const hp = Math.max(0, run.hp);
  $("hpfill").style.width = Math.min(100, (hp / maxHp()) * 100) + "%";
  $("hptext").textContent = `${Math.ceil(hp)} / ${maxHp()} HP`;

  const status = [];
  if (run.junk) status.push("🍔");
  if (run.smoke) status.push("🚬");
  if (run.drink) status.push("🍺");
  if (run.carYears > 0) status.push(`🚗(${run.carYears}y)`);
  if (run.card) status.push("💳");
  if (run.company) status.push("🏢");
  if (run.retired) status.push("🏖️");
  $("status").textContent = status.length ? status.join(" ") : "No habits or debts";

  $("book").innerHTML = RELICS.map((r) =>
    has(r.id) ? `<li>${r.emoji} ${r.name} <small>(${r.desc})</small> ✓</li>` : `<li class="missing">❔ ???</li>`
  ).join("");
  $("bookcount").textContent = `${save.found.length} / ${RELICS.length} relics found. Explore the loop to find the rest!`;

  rebirthBtn.disabled = !canRebirth();
  if (mode === "endless") {
    $("rebirthinfo").textContent = "Endless mode has no rebirth. Survive as long as you can!";
  } else {
    $("rebirthinfo").textContent = run.age >= REBIRTH_AGE
      ? "Ready! Next: +25% luck, +5% speed, +10% money."
      : `Rebirth unlocks at age ${REBIRTH_AGE}. (Age ${run.age} now)`;
  }
}

// ===== UPDATE =====
function update() {
  if (state !== "playing") return;

  // player movement
  const dir = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
  const jump = keys["w"] || keys["arrowup"] || keys[" "];
  if (jump && player.onGround) { player.vy = -JUMP; player.onGround = false; }
  player.x = wrap(player.x + dir * speed());
  player.vy += GRAVITY;
  const prevY = player.y;
  player.y += player.vy;
  player.onGround = false;
  if (player.vy >= 0) {
    if (player.y >= GROUND_Y) { player.y = GROUND_Y; player.vy = 0; player.onGround = true; }
    for (const p of platforms) {
      if (Math.abs(wrapDist(player.x, p.x + p.w / 2)) < p.w / 2 + 10 && prevY <= p.y && player.y >= p.y) {
        player.y = p.y; player.vy = 0; player.onGround = true;
      }
    }
  }

  const bodyY = player.y - 18;

  // time passes: 1 year every YEAR_SECONDS
  run.yearTimer++;
  if (run.yearTimer >= YEAR_FRAMES) {
    run.yearTimer = 0;
    nextYear();
    if (state !== "playing") return;
  }

  // slow health drain from bad habits, debt and old age
  const drain = (key, perSecond) => {
    if (perSecond <= 0) return;
    run.hp -= perSecond / 60;
    run.drains[key] += perSecond / 60;
  };
  if (run.junk) drain("junk", HABIT_DRAIN.junk);
  if (run.smoke) drain("smoke", HABIT_DRAIN.smoke);
  if (run.drink) drain("drink", HABIT_DRAIN.drink);
  if (run.money < 0) drain("debt", DEBT_DRAIN);
  if (run.age > 45) drain("age", (run.age - 45) * 0.02);
  if (run.hp <= 0) { run.hp = 0; die(causeFromDrains()); return; }

  // collect ✨
  sparkles = sparkles.filter((s) => {
    if (Math.abs(wrapDist(player.x, s.x)) < pickupRange() && Math.abs(bodyY - (s.y - 20)) < pickupRange() + 6) {
      collectSparkle();
      return false;
    }
    return true;
  });
  while (sparkles.length < MAX_SPAWNS) spawnSparkle();

  // collect relics
  relics = relics.filter((r) => {
    if (Math.abs(wrapDist(player.x, r.x)) < pickupRange() && Math.abs(bodyY - (r.y - 20)) < pickupRange() + 6) {
      collectRelic(r);
      return false;
    }
    return true;
  });

  // dangers: more often as you get older (faster in Endless mode)
  hazardTimer--;
  if (hazardTimer <= 0) {
    spawnHazard();
    const ramp = mode === "endless" ? 1.8 : 1.2;
    hazardTimer = Math.max(25, 100 - (run.age - START_AGE) * ramp - save.rebirths * 4);
  }
  hazards = hazards.filter((h) => {
    if (h.warn > 0) {
      h.warn--;
      // when the warning ends, knives and bullets appear just off the edge of the screen
      if (h.warn === 0 && h.def.move !== "fall") h.x = wrap(player.x - h.side * (CX + 40));
      return true;
    }
    if (h.def.move === "fall") {
      const prev = h.y;
      h.y += h.vy;
      if (h.y >= GROUND_Y) return false;
      for (const p of platforms) { // platforms protect you from anything falling
        if (Math.abs(wrapDist(h.x, p.x + p.w / 2)) < p.w / 2 && prev < p.y && h.y >= p.y) return false;
      }
    } else {
      h.x = wrap(h.x + h.vx);
      h.life--;
      if (h.life <= 0) return false;
    }
    if (Math.abs(wrapDist(player.x, h.x)) < h.r + 10 && Math.abs(bodyY - h.y) < h.r + 16) {
      touchHazard(h);
      return false;
    }
    return state === "playing";
  });
}

// ===== DRAW =====
const sx = (worldX) => CX + wrapDist(player.x, worldX); // world x -> screen x

function drawTiles(leftScreenX, y, w, fill, top) {
  for (let t = 0; t < w; t += 32) {
    ctx.fillStyle = fill;
    ctx.fillRect(leftScreenX + t, y, 32, 32);
    ctx.fillStyle = top;
    ctx.fillRect(leftScreenX + t, y, 32, 8);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.strokeRect(leftScreenX + t, y, 32, 32);
  }
}

function draw() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#0b1d3a");
  sky.addColorStop(1, "#3a6ea5");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ground (WORLD_W is a multiple of 32, so tiles line up when the world loops)
  const gOff = -(((player.x - CX) % 32) + 32) % 32;
  for (let x = gOff - 32; x < canvas.width + 32; x += 32) drawTiles(x, GROUND_Y, 32, "#5b3a29", "#4caf50");
  ctx.fillStyle = "#3d2618";
  ctx.fillRect(0, GROUND_Y + 32, canvas.width, canvas.height);

  for (const p of platforms) drawTiles(sx(p.x + p.w / 2) - p.w / 2, p.y, p.w, "#7a5230", "#6fcf5a");

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // warnings
  for (const h of hazards) {
    if (h.warn <= 0) continue;
    ctx.strokeStyle = "rgba(255,80,80,0.35)";
    ctx.beginPath();
    if (h.def.move === "fall") {
      ctx.moveTo(sx(h.x), 0); ctx.lineTo(sx(h.x), GROUND_Y);
      ctx.stroke();
      ctx.font = "20px serif";
      ctx.fillText("⚠️", sx(h.x), 18);
    } else {
      const edgeX = h.side > 0 ? 24 : canvas.width - 24; // it comes from the side it moves away from
      ctx.moveTo(0, h.y); ctx.lineTo(canvas.width, h.y);
      ctx.stroke();
      if (Math.floor(h.warn / 6) % 2 === 0) {
        ctx.font = "28px serif";
        ctx.fillText(h.def.emoji, edgeX, h.y);
      }
    }
  }

  ctx.font = "26px serif";
  sparkles.forEach((s) => ctx.fillText("✨", sx(s.x), s.y - 20));
  ctx.font = "32px serif";
  relics.forEach((r) => ctx.fillText(r.emoji, sx(r.x), r.y - 22));

  // flying / falling dangers
  for (const h of hazards) {
    if (h.warn > 0) continue;
    if (h.def.move === "bullet") {
      ctx.fillStyle = "#ffd966";
      ctx.beginPath(); ctx.arc(sx(h.x), h.y, h.r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.font = h.def.id === "rock" ? `${Math.round(h.r * 2)}px serif` : "34px serif";
      ctx.fillText(h.def.emoji, sx(h.x), h.y);
    }
  }

  if (state !== "dead") {
    ctx.font = "36px serif";
    ctx.fillText("🧍", CX, player.y - 18);
  } else {
    ctx.font = "36px serif";
    ctx.fillText("🪦", CX, player.y - 18);
  }
}

function loop() {
  update();
  draw();
  if (++tick % 6 === 0) updateUI(); // keeps the HP bar moving
  requestAnimationFrame(loop);
}

// ===== START =====
loadGame();
save.found = save.found.filter((id) => RELICS.some((r) => r.id === id));
newRun();
resetWorld();
$("playBtn").addEventListener("click", () => startRun("game"));
$("endlessBtn").addEventListener("click", () => startRun("endless"));
$("menuBtn").addEventListener("click", backToMenu);
refreshMenu();
showOverlay("menu");
updateUI();
loop();
setInterval(saveGame, 5000);
