# garmin_analysis
Analyse your Garmin data

This tool allows you to analyze the data collected from your garmin watch to gain more helpful insights.

## Inhalt

| Ordner | Was |
|---|---|
| [`garmin_analysis/`](garmin_analysis) | Python-Skripte: Grafiken aus dem Garmin-Export (Aktivitäten-CSV, Schlaf-JSON) |
| [`dashboard/`](dashboard) | Interaktives Dashboard „Garmin Langzeitanalyse“ im Browser (mit Demo-Daten) |

## Python-Auswertung

```bash
pip install -r requirements.txt
cd garmin_analysis
python main.py
```

Erwartet im Arbeitsordner:

- `data/Activities.csv` – Export aus Garmin Connect (Aktivitäten → Exportieren als CSV)
- `data/DI_CONNECT/DI-Connect-Wellness/*_sleepData.json` – aus dem vollständigen Garmin-Datenexport
  (garmin.com → Konto → Datenverwaltung → Daten exportieren)

Die Grafiken landen in `plots/`.

## Dashboard

```bash
cd dashboard
python -m http.server 8000   # dann http://localhost:8000 öffnen
```

Details und Datenformat: [`dashboard/README.md`](dashboard/README.md).

## Datenschutz

`data/`, `plots/` und `dashboard/data/*.json` stehen in `.gitignore`. Persönliche Gesundheitsdaten
werden damit nicht versehentlich in dieses öffentliche Repository hochgeladen.
