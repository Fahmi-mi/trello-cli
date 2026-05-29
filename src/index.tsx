#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import App from "./app.js";
import { setCredentials } from "./api.js";

// Load .env from home dir or current dir
const homeEnv = path.join(os.homedir(), ".trello-cli.env");
if (fs.existsSync(homeEnv)) {
  dotenv.config({ path: homeEnv });
} else {
  dotenv.config();
}

const KEY = process.env.TRELLO_API_KEY;
const TOKEN = process.env.TRELLO_TOKEN;

if (!KEY || !TOKEN) {
  console.error("\nTRELLO_API_KEY dan TRELLO_TOKEN belum diset.\n");
  console.error("Buat file .env (atau ~/.trello-cli.env) berisi:");
  console.error("  TRELLO_API_KEY=your_key_here");
  console.error("  TRELLO_TOKEN=your_token_here\n");
  console.error("Dapatkan key & token di: https://trello.com/app-key\n");
  process.exit(1);
}

setCredentials(KEY, TOKEN);

const { waitUntilExit } = render(<App />, { exitOnCtrlC: true });
waitUntilExit().then(() => {
  process.exit(0);
});
