# Garmin Langzeitanalyse – Dashboard

Interaktives Dashboard mit fünf Bereichen: **Überblick**, **Schlaf & Erholung**, **Training & Fitness**,
**Alltag & Stress** und **Zusammenhänge** (Training → Schlaf, Erholungskurve, Korrelationsmatrix usw.).

Ursprünglich als Artefakt auf claude.ai entstanden („Garmin Langzeitanalyse“). Die Dateien
`index.html`, `kit.js`, `calcs.js` und `app.js` sind unverändert übernommen. Die Laufzeit,
die claude.ai bereitstellt (`dash.data`, `dash.calc`, Farben, Design-Tokens), ist in
`dash-runtime.js` und `dash-runtime.css` nachgebaut, damit das Dashboard eigenständig im Browser läuft.

## Starten

```bash
cd dashboard
python -m http.server 8000
# dann http://localhost:8000 öffnen
```

Ohne eigene Daten zeigt das Dashboard **synthetische Demo-Daten** aus `demo-data/`.
Alternativ `index.html` direkt per Doppelklick öffnen und die JSON-Dateien über den Dateidialog auswählen
(Browser erlauben einer lokal geöffneten Seite nicht, Dateien selbst nachzuladen).

## Eigene Daten

Lege deine Dateien in `dashboard/data/`. Dieser Ordner ist in `.gitignore` eingetragen,
deine Gesundheitsdaten landen also **nicht** im (öffentlichen) Repository.

| Datei | Inhalt |
|---|---|
| `garmin_tageswerte.json` | ein Eintrag pro Tag |
| `garmin_aktivitaeten.json` | ein Eintrag pro Aktivität |
| `garmin_vo2max.json` | VO₂max-Schätzungen |
| `garmin_fitnessalter.json` | Fitnessalter, ein Wert pro Woche |
| `garmin_ftp.json` | FTP Velo |

Jede Datei ist ein JSON-Array von Objekten. Fehlende Werte sind `null`. Datumsangaben im Format `YYYY-MM-DD`.

### `garmin_tageswerte.json`

| Feld | Bedeutung |
|---|---|
| `date` | Kalendertag |
| `wear_h` | Tragezeit der Uhr in Stunden (Puls-/Stresswerte nur ab 12 h) |
| `rhr` | Ruhepuls (bpm) |
| `hrv` | nächtliche HRV (ms) |
| `readiness` | Training Readiness 0–100 |
| `stress_awake`, `stress_high_min` | Stress im Wachzustand (0–100), Minuten mit hohem Stress |
| `bb_wake` | Body Battery beim Aufwachen |
| `steps`, `floors_m` | Schritte, Höhenmeter im Alltag |
| `sleep_h`, `deep_h`, `rem_h` | Schlafdauer, Tief- und REM-Schlaf in Stunden (Nacht **vor** diesem Tag) |
| `sleep_score`, `sleep_stress`, `awakenings` | Schlafscore, Stress im Schlaf, Aufwachphasen |
| `bedtime`, `waketime` | Einschlaf-/Aufwachzeit in Stunden (z.B. `23.5` = 23:30, `24.25` = 00:15) |
| `im_vig`, `im_mod` | intensive bzw. moderate Intensitätsminuten |
| `train_min`, `kcal_active` | Trainingsminuten (ohne Gehen), aktive Kalorien |
| `train_end_h` | Uhrzeit, zu der die letzte Einheit endete (Stunden) |
| `min_Velo`, `min_Laufen`, `min_Kraft`, `min_Racket`, `min_Wandern` | Trainingsminuten je Sportart |

### `garmin_aktivitaeten.json`

`activity_id`, `date`, `name`, `cat` (Velo, Velo indoor, Laufen, Kraft, Tennis/Squash, Wandern, Wintersport, Andere, Gehen),
`type` (Garmin-Typ), `dur_min`, `dist_km`, `elev_m`, `avg_hr`, `load`, `te_aer`, `kcal`, `device`, `speed_kmh`.

### Weitere Dateien

- `garmin_vo2max.json`: `date`, `sport` (`RUNNING` oder `WALKING`), `vo2max`
- `garmin_fitnessalter.json`: `date`, `fit_age`, `age`
- `garmin_ftp.json`: `date`, `ftp_w`

## Demo-Daten neu erzeugen

```bash
python make_demo_data.py
```

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Seite und Layout |
| `calcs.js` | alle Berechnungen (Mittelwerte, Korrelationen, Erholungskurven …) |
| `app.js` | Darstellung der fünf Bereiche |
| `kit.js` | kleine Diagramm-Bibliothek auf Basis von d3 |
| `dash-runtime.js/.css` | Ersatz für die claude.ai-Laufzeit: Daten laden, Berechnungen ausführen, Design-Tokens |
| `vendor/d3.min.js` | d3 v7.9.0 (ISC-Lizenz, siehe `vendor/d3.LICENSE`) |
