# Inspectie: scenario-bronnen (geen bouw)

**Scope van deze ronde:** alleen lezen. Geen editor, geen JSON-bestanden, geen herschrijven van Verpleegkunde, geen wijziging aan de simulator.

Later doel (niet nu): los programma `HoloboxScenarioEditor` dat Logopedie- en Verpleegkunde-scenario’s bewerkt zonder Grok Build. De huidige app moet dan met een fallback blijven werken.

---

## 1. Logopedie – vragen en antwoorden

**Bron (compile-time, geen JSON):** `src/data/aphasiaIntakeScenario.ts`  
Type: `Scenario` in `src/domain/types.ts`  
Id: `aphasia-intake-erik-de-vries` v1.0.0

Er is **geen** runtime-JSON. De app importeert het object overal statisch (`AppState`, simulatie, briefing, conclusie, tests). Boot faalt als `assertValidScenario` in `src/domain/scenarioValidation.ts` klaagt (`src/state/AppState.tsx`).

| Onderdeel | Veld | Inhoud |
|---|---|---|
| Cliënt spreekt | `nodes[].prompt.text` + `.context` | Wat Erik zegt / wat zichtbaar is |
| Studentvraag | `nodes[].options[].text` | Precies 3 opties: `high` / `partial` / `inappropriate` |
| “Antwoord” van Erik | `options[].clientResponse` | Reactie na de keuze |
| Feedback | `delayedFeedback` + `educationalRationale` | Na de keuze, niet op het knopje |
| Volgende stap | `options[].nextNodeId` | Andere node of `"conclusion"` |
| Conclusie | `conclusionFields[]` | 5 meerkeuzevelden; vrije tekst telt **niet** mee |

8 nodes, visuele volgorde per node bewust wisselend (beste antwoord niet altijd eerste):

1. `d1-greeting` – begroeting  
2. `d2-concern` – hulpvraag  
3. `d3-language` – taal  
4. `d4-home` – thuis  
5. `d5-participation` – participatie  
6. `d6-wordfinding` – woordvinden  
7. `d7-fatigue` – vermoeidheid  
8. `d8-summary` – samenvatting → conclusie

Conclusievelden: `primaryDifficulty`, `dailyLifeEffect`, `clientStrengths`, `firstObjective`, `nextStep`.  
Twee vrije teksten (`dailyLifeEffect`, `firstObjective`) zijn verplicht, max 280 tekens, **niet gescoord**.

Avatar (geen vragen): stills in `resources/logopedie/avatar/` en `.../generated/erik/*.png`, mapping in `src/media/logopedie/resolveAvatar.ts`. Fallback: SVG `FullBodyErik`. Geen automatische zoom.

Authoring-docs: `docs/scenario-authoring.md` (kopieer TS, geen JSON).

---

## 2. Verpleegkunde – vragen en media

**Vragen (compile-time):** `src/nursing/scenario.ts`  
Types: `src/nursing/types.ts`  
Id: `abcde-sbar-sara-meijer` (constante in `src/media/scenarioMedia.ts`; patiënt heet nu meneer de Vries) v1.0.1

10 lineaire stappen in `nursingSteps`. Alle opties van één stap gaan naar **dezelfde** `nextStepId` (geen takken). Type `kind: 'sbar-text'` bestaat, maar **alle stappen zijn `choice`**. SBAR-tekst wordt gekopieerd uit de gekozen optie (`nursingReducer`).

| Stap | Id | Vraag | Standaard-video-slot |
|---|---|---|---|
| A | `n-a` | Eerste actie luchtweg | `nursing-airway` |
| B | `n-b` | Ademhaling | `nursing-breathing` |
| C | `n-c` | Circulatie | `nursing-circulation` |
| D | `n-d` | Bewustzijn | `nursing-disability` |
| E | `n-e` | Huid/omgeving | `nursing-exposure` |
| S | `n-sbar-s` | Situation | `nursing-breathing` |
| B | `n-sbar-b` | Background | `nursing-exposure` |
| A | `n-sbar-a` | Assessment | `nursing-circulation` |
| R | `n-sbar-r` | Recommendation | `nursing-airway` |
| Check | `n-sbar-check` | Controle | `nursing-disability` |

Sommige **opties** overschrijven de video via `option.mediaSlotId` (B-high → zuurstof, B-partial → hyperventilatie, E-high → koorts). Scherm: na een keuze blijft die optie-video staan tot de volgende keuze (`NursingSimulationScreen`).

**Video’s (losse bestanden, namen niet hernoemen):** `resources/verpleegkunde/*.mp4` (9 stuks, spaties en en-streepje).  
**Slot-koppeling:** `src/media/scenarioMedia.ts` (`mediaSlots` + exacte `primaryMedia`-paden).  
Docent kan per slot overriden: `teacher.mediaOverrides` in localStorage.

Er is **geen** nursing-equivalent van `validateScenario`. Tests eisen 10 stappen en 100/0 op high/inappropriate (`src/nursing/scoring.test.ts`).

---

## 3. Scoring / “juist antwoord”

Er is geen aparte antwoord-sleutel. Het juiste pad is de optie met `quality: 'high'`. Het **cijfer** komt uit `competencyAwards` (0 / 0.5 / 1) op die optie, niet uit `quality` zelf.

**Logopedie** (`src/domain/scoring.ts`):

- Noemer per competentie = aantal nodes/conclusievelden waar die competentie in `scoredCompetencies` staat (max 1 punt per beslissing).
- Teller = som van `competencyAwards` uit `history`.
- Vroeg stoppen: onbeantwoorde punten blijven in de noemer (0 verdiend).
- Gewichten (som 1.0): communicatie 30%, anamnese/doelen 25%, observatie 15%, redeneren 15%, empathie 15%.
- Totaal = `round(som(percent × gewicht))`, 0–100.
- Vrije tekst nooit in de score.

**Verpleegkunde** (`src/nursing/scoring.ts`): zelfde formule, andere gewichten. `nursingMaximum()` loopt **hard** over de geïmporteerde `nursingSteps` (niet als argument). Gewichten: ABCDE 30%, observatie 20%, veiligheid 20%, SBAR 20%, professioneel 10%. `unsafe` + `criticalError` gaan naar `criticalErrors`; ze verlagen de score alleen via awards 0.

Beide reducers kopiëren awards van de gekozen optie naar `history`. UI toont geen groen vinkje; kwaliteit zit in resultaat/feedback.

---

## 4. Media-manifest

**Generator:** `scripts/generate-media-manifest.mjs` (`npm run media:manifest`, ook vóór `dev`/`build`).  
**Output:** `src/media/generated/media-manifest.ts` (gegenereerde TS, niet met de hand).

Loopt `resources/`, houdt alleen `logopedie/` en `verpleegkunde/`, images + video. Per bestand: pad, module, keywords uit de bestandsnaam, mp4-duur, `publicUrl` = `/resources/...` (URL-encoded).

**Runtime:** `src/media/matching.ts`

1. Docent-override (`relativePath` in manifest)  
2. Anders `slot.primaryMedia` (exact pad)  
3. Anders keyword-score op de catalogus  

Logopedie-stills gebruiken het manifest voor `?v=sizeBytes` cache-bust. Verpleegkunde speelt `media.publicUrl` af in `PatientStage`. Ontbrekend bestand → geen video, geen crash.

Manifest **niet** de bron van vragen. Alleen inventaris van schijfbestanden.

---

## 5. Hoe de exe bestanden laadt (src vs dist vs resources)

De exe is **geen** ingepakte web-app. `HoloboxZorgsimulator.exe` (`tools/HoloboxLauncher.cs`, `build-launcher.bat`) is een C#-starter:

1. Werkmap = map van de exe (projectroot).  
2. Als `dist/index.html` ontbreekt → `npm run build`.  
3. `npm run preview` (Vite, poort 4173).  
4. Edge/Chrome kiosk naar `http://127.0.0.1:4173`.  
5. Bij sluiten: server + poort 4173 killen.

`start-holobox.bat` doet hetzelfde zonder exe.

| Laag | Wat | Wanneer gelezen |
|---|---|---|
| `src/**/*.ts(x)` | Scenario’s, scoring, UI | Alleen bij **build**. In de bundle `dist/assets/*.js`. Runtime leest `src/` niet. |
| `resources/` | PNG + MP4 | Dev/preview: Vite-plugin serveert `/resources` **live** uit deze map. Build kopieert naar `dist/resources/`. |
| `dist/` | `index.html` + JS/CSS + kopie resources | Productie-output. Exe start preview hiervan. |
| Vite `base` | `/HoloboxVPKenLogo/` | `withBaseUrl` zet `/resources/...` om naar `/HoloboxVPKenLogo/resources/...`. |
| localStorage | sessies, resultaten, docent | Sleutel `holobox-zorgsimulator-v2`, schema 2. Geen scenario-inhoud. |

Gevolg: vragen wijzigen = TS wijzigen + **rebuild**. Bestaande video vervangen onder **dezelfde bestandsnaam** in `resources/` is zichtbaar in preview zonder rebuild (live middleware). Nieuwe bestanden of nieuwe paden vragen `media:manifest` + rebuild, omdat `primaryMedia` en het manifest in de JS-bundle zitten.

`docs/assumptions.md` is deels verouderd (`resources/logopedie/` is niet meer leeg).

---

## 6. Veiligste JSON-structuur (huidige app blijft werken)

**Niet doen:** TS-scenario’s weggooien of vervangen door “JSON is verplicht”. Dan start de huidige app niet meer zonder nieuwe bestanden.

**Wel (later, als de simulator JSON gaat lezen):** optionele overlay + **ingebouwde TS als fallback**.

Aanbevolen vorm: **twee JSON-bestanden, 1-op-1 de bestaande TypeScript-types**, plus een dun envelopje. Geen gemeenschappelijke “generic scenario engine” (Logopedie vertakt, Verpleegkunde is lineair ABCDE+SBAR).

Voorgestelde paden (pas laden als de app dat later ondersteunt):

- `resources/scenarios/logopedie.json`
- `resources/scenarios/verpleegkunde.json`

Waarom onder `resources/`: zelfde live-serve als media; exe/preview vindt ze zonder extra kopieerlogica; editor kan ernaast schrijven.

### Logopedie-envelope

```json
{
  "schemaVersion": 1,
  "module": "logopedie",
  "scenario": { /* exact Scenario uit src/domain/types.ts */ }
}
```

`scenario` = huidige `aphasiaIntakeScenario` (id, version, client, briefing, learningObjectives, startNodeId, nodes, conclusionFields). Awards, `quality`, `nextNodeId`, emoties en flags blijven **op de optie**.

### Verpleegkunde-envelope

```json
{
  "schemaVersion": 1,
  "module": "verpleegkunde",
  "meta": { "id": "...", "version": "...", "rubricVersion": "...", "title": "...", "estimatedDuration": "...", "startStepId": "n-a" },
  "patient": { /* nursingPatient */ },
  "learningObjectives": [ "..." ],
  "steps": [ /* NursingStep[] */ ],
  "mediaSlots": [ /* MediaSlotConfig[] */ ]
}
```

`steps` = huidige `nursingSteps`. `mediaSlots` = huidige `mediaSlots`. Video blijft een **relatief pad** naar een bestand in `resources/verpleegkunde/`, geen blob in JSON.

### Fallback-regel (als de app later JSON leest)

1. Probeer JSON (fetch van `/resources/scenarios/...`).  
2. Parse + `schemaVersion === 1` + `module` klopt.  
3. Logopedie: bestaande `validateScenario`. Verpleegkunde: lichte check (10 stappen, 3 qualities, bekende `nextStepId`, slot bestaat) — **niet** de reducer/scoring herschrijven.  
4. Bij missend bestand, parsefout of validatiefout → huidige TS-constanten. Identiek gedrag als nu.  
5. Scoring: Logopedie krijgt het geladen `scenario` al als argument. Verpleegkunde-scoring moet dan `steps` als argument krijgen i.p.v. hardcoded import; default = `nursingSteps`. Kleine, backward-compatible signatuur, geen nieuwe formule.

### Wat de editor later mag / niet mag

| Mag | Niet |
|---|---|
| Teksten, awards, volgorde, `nextNodeId` / `nextStepId` | Bestandsnamen van bestaande mp4’s forceren te hernoemen |
| Nieuw scenario als extra JSON + nieuwe id | Eén schema voor beide modules forceren |
| Media-paden kiezen uit het manifest | Scoring in React-componenten stoppen |
| `version` / `rubricVersion` ophogen | `src/` van de simulator overschrijven als enige bron |

Eerste editor-versie kan read-only de TS/JSON-vorm tonen. Schrijven pas als de simulator de overlay + fallback heeft.

---

## Deze ronde

Geen code, geen JSON, geen editor, geen Verpleegkunde-logica wijzigen. Dit document is de kaart voor een later, apart programma.
