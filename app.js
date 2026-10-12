/*
 * Atlas Strength Club – private coach gate
 *
 * How it works:
 *   - clients.json holds one encrypted entry per client.
 *   - The access code is stretched with PBKDF2 into (a) an AES key and (b) a lookup ID.
 *   - The lookup ID finds the client's entry; the AES key decrypts their name + Chatbase agent ID.
 *   - Without a valid code, nobody can read which agent belongs to whom.
 *
 * Keep APP_SALT and ITERATIONS identical to tools/add-client.html.
 * Changing either one invalidates every existing code.
 */

const APP_SALT = "atlas-strength-club/my-coach/v1";
const ITERATIONS = 250000;
const STORAGE_KEY = "atlas_coach_code";
const CHATBASE_IFRAME = "https://www.chatbase.co/chatbot-iframe/";

const el = (id) => document.getElementById(id);
const gate = el("gate");
const coach = el("coach");
const form = el("gate-form");
const input = el("code");
const remember = el("remember");
const button = el("enter");
const msg = el("gate-msg");
const frame = el("coach-frame");
const greeting = el("greeting");

/* ---------- Helpers ---------- */

function normaliseCode(raw) {
  let c = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.startsWith("ATLAS")) c = c.slice(5);
  return c;
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const store = {
  get() { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } },
};

async function deriveKeys(code) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(APP_SALT), iterations: ITERATIONS },
    base,
    512
  ));
  const aesKey = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["decrypt"]);
  const lookup = toHex(bits.slice(32, 48));
  return { aesKey, lookup };
}

async function loadClients() {
  const res = await fetch("clients.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load client list");
  const data = await res.json();
  return data.clients || {};
}

async function unlock(code) {
  const [clients, keys] = await Promise.all([loadClients(), deriveKeys(code)]);
  const entry = clients[keys.lookup];
  if (!entry) return null;

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(entry.iv) },
    keys.aesKey,
    fromB64(entry.data)
  );
  return JSON.parse(new TextDecoder().decode(plain)); // { name, agentId }
}

/* ---------- Views ---------- */

function showCoach(client) {
  const first = (client.name || "").trim().split(/\s+/)[0];
  if (greeting) greeting.textContent = first ? `Hi, ${first}` : "";
  frame.src = CHATBASE_IFRAME + encodeURIComponent(client.agentId);
  gate.hidden = true;
  coach.hidden = false;
  document.title = "Your Coach · Atlas Strength Club";
}

function showGate(message = "", isError = true) {
  frame.src = "about:blank";
  coach.hidden = true;
  gate.hidden = false;
  msg.textContent = message;
  msg.classList.toggle("msg--ok", !isError);
  input.value = "";
  input.removeAttribute("aria-invalid");
}

function setBusy(busy) {
  button.disabled = busy;
  input.disabled = busy;
  button.textContent = busy ? "Checking…" : "Enter";
}

/* ---------- Events ---------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = normaliseCode(input.value);

  if (code.length < 8) {
    msg.textContent = "Please enter your full access code.";
    input.setAttribute("aria-invalid", "true");
    return;
  }

  setBusy(true);
  msg.textContent = "";
  try {
    const client = await unlock(code);
    if (!client) {
      // Small pause so repeated guessing is tedious
      await new Promise((r) => setTimeout(r, 900));
      msg.textContent = "That code isn't active. Check it and try again.";
      input.setAttribute("aria-invalid", "true");
      return;
    }
    if (remember.checked) store.set(code); else store.clear();
    showCoach(client);
  } catch (err) {
    console.error(err);
    msg.textContent = "Something went wrong. Please try again shortly.";
  } finally {
    setBusy(false);
  }
});

input.addEventListener("input", () => {
  input.removeAttribute("aria-invalid");
  msg.textContent = "";
});

el("logout").addEventListener("click", () => {
  store.clear();
  showGate("You've been logged out.", false);
});

/* ---------- Auto sign-in ---------- */

(async function init() {
  const saved = store.get();
  if (!saved) return;
  setBusy(true);
  try {
    const client = await unlock(saved);
    if (client) showCoach(client);
    else {
      store.clear();
      showGate("Your access has ended. Speak to the team if this is a mistake.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    setBusy(false);
  }
})();
