# Holobox Zorgsimulator

Versie **0.2.4**

Educatieve Holobox-app met twee modules:

- **Logopedie** – intake met Erik de Vries, fictieve cliënt met afasie na een beroerte
- **Verpleegkunde** – ABCDE en SBAR met meneer de Vries, fictieve patiënt met acute benauwdheid

Dit is een trainingssimulatie. Het is geen diagnostisch instrument en geen vervanging van professionele zorg. Vul geen echte patiëntgegevens in.

## Productdoel

Studenten oefenen rapport, aangepaste taal, antwoordtijd, hulpvraag, participatie, omgaan met frustratie en vermoeidheid, onderscheid tussen observatie en aanname, en een voorlopige conclusie.

## Weergave (Holobox)

- Staand beeld: **1080 × 1920** pixels (9:16)
- Achtergrond altijd **`#FFFFFF`**
- Geen dark mode, geen systeemthema, geen gekleurde of transparante pagina-achtergrond
- Primair: touch; ook muis en toetsenbord
- Doelbrowser: Chromium, fullscreen of kiosk

Op kleinere schermen schaalt de hele compositie evenredig. De layout draait niet naar landscape.

## Compatibility and versions

Verified in this build environment:

| Onderdeel                | Versie                  |
| ------------------------ | ----------------------- |
| Application              | 0.2.4                   |
| Node.js                  | 24.20.0                 |
| npm                      | 11.19.0                 |
| React                    | 19.3.0                  |
| TypeScript               | 5.9.3                   |
| Vite                     | 7.3.6                   |
| Vitest                   | 4.1.11                  |
| Playwright               | 1.63.0                  |
| ESLint                   | 9.39.5                  |
| Prettier                 | 3.9.6                   |
| Chromium (Playwright)    | 153.0.8010.12           |
| OS used for verification | Windows 11 (10.0.26200) |
| Host Chrome              | 152.0.7977.84           |
| Host Edge                | 153.0.4234.32           |

Directe dependencies zijn exact gepind. Geen `^`, `~`, `*` of `latest`.

ESLint 9.39.5 is gekozen omdat `eslint-plugin-jsx-a11y@6.10.2` nog geen ESLint 10 peer toestaat. TypeScript 5.9.3 is gekozen omdat `typescript-eslint@8.70.0` TypeScript 7 niet ondersteunt.

## Installatie

```bash
npm ci
npx playwright install chromium
```

Gebruik `npm ci` vanaf de lockfile. Node 24.20.0 is vastgelegd in `.nvmrc` en `package.json#engines`.

## Commands

```bash
npm run media:manifest
npm run dev
npm run build
npm run preview
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:unit
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run verify
```

`verify` draait format-check, lint, typecheck, unit/component tests en de production build. End-to-end tests staan apart omdat ze een Chromium-browser en een preview-server nodig hebben.

`test:e2e` bouwt eerst de production build en start daarna Playwright tegen `vite preview` op poort 4173, viewport **1080 × 1920**.

## Kiosk / fullscreen

1. `npm run build`
2. `npm run preview`
3. Open `http://127.0.0.1:4173` in Chromium
4. F11 of kiosk-vlag, bijvoorbeeld:

```text
msedge.exe --kiosk http://127.0.0.1:4173 --edge-kiosk-type=fullscreen
```

Serveer de app; open het bestand niet als `file://`.

## Modules en media

Bronmedia staan in `resources/logopedie/` en `resources/verpleegkunde/` en worden niet hernoemd. Het script `npm run media:manifest` inventariseert aanwezige bestanden. Verpleegkundevideo’s worden via `/resources/...` geserveerd. Zie `docs/assumptions.md` voor aannames bij de afgekapte opdrachttekst.

## Lokale opslag

Voortgang en resultaten staan alleen in `localStorage` van deze browser, sleutel `holobox-zorgsimulator-v2`, schemaversie `2`. Schema 1 wordt veilig gemigreerd. Niets wordt naar een server gestuurd.

- Wissen per resultaat: **Eerdere resultaten** → verwijderen (met bevestiging)
- Alles wissen: browsergegevens voor deze site verwijderen
- Ongeldige of verouderde data laat de app niet crashen; de store wordt veilig leeggemaakt

Sessieherstel: een onvoltooide intake wordt na herladen aangeboden als **Hervat** of **Nieuwe start**.

## Nieuw scenario / versie-update

Zie `docs/scenario-authoring.md` en `docs/scoring-rubric.md`.

## Architectuur

Zie `docs/architecture.md`.

## Bekende beperkingen

- Eén scenario in v0.1.0
- Geen microfoon, TTS of externe AI in de kernflow (bewust)
- Optionele spraakherkenning is niet geïmplementeerd
- Resultaten blijven op het apparaat; er is geen accountsysteem
- ESLint 9 in plaats van 10 vanwege jsx-a11y-compatibiliteit

## Licentie illustratie

De virtuele cliënt is een originele lokale SVG. Zie `src/assets/ERIK-LICENSE.md`.
