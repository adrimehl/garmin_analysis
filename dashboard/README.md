# Garmin Langzeitanalyse – Dashboard

Interaktives Dashboard mit sechs Bereichen: **Überblick**, **Schlaf & Erholung**, **Training & Fitness**,
**Alltag & Stress**, **Zusammenhänge** (Training → Schlaf, Erholungskurve, Korrelationsmatrix usw.) und **Kalender** (Jahreskalender- und Wochen-Heatmaps wie in der Python-Version).

Ursprünglich als Artefakt auf claude.ai entstanden („Garmin Langzeitanalyse“). Die Dateien
`index.html`, `kit.js`, `calcs.js` und `app.js` sind unverändert übernommen. Die Laufzeit,
die claude.ai bereitstellt (`dash.data`, `dash.calc`, Farben, Design-Tokens), ist in
`dash-runtime.js` und `dash-runtime.css` nachgebaut, damit das Dashboard eigenständig im Browser läuft.

## Am einfachsten: eine einzige Datei

**`garmin-dashboard.html`** enthält das ganze Dashboard (Gestaltung, Programm, Bibliotheken) in einer Datei.
Herunterladen, doppelklicken, Garmin-ZIP hineinziehen – fertig. Sie funktioniert auch allein, ohne die anderen
Dateien in diesem Ordner. Nach Änderungen an `index.html`, `*.js` oder `*.css` neu erzeugen mit
`python build_single_file.py`.

## Als claude.ai-Artefakt

`python build_single_file.py --artifact <ordner>/garmin.html` erzeugt die Variante für ein privates
Artefakt auf claude.ai (ohne Download-Knöpfe, die dort gesperrt sind). Die Demo-Daten werden dabei als
`demo-data/*.json` mitveröffentlicht. Geladene Daten merkt sich das Dashboard im Browser (IndexedDB),
sie überstehen also Neuladen und Updates der Seite; „Daten aus diesem Browser entfernen“ löscht sie.

## Starten (Entwicklung)

```bash
cd dashboard
python -m http.server 8000
# dann http://localhost:8000 öffnen
```

Oder `index.html` einfach per Doppelklick öffnen. Ohne eigene Daten zeigt das Dashboard **synthetische Demo-Daten**.

## Garmin-Export direkt laden

1. Auf garmin.com unter Konto → Datenverwaltung → „Daten exportieren“ den Export anfordern (kommt per E-Mail).
2. Im Dashboard die ZIP-Datei auswählen oder in den Hinweiskasten ziehen (der entpackte Ordner geht auch).
3. Das Dashboard liest und rechnet **nur in deinem Browser**, es wird nichts hochgeladen.
4. Optional „Aufbereitete Dateien speichern“ und die fünf Dateien nach `dashboard/data/` legen. Dann sind sie beim nächsten Start sofort da.

Verwendet werden aus `DI_CONNECT`:

| Datei im Export | ergibt |
|---|---|
| `…_summarizedActivities.json` | Aktivitäten (Doppelaufzeichnungen anderer Geräte, z.B. Velocomputer, werden entfernt) |
| `UDSFile_…json` | Tageswerte: Schritte, Ruhepuls, Stress, Body Battery, Intensitätsminuten, Tragezeit |
| `…_sleepData.json` | Schlaf (Zeiten über den Zeitzonen-Versatz in Ortszeit umgerechnet) |
| `…_healthStatusData.json` | HRV |
| `MetricsMaxMetData_…json` | VO₂max |
| Dateien mit `TrainingReadiness`, `FitnessAge` bzw. `biometric` im Namen | Readiness, Fitnessalter, FTP (Format noch nicht an echten Daten geprüft) |

Einheiten im Export: Dauer in ms, Distanz und Höhenmeter in cm, `avgSpeed` × 36 = km/h, Kalorien in kJ.
„Body Battery morgens“ ist der Tageshöchstwert (meist direkt nach dem Schlaf).
Training Load und Training Effect fehlen in neueren Exporten; die Spalten bleiben dann leer.

Klappt die Umwandlung nicht, zeigt das Dashboard die **Struktur** des Exports (nur Datei- und Feldnamen,
keine Werte). Diesen Text kannst du weitergeben, um das Problem zu beheben.

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
| `garmin-dashboard.html` | alles in einer Datei (erzeugt von `build_single_file.py`) |
| `index.html` | Seite und Layout |
| `calcs.js` | alle Berechnungen (Mittelwerte, Korrelationen, Erholungskurven …) |
| `app.js` | Darstellung der fünf Bereiche |
| `kit.js` | kleine Diagramm-Bibliothek auf Basis von d3 |
| `garmin-import.js` | Garmin-Export lesen (ZIP/Ordner) und ins Dashboard-Format umwandeln |
| `dash-runtime.js/.css` | Ersatz für die claude.ai-Laufzeit: Daten laden, Berechnungen ausführen, Design-Tokens |
| `vendor/d3.min.js` | d3 v7.9.0 (ISC-Lizenz, siehe `vendor/d3.LICENSE`) |
| `vendor/fflate.min.js` | fflate 0.8.2 zum Entpacken (MIT-Lizenz, siehe `vendor/fflate.LICENSE`) |
