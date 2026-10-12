# Atlas Coach – private client page

A code-gated page that loads each client's own Chatbase agent. Static files only, so it runs on GitHub Pages with no server.

## Files

```
my-coach/
  index.html     Gate screen + chat screen
  style.css      Dark / gold Atlas styling
  app.js         Code check, decryption, iframe loading
  clients.json   Encrypted client list (starts empty)
tools/
  add-client.html   Admin tool – generates codes, adds/removes clients
```

Put `my-coach/` in the root of your site repo so it lives at `yoursite.com/my-coach/`.
Keep `tools/` on your own computer (it holds no secrets, but there's no reason to publish it).

## How the security works

- Each access code (e.g. `ATLAS-K7PM-3XQD-9RWT`) is turned into an encryption key in the browser.
- `clients.json` only stores encrypted entries. Without a valid code, nobody can see client names or which Chatbase agent belongs to whom.
- Codes are random with ~59 bits of strength, so guessing isn't realistic.

**Be aware of the limits.** Once a client is logged in, their agent ID is visible in the browser's developer tools. Someone determined could use that ID directly on chatbase.co. That's why cancelling someone is a two-step job (see below). This is fine for phase one; a proper login system comes with the app version.

## Setting up the first client

1. **In Chatbase:** create the agent, upload the client's PDF, paste in the Coach Amer system prompt, and test it.
2. **Match the look:** in the agent's chat interface settings, set a dark theme and gold (#C9A24A) accent so it blends with the page.
3. **Lock the domain:** in the agent's security settings, restrict it to your website's domain if the option is there. This blocks the agent being embedded anywhere else.
4. **Get the agent ID:** Deploy → Embed → Iframe. The ID is the part after `/chatbot-iframe/` in the URL.
5. **Open `tools/add-client.html`** in Chrome (double-click it).
   - Paste in your current `clients.json` (blank for the first client).
   - Enter name + agent ID, click Generate, then Add client.
   - Write the code into your spreadsheet: Client | Code | Agent ID | Status.
   - Copy the output from section 4.
6. **On GitHub:** open `my-coach/clients.json`, paste the new contents, commit. Allow 1–2 minutes for GitHub Pages to update.
7. **Send the client** the link and their code.

## Cancelling a client

1. Open the admin tool, paste the current `clients.json`, enter their code under **Remove**, then commit the new file.
2. **Pause or delete their Chatbase agent.** This is the real off switch – it also stops the $25/month for that agent.

Anyone who stayed logged in will be signed out with an "access has ended" message next time they open the page.

## Testing locally

The encryption only runs on HTTPS or localhost, so opening `index.html` straight from your folder won't work. Run this from inside the folder that contains `my-coach/`:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/my-coach/`.

## Don't change

`APP_SALT` and `ITERATIONS` must be identical in `app.js` and `add-client.html`. Changing either one breaks every code you've issued.
