# Hinweise für Claude

## Bei jeder Änderung am Dashboard: GitHub UND Artefakt aktualisieren

Der Nutzer will Änderungen sofort sehen, ohne etwas herunterzuladen. Deshalb nach jeder Änderung in `dashboard/`:

1. Quelldateien ändern (`index.html`, `app.js`, `calcs.js`, `kit.js`, `garmin-import.js`, `dash-runtime.*`).
2. `python dashboard/build_single_file.py --artifact <scratchpad>/artifact-dashboard/garmin.html`
   (erzeugt `dashboard/garmin-dashboard.html` und die Artefakt-Variante).
3. Committen und pushen.
4. Das claude.ai-Artefakt „Garmin Langzeitanalyse“ (Dashboard zum Hineinziehen der Garmin-ZIP) aktualisieren:
   https://claude.ai/artifact/M91s7BPedNMMD2KzpNoWTu
   - die Artefakt-Variante mit `url` auf dieses Artefakt veröffentlichen; die Demo-Daten liegen dort bereits
     als `demo-data/*.json`.
   - In einer neuen Sitzung das Artefakt vorher mit `action: "read"` lesen.

## Datenschutz
- Das Repository ist öffentlich: keine echten Gesundheitsdaten committen (`data/`, `dashboard/data/` sind ignoriert).

## Sonstiges
- Sprache: Deutsch, Schweizer Rechtschreibung (kein ß).
