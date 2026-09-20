#!/usr/bin/env node
/**
 * Generates the CSV files of the Helios baseline data workspace.
 *
 * The data is deterministic: the same seed always produces the same records, so
 * two learners on two continents see the same numbers in the same screenshots.
 * Run it from the repository root:
 *
 *     node scripts/build/data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "scripts", "data", "HeliosBaseline");

// A tiny deterministic generator, so no dependency and no surprise.
let seed = 20260916;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));

/**
 * Hands out the values of a list without repeating one until every value has
 * been used, then starts again on a fresh shuffle.
 *
 * pick() draws with replacement, which on a pool of ninety names gives the same
 * dozen people over and over while most of the list is never seen. The contacts
 * are the one place where that shows: they are the cast of the sample data, and
 * a learner scrolling a list of sixty wants sixty different people in it.
 */
// A stream of its own for the name shuffles. A shuffle draws as many values as
// the list is long, so sharing the stream would move every account, opportunity
// and installation the day somebody adds a name, and with them the screenshots
// that were taken against them.
let nameSeed = 20260917;
function nameRand() {
  nameSeed = (nameSeed * 1103515245 + 12345) % 2147483648;
  return nameSeed / 2147483648;
}

const nameBetween = (min, max) => min + Math.floor(nameRand() * (max - min + 1));

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nameRand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawer(list) {
  let bag = [];
  return () => {
    if (bag.length === 0) {
      bag = shuffled(list);
    }
    return bag.pop();
  };
}

const CITIES = [
  ["Sevilla", "Spain"], ["Malaga", "Spain"], ["Valencia", "Spain"],
  ["Lisboa", "Portugal"], ["Faro", "Portugal"],
  ["Marseille", "France"], ["Montpellier", "France"], ["Perpignan", "France"],
  ["Palermo", "Italy"], ["Bari", "Italy"], ["Cagliari", "Italy"],
  ["Athina", "Greece"], ["Thessaloniki", "Greece"]
];
const FIRST = ["Nicolas", "Mariia", "Romain", "Sébastien", "Manon", "Eugénie", "Violaine", "Victor",
  "Gregory", "Emile", "Virginie", "Julie", "Olivier", "Andrzej", "Dimitri", "Baptiste", "Florian",
  "Bertrand", "Yamilet", "Pablo", "Olga", "Ziyi", "Quentin", "Nabil", "Come", "Teoman", "Ekaterina",
  "Louise", "Fabien", "Volodimir", "Matt", "Alexandra", "Aurore", "Sophie", "Natalia", "Krzysztof",
  "Frederic", "Jasmin", "Przemek", "Marine", "Ernest", "Suzanne", "Eglantine", "Daphné", "Louison",
  "Anne-Laure", "Chris", "Léon", "Diego", "Pamela", "Maurice", "Erna", "Madelyne", "Antoine", "Antonin",
  "Tien", "Michele", "Roman", "Leo", "Matheus", "Taha", "Anush", "Sebastien", "Stepan", "Shamina",
  "Michael", "Fernando", "Shinnosuke", "Dagmara", "Salik", "Ryad", "Nicholas", "Timo", "Pranay", "Maciej",
  "Eric", "Maxime", "Meric", "Brahim", "Yan", "Maksym", "Manoel", "Thomas", "Juliano", "Alain", "Theodoor",
  "Kris", "Clément", "Mathieu", "Fabian"];
const LAST = ["Pyvovarchuk", "Turpin", "Lacour", "Vignaud", "Poirot", "Rames", "Reviriot", "Lagoutte",
  "Pellichero", "Bazoin", "Louis", "Chevalier", "Verbeke", "Lenotre", "Chodor", "Monge", "Masson",
  "Regnier", "Vuillamy", "Zhou", "Chanroux", "Tiercelin", "Boudjellal", "Lockie", "Ratko", "Pieper",
  "Levet", "Todorova", "Lesiz", "Obermeier", "Lasek", "Leroy", "Nomblot", "Catelin", "Nguyen", "Metery",
  "Zaversnik", "Geoffroy", "Krol", "Hentschke", "Jokinen", "Delazeri", "Basri", "Poudel", "Colladon",
  "Stepanov", "Mossodeean", "Havrilla", "Sertcelik", "Fernandez", "Oliva", "Takakura", "Ryborz", "Carvin",
  "Pedersen", "Meguimi", "Fiorendi", "Pouw", "Jaiswal", "Ptak", "Mulder", "Guenego", "Asaner", "Laissaoui",
  "Imensar", "Petrov", "Calixto", "Prouvot", "Machado", "Bates", "van Donge", "Goncalves", "Rodrigues",
  "Kramer", "Heinschke"];
// Names are drawn at random: never pair them back into a real person's name, nor into a
// member of the team the labs talk about
const TAKEN = new Set(["Nicolas Vuillamy", "Mariia Pyvovarchuk"]);
// An email address takes no accent, and no space: a surname in two words,
// "van Donge", would otherwise make a local part Salesforce refuses.
//
// The domain is one that does not exist, so a flow or a batch that mails a
// contact of the sample data cannot reach anybody. Lab 2.4 turns Email
// Deliverability to All Email in every org, so that matters here.
const ascii = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const SUFFIX = ["Rooftops", "Energy Coop", "Residences", "Homes", "Estates", "Properties",
  "Solar Club", "Housing", "Villas", "Terraces"];
const ROOFS = ["Tile", "Slate", "Flat", "Metal"];
const STATUSES = ["Planned", "Scheduled", "In Progress", "Completed"];

function csv(rows) {
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n") + "\n";
}

function isoDate(offsetDays) {
  const d = new Date(Date.UTC(2026, 0, 15));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- Accounts
const accounts = [];
for (let i = 1; i <= 40; i++) {
  const [city, country] = pick(CITIES);
  accounts.push({
    Name: `${city} ${pick(SUFFIX)} ${String(i).padStart(2, "0")}`,
    Type: pick(["Customer - Direct", "Customer - Channel", "Prospect"]),
    Industry: pick(["Energy", "Construction", "Real Estate"]),
    BillingCity: city,
    BillingCountry: country,
    Phone: `+34 9${between(10, 99)} ${between(100, 999)} ${between(100, 999)}`,
    Description: "Seeded by the sfdx-hardis training. Not a real customer."
  });
}

// ---------------------------------------------------------------- Contacts
// As many contacts as the longest name list, so every name in the pool is used
// and a learner scrolling the list meets ninety different people.
const CONTACT_COUNT = FIRST.length;

/**
 * Everything generated after this loop was fixed when the contacts drew six
 * values each from the shared stream, for sixty of them. The contacts draw from
 * their own stream now, so the reservation below stands in for what they used
 * to take: the accounts, opportunities, installations and batches keep the
 * values the screenshots and the labs were written against, however many
 * contacts the course decides to seed.
 */
const SHARED_STREAM_RESERVATION = 60 * 6;

const nextFirst = drawer(FIRST);
const nextLast = drawer(LAST);
const nextTitle = drawer(["Owner", "Building manager", "Technical contact", "Co-owner"]);
const contacts = [];
for (let i = 1; i <= CONTACT_COUNT; i++) {
  const account = accounts[i % accounts.length];
  const first = nextFirst();
  let last = nextLast();
  // A seeded contact is never one of the people the labs talk about
  let guard = 0;
  while (TAKEN.has(`${first} ${last}`) && guard++ < LAST.length) {
    last = nextLast();
  }
  contacts.push({
    FirstName: first,
    LastName: last,
    Email: `${ascii(first)}.${ascii(last)}.${String(i).padStart(2, "0")}@helios-training.demo`,
    Title: nextTitle(),
    Phone: `+34 6${nameBetween(10, 99)} ${nameBetween(100, 999)} ${nameBetween(100, 999)}`,
    "Account.Name": account.Name
  });
}
for (let i = 0; i < SHARED_STREAM_RESERVATION; i++) {
  rand();
}

// ----------------------------------------------------------- Opportunities
const opportunities = [];
for (let i = 1; i <= 25; i++) {
  const account = accounts[(i * 3) % accounts.length];
  opportunities.push({
    Name: `${account.Name} - Rooftop array ${String(i).padStart(2, "0")}`,
    StageName: pick(["Prospecting", "Proposal/Price Quote", "Negotiation/Review", "Closed Won"]),
    CloseDate: isoDate(between(-60, 120)),
    Amount: between(8, 95) * 1000,
    Type: "New Customer",
    "Account.Name": account.Name
  });
}

// ----------------------------------------------------------- Installations
// Crew_Size__c is deliberately left empty on every record: Lab 2.3 is
// built on "you cannot make a field required when the data does not have it".
const installations = [];
for (let i = 1; i <= 30; i++) {
  const account = accounts[(i * 5) % accounts.length];
  const status = i <= 8 ? "Completed" : i <= 12 ? "In Progress" : i <= 20 ? "Scheduled" : "Planned";
  installations.push({
    External_Id__c: `HEL-INST-${String(i).padStart(3, "0")}`,
    "Account__r.Name": account.Name,
    Status__c: status,
    Install_Date__c: isoDate(status === "Completed" ? between(-120, -20) : between(5, 90)),
    Roof_Type__c: pick(ROOFS),
    Crew_Size__c: "",
    Total_Capacity_kW__c: (between(30, 140) / 10).toFixed(2)
  });
}

// ----------------------------------------------------------- Panel batches
const panelBatches = [];
let batchNo = 0;
for (const inst of installations) {
  const count = between(2, 3);
  for (let b = 0; b < count && panelBatches.length < 80; b++) {
    batchNo++;
    panelBatches.push({
      External_Id__c: `HEL-BATCH-${String(batchNo).padStart(3, "0")}`,
      "Installation__r.External_Id__c": inst.External_Id__c,
      Quantity__c: between(8, 32),
      Arrival_Date__c: isoDate(between(-90, 60)),
      Serial_Prefix__c: `HS${between(2024, 2026)}-${String(between(1, 99)).padStart(2, "0")}`,
      Cost__c: (between(900, 4800)).toFixed(2)
    });
  }
}
while (panelBatches.length < 80) {
  batchNo++;
  const inst = installations[panelBatches.length % installations.length];
  panelBatches.push({
    External_Id__c: `HEL-BATCH-${String(batchNo).padStart(3, "0")}`,
    "Installation__r.External_Id__c": inst.External_Id__c,
    Quantity__c: between(8, 32),
    Arrival_Date__c: isoDate(between(-90, 60)),
    Serial_Prefix__c: `HS${between(2024, 2026)}-${String(between(1, 99)).padStart(2, "0")}`,
    Cost__c: (between(900, 4800)).toFixed(2)
  });
}

fs.mkdirSync(OUT, { recursive: true });
const files = {
  "Account.csv": accounts,
  "Contact.csv": contacts,
  "Opportunity.csv": opportunities,
  "Installation__c.csv": installations,
  "Panel_Batch__c.csv": panelBatches
};
for (const [name, rows] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), csv(rows), "utf8");
  console.log(`${name}: ${rows.length} records`);
}
console.log(`Written to ${path.relative(ROOT, OUT)}`);
