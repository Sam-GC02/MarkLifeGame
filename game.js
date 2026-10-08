// ===== SETTINGS (change these to tweak the game) =====
const WORLD_W = 3200;        // world width in pixels (multiple of 32). The world loops left/right.
const GROUND_Y = 540;        // top of the ground
const GRAVITY = 0.55;
const JUMP = 12;
const MAX_SPAWNS = 18;       // how many pickups are in the world at once
const START_AGE = 20;
const MAX_AGE = 100;         // you die of old age here
const YEAR_SECONDS = 10;     // 1 year = 10 seconds, so a choice popup comes every 100 seconds
const YEAR_FRAMES = YEAR_SECONDS * 60;
const BASE_MAX_HP = 100;
const REBIRTH_AGE = 60;      // Play Game mode: rebirth unlocks at this age
const SAVE_KEY = "lifeCollectorSave1";

// HP lost per second from each bad habit, and from debt
const HABIT_DRAIN = { junk: 0.3, smoke: 0.45, drink: 0.35 };
const DEBT_DRAIN = 0.4;      // HP lost per second while your money is below zero
const CAR_PAYMENT = 60000;   // paid every year
const CAR_YEARS = 5;
const CARD_DEBT = 80000;

// Pickups: weight = chance, money = $ given, hp = health given, rare = luck makes it more likely
const ITEMS = [
  { emoji: "🪙", name: "Coin",       weight: 35, money: 2000 },
  { emoji: "💵", name: "Cash",       weight: 15, money: 10000 },
  { emoji: "❤️", name: "Heart",      weight: 25, hp: 8 },
  { emoji: "💰", name: "Money Bag",  weight: 10, money: 50000,  rare: true },
  { emoji: "💖", name: "Big Heart",  weight: 8,  hp: 25,       rare: true },
  { emoji: "💎", name: "Gem",        weight: 4,  money: 200000, rare: true },
];

// Everything here FALLS from the sky.
// kill = instant death. habit = a bad habit that drains HP. trap = a money trap.
const HAZARDS = [
  { id: "rock",   emoji: "🪨", weight: 12, name: "Rock",        kill: "Crushed by a falling rock",   desc: "Instant death" },
  { id: "knife",  emoji: "🔪", weight: 8,  name: "Knife",       kill: "Stabbed by a falling knife",  desc: "Instant death" },
  { id: "gun",    emoji: "🔫", weight: 6,  name: "Gun",         kill: "Shot by a falling gun",       desc: "Instant death" },
  { id: "junk",   emoji: "🍔", weight: 14, name: "Junk food",   habit: "junk",  label: "junk food", desc: `Bad habit: drains ${HABIT_DRAIN.junk} HP every second until you quit` },
  { id: "smoke",  emoji: "🚬", weight: 10, name: "Cigarette",   habit: "smoke", label: "smoking",   desc: `Bad habit: drains ${HABIT_DRAIN.smoke} HP every second until you quit` },
  { id: "drink",  emoji: "🍺", weight: 10, name: "Beer",        habit: "drink", label: "drinking",  desc: `Bad habit: drains ${HABIT_DRAIN.drink} HP every second until you quit` },
  { id: "car",    emoji: "🚗", weight: 8,  name: "Expensive car", trap: true, desc: `You pay $${CAR_PAYMENT.toLocaleString()} every year for ${CAR_YEARS} years` },
  { id: "card",   emoji: "💳", weight: 8,  name: "Credit card", trap: true, desc: `-$${CARD_DEBT.toLocaleString()} now. Negative money grows 20% a year and drains HP` },
  { id: "gamble", emoji: "🎰", weight: 8,  name: "Gambling",    trap: true, desc: "50/50: win or lose half your money" },
];

// Relics are hidden around the map. Each gives a permanent boost and you keep them after dying or rebirth.
const RELICS = [
  { id: "clover", emoji: "🍀", name: "Lucky Clover", desc: "+20% luck" },
  { id: "boots",  emoji: "👟", name: "Swift Boots",  desc: "+15% speed" },
  { id: "tome",   emoji: "📖", name: "Wisdom Tome",  desc: "+20% money" },
  { id: "heart",  emoji: "💖", name: "Heart Charm",  desc: "+20 max HP" },
  { id: "shield", emoji: "🛡️", name: "Slow Charm",   desc: "dangers fall 15% slower" },
  { id: "magnet", emoji: "🧲", name: "Magnet",       desc: "bigger pickup range" },
];

// Choices that pop up every 10 years (the game pauses). ok() decides if you can pick it.
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

// ===== RUN DATA (resets every time you start a run) =====
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

// The menu page sends you here with ?mode=game or ?mode=endless
let mode = new URLSearchParams(location.search).get("mode") === "endless" ? "endless" : "game";
let state = "playing";    // "playing", "choice" (game paused), or "dead"

// ===== STATS =====
const has = (id) => save.found.includes(id);
function luck() { return 1 + save.rebirths * 0.25 + (has("clover") ? 0.2 : 0); }
function moneyMult() {
  return (1 + save.rebirths * 0.10 + (has("tome") ? 0.2 : 0)) * (run.company ? 2 : 1) * (run.retired ? 0.5 : 1);
}
function speed() { return 4 * (1 + save.rebirths * 0.05 + (has("boots") ? 0.15 : 0)); }
function maxHp() { return BASE_MAX_HP + (has("heart") ? 20 : 0); }
function pickupRange() { return 30 + (has("magnet") ? 30 : 0); }
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
const player = { x: 1600, y: GROUND_Y, vy: 0, onGround: true };
let platforms = [], pickups = [], relics = [], hazards = [], hazardTimer = 120, tick = 0;
const keys = {};

function makePlatforms() {
  platforms = [];
  for (let i = 0; i < 12; i++) {
    const x = Math.round((i * 256 + Math.random() * 96) / 32) * 32;
    const w = 32 * (3 + Math.floor(Math.random() * 3));
    platforms.push({ x, y: GROUND_Y - 96, w });
    if (Math.random() < 0.5) platforms.push({ x: x + 32 * Math.floor(Math.random() * 3), y: GROUND_Y - 192, w: 96 });
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
// each pickup is rolled when it spawns, so you can SEE if it is money or health
function spawnPickup() { pickups.push(Object.assign(randomSpot(), { item: rollItem() })); }
function placeRelics() {
  relics = RELICS.filter((r) => !has(r.id)).map((r) => Object.assign({}, r, randomSpot()));
}
function resetWorld() {
  player.x = 1600; player.y = GROUND_Y; player.vy = 0; player.onGround = true;
  hazards = [];
  pickups = [];
  hazardTimer = 120;
  makePlatforms();
  placeRelics();
  while (pickups.length < MAX_SPAWNS) spawnPickup();
  for (const k in keys) keys[k] = false;
}

// ===== INPUT =====
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  // only block scrolling/space while playing, so popup buttons still work with the keyboard
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

// ===== POPUPS (choice popup and death popup) =====
function showOverlay(id) {
  for (const o of document.querySelectorAll(".overlay")) o.classList.remove("show");
  if (id) $(id).classList.add("show");
}

// ===== COLLECTING =====
function collectPickup(p) {
  const item = p.item;
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
  showToast(`${item.rare ? "RARE! " : ""}${item.emoji} ${item.name}  ${text}`);
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
  hazards.push({
    def,
    x: wrap(player.x + (Math.random() * 1000 - 500)), // somewhere on your screen
    y: -30,
    vy: (2.6 + Math.random() * 1.4 + (run.age - START_AGE) * 0.02) * slow,
    r: def.id === "rock" ? 14 + Math.random() * 10 : 17,
    warn: 70, // frames of warning before it falls
  });
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
    run.money -= CARD_DEBT;
    showToast(`💳 Credit card debt! -${fmt(CARD_DEBT)}, and negative money grows 20% every year.`);
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
  if (run.age % 10 === 0) openChoice(); // pauses the game
  updateUI();
}

function openChoice() {
  state = "choice"; // update() does nothing while state is "choice", so the whole game is paused
  for (const k in keys) keys[k] = false;
  $("choiceAge").textContent = `You are now ${run.age}. Money: ${fmt(run.money)}  |  HP: ${Math.ceil(run.hp)}. Pick ONE.`;
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
      state = "playing"; // game continues
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

// ===== LEGEND (built from the lists at the top, so it is always up to date) =====
function buildLegend() {
  const row = (emoji, name, desc) =>
    `<div class="legend-row"><span class="icon">${emoji}</span><span><b>${name}</b> - ${desc}</span></div>`;
  const group = (title, rows) => `<div class="legend-group"><h3>${title}</h3>${rows.join("")}</div>`;

  const items = ITEMS.map((i) => row(i.emoji, i.name, i.money ? `+${fmt(i.money)} money` : `+${i.hp} HP`));
  const kills = HAZARDS.filter((h) => h.kill).map((h) => row(h.emoji, h.name, h.desc));
  const habits = HAZARDS.filter((h) => h.habit).map((h) => row(h.emoji, h.name, h.desc));
  const traps = HAZARDS.filter((h) => h.trap).map((h) => row(h.emoji, h.name, h.desc));
  const status = [
    row("🏢", "Company", "you own a company (money pickups x2)"),
    row("🏖️", "Retired", "no money traps, health x2, money x0.5"),
  ];

  $("legendBody").innerHTML =
    group("✅ Collect these", items) +
    group("☠️ Instant death (falling)", kills) +
    group("🚬 Bad habits (falling)", habits) +
    group("💸 Money traps (falling)", traps) +
    group("Status icons (top of the screen)", status);
}

// ===== UI =====
function choiceCountdown() {
  const nextAge = (Math.floor(run.age / 10) + 1) * 10;
  const frames = (nextAge - run.age - 1) * YEAR_FRAMES + (YEAR_FRAMES - run.yearTimer);
  const s = Math.ceil(frames / 60);
  return `Next choice: age ${nextAge} (in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`;
}

function updateUI() {
  $("age").textContent = Math.floor(run.age);
  $("coins").textContent = fmt(run.money);
  $("coins").classList.toggle("negative", run.money < 0);
  $("luck").textContent = luck().toFixed(2);
  $("rebirths").textContent = save.rebirths;
  $("nextchoice").textContent = choiceCountdown();

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
  if (state !== "playing") return; // paused during the choice popup, stopped after death

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

  // collect pickups
  pickups = pickups.filter((p) => {
    if (Math.abs(wrapDist(player.x, p.x)) < pickupRange() && Math.abs(bodyY - (p.y - 20)) < pickupRange() + 6) {
      collectPickup(p);
      return false;
    }
    return true;
  });
  while (pickups.length < MAX_SPAWNS) spawnPickup();

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
    hazardTimer = Math.max(45, 150 - (run.age - START_AGE) * ramp - save.rebirths * 4);
  }
  hazards = hazards.filter((h) => {
    if (h.warn > 0) { h.warn--; return true; }
    const prev = h.y;
    h.y += h.vy;
    if (h.y >= GROUND_Y) return false;
    for (const p of platforms) { // platforms protect you from anything falling
      if (Math.abs(wrapDist(h.x, p.x + p.w / 2)) < p.w / 2 && prev < p.y && h.y >= p.y) return false;
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

  // warnings: a red line and a warning sign where something is about to fall
  for (const h of hazards) {
    if (h.warn > 0) {
      ctx.strokeStyle = "rgba(255,80,80,0.35)";
      ctx.beginPath(); ctx.moveTo(sx(h.x), 0); ctx.lineTo(sx(h.x), GROUND_Y); ctx.stroke();
      ctx.font = "22px serif";
      ctx.fillText("⚠️", sx(h.x), 20);
      ctx.font = "18px serif";
      ctx.fillText(h.def.emoji, sx(h.x), 46); // small preview of what is coming
    }
  }

  ctx.font = "32px serif";
  pickups.forEach((p) => ctx.fillText(p.item.emoji, sx(p.x), p.y - 20));
  ctx.font = "36px serif";
  relics.forEach((r) => ctx.fillText(r.emoji, sx(r.x), r.y - 22));

  // falling dangers
  for (const h of hazards) {
    if (h.warn <= 0) {
      ctx.font = h.def.id === "rock" ? `${Math.round(h.r * 2)}px serif` : "36px serif";
      ctx.fillText(h.def.emoji, sx(h.x), h.y);
    }
  }

  ctx.font = "40px serif";
  ctx.fillText(state === "dead" ? "🪦" : "🧍", CX, player.y - 20);
}

function loop() {
  update();
  draw();
  if (++tick % 6 === 0) updateUI(); // keeps the HP bar and timer moving
  requestAnimationFrame(loop);
}

// ===== START =====
loadGame();
save.found = save.found.filter((id) => RELICS.some((r) => r.id === id)); // ignore old save data
newRun();
resetWorld();
buildLegend();
$("menuBtn").addEventListener("click", () => { location.href = "index.html"; });
showToast(mode === "game" ? "Collect 💰 and ❤️. Dodge everything that falls!" : "Endless mode: survive as long as you can!");
updateUI();
loop();
setInterval(saveGame, 5000);
