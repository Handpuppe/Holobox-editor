# Aannames bij v0.2.0

De wijzigingsopdracht was afgekapt bij paragraaf 13 (audio). Deze aannames zijn gekozen om veilig verder te kunnen bouwen.

- Audio: toon een melding als de browser autoplay blokkeert. Geen `setSinkId`, geen apparaat-ID.
- Verpleegkunde-scenario: één fictieve patiënt (meneer de Vries) met ABCDE (één stap per scherm) en een SBAR-wizard (S, B, A, R, controle). De video’s tonen een man.
- Alle negen aanwezige video’s in `resources/verpleegkunde/` zijn gekoppeld; er is geen idle-video aanwezig.
- `resources/logopedie/` is leeg; Logopedie blijft de lokale full-body SVG van Erik gebruiken.
- Bestandsnamen zijn exact overgenomen uit de schijf, inclusief spaties en en-streepjes.
- Opslagschema 2 migreert schema 1 zonder oude resultaten te wissen.
- Applicatieversie 0.2.0 (minor: extra module, bestaande logopedie-inhoud behouden).
- 80/20-indeling geldt voor interactieve patiëntscenario’s; briefing, resultaat en docentformulieren blijven volle schermen.
