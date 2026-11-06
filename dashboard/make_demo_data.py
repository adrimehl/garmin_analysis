# -*- coding: utf-8 -*-
"""Erzeugt synthetische Demo-Daten für das Dashboard (keine echten Gesundheitsdaten).

Aufruf:  python make_demo_data.py            -> schreibt nach ./demo-data/
         python make_demo_data.py <ordner>   -> schreibt in einen anderen Ordner

Die Dateien haben dasselbe Format wie die echten Dateien in ./data/ (siehe README.md).
Die Werte sind zufällig, aber mit ein paar eingebauten Zusammenhängen (z.B. schlechterer
Schlaf nach harten Trainingstagen), damit alle Diagramme etwas zeigen.
"""
import json
import math
import os
import random
import sys
from datetime import date, timedelta

START = date(2022, 10, 3)
END = date(2026, 10, 18)
SEED = 42

# Sportart -> (Garmin-Typ, Ø Dauer min, km/h oder None, Hm pro km, Puls, Anteil intensiv, Feldname Tagesminuten)
SPORTS = {
    'Velo':          ('road_biking',       120, 27.0, 9,  138, 0.45, 'min_Velo'),
    'Velo indoor':   ('indoor_cycling',     60, None, 0,  140, 0.55, 'min_Velo'),
    'Laufen':        ('running',            50, 11.0, 12, 152, 0.70, 'min_Laufen'),
    'Kraft':         ('strength_training',  50, None, 0,  112, 0.10, 'min_Kraft'),
    'Tennis/Squash': ('squash',             60, None, 0,  148, 0.60, 'min_Racket'),
    'Wandern':       ('hiking',            210, 4.0,  80, 115, 0.15, 'min_Wandern'),
    'Wintersport':   ('resort_skiing',     240, None, 0,  120, 0.20, None),
    'Gehen':         ('walking',            50, 5.2,  10, 98,  0.00, None),
}
NAMES = {
    'Velo': ['Feierabendrunde', 'Pfannenstiel', 'Albis-Runde', 'Seerunde', 'Ricken'],
    'Velo indoor': ['Zwift', 'Rolle Intervall'],
    'Laufen': ['Seeufer', 'Intervalle', 'Long Run', 'Lockerer Lauf'],
    'Kraft': ['Kraft Oberkörper', 'Kraft Beine', 'Gym'],
    'Tennis/Squash': ['Squash', 'Squash Match'],
    'Wandern': ['Wanderung', 'Bergwanderung'],
    'Wintersport': ['Skitag'],
    'Gehen': ['Spaziergang'],
}


def r1(x, n=1):
    return None if x is None else round(x, n)


def pick_sport(day, rnd):
    winter = day.month in (12, 1, 2, 3)
    w = {
        'Velo': 1 if winter else 6, 'Velo indoor': 3 if winter else 0.5, 'Laufen': 3, 'Kraft': 2.5,
        'Tennis/Squash': 2, 'Wandern': 0.3 if winter else 1.2, 'Wintersport': 1.2 if winter else 0,
    }
    sports, weights = zip(*w.items())
    return rnd.choices(sports, weights)[0]


def main(out_dir):
    rnd = random.Random(SEED)
    os.makedirs(out_dir, exist_ok=True)
    activities, daily, vo2, fitage, ftp = [], [], [], [], []
    fitness = 0.0          # langsamer Trend: steigt mit Training, sinkt ohne
    prev_vig = 0
    aid = 10_000_000_000

    n_days = (END - START).days + 1
    for i in range(n_days):
        d = START + timedelta(days=i)
        ds = d.isoformat()
        weekend = d.weekday() >= 5
        acts_today = []

        # Training (an ~55 % der Tage, am Wochenende öfter)
        if rnd.random() < (0.7 if weekend else 0.5):
            for _ in range(1 if rnd.random() < 0.85 else 2):
                acts_today.append(pick_sport(d, rnd))
        if rnd.random() < 0.35:
            acts_today.append('Gehen')

        train_min = 0
        im_vig = 0
        im_mod = 0
        kcal_active = 250 + rnd.gauss(0, 60)
        per_sport = {'min_Velo': 0, 'min_Laufen': 0, 'min_Kraft': 0, 'min_Racket': 0, 'min_Wandern': 0}
        train_end = None
        for cat in acts_today:
            gtype, dur0, speed, hm_km, hr0, vig_share, field = SPORTS[cat]
            dur = max(15, rnd.gauss(dur0 * (1.3 if weekend else 1.0), dur0 * 0.3))
            start_h = rnd.choice([7, 9, 10, 14]) if weekend else rnd.choice([6.5, 12, 17.5, 18.5, 19.5])
            speed_kmh = None if speed is None else max(3, rnd.gauss(speed + fitness * 0.4, speed * 0.08))
            dist = None if speed_kmh is None else speed_kmh * dur / 60
            elev = None if dist is None else max(0, rnd.gauss(hm_km, hm_km * 0.5)) * dist
            avg_hr = max(80, rnd.gauss(hr0 - fitness * 1.5, 6))
            vig = dur * vig_share * rnd.uniform(0.6, 1.3)
            aid += rnd.randint(1, 999)
            activities.append({
                'activity_id': str(aid), 'date': ds, 'name': rnd.choice(NAMES[cat]), 'cat': cat, 'type': gtype,
                'dur_min': r1(dur), 'dist_km': r1(dist, 2), 'elev_m': r1(elev, 0), 'avg_hr': r1(avg_hr, 0),
                'load': r1(dur * (avg_hr - 60) / 60, 0) if cat != 'Gehen' else None,
                'te_aer': r1(min(5, 1 + vig / 25 + rnd.uniform(0, 0.8)), 1) if cat != 'Gehen' else None,
                'kcal': r1(dur * (avg_hr - 40) / 10, 0), 'device': 'Demo-Uhr', 'speed_kmh': r1(speed_kmh, 2),
            })
            kcal_active += dur * (avg_hr - 40) / 10
            if cat == 'Gehen':
                im_mod += dur * 0.3
                continue
            train_min += dur
            im_vig += vig
            im_mod += dur - vig
            if field:
                per_sport[field] += dur
            end_h = start_h + dur / 60
            train_end = end_h if train_end is None else max(train_end, end_h)

        fitness = fitness * 0.995 + train_min / 6000
        season = math.cos((d.timetuple().tm_yday - 15) / 365 * 2 * math.pi)  # +1 im Januar, -1 im Juli

        # Nacht vor diesem Tag (Schlafwerte gehören zum Tag des Aufwachens); harte Vortage verschlechtern sie
        hard = min(prev_vig, 150) / 150
        bedtime = rnd.gauss(23.3 + (0.6 if d.weekday() in (5, 6) else 0), 0.55)
        sleep_h = max(4.5, rnd.gauss(7.3 + 0.3 * season + (0.5 if weekend else 0), 0.7))
        waketime = bedtime + sleep_h + rnd.uniform(0.2, 0.5) - 24
        deep_h = max(0.2, rnd.gauss(1.25 - 0.35 * hard, 0.25))
        rem_h = max(0.3, rnd.gauss(1.7, 0.3))
        sleep_score = max(30, min(100, rnd.gauss(78 + 4 * (sleep_h - 7.3) - 12 * hard, 7)))
        rhr = rnd.gauss(55 - fitness * 2.5 + 3 * hard + 0.8 * season, 1.6)
        stress_awake = max(5, rnd.gauss(32 - 3 * season * -1 + (-4 if weekend else 2), 6))
        wear_h = 23 if rnd.random() > 0.03 else rnd.uniform(4, 11)
        has_bb = d >= date(2024, 6, 1)
        has_hrv = d >= date(2026, 1, 10)

        row = {
            'date': ds, 'wear_h': r1(wear_h),
            'steps': int(max(800, rnd.gauss(9500 + (2500 if weekend else 0) - 1500 * season, 3000))),
            'floors_m': r1(max(0, rnd.gauss(60, 30)), 0),
            'rhr': r1(rhr), 'stress_awake': r1(stress_awake), 'stress_high_min': r1(max(0, rnd.gauss(stress_awake * 1.5, 15)), 0),
            'sleep_h': r1(sleep_h, 2), 'deep_h': r1(deep_h, 2), 'rem_h': r1(rem_h, 2), 'sleep_score': r1(sleep_score, 0),
            'sleep_stress': r1(max(3, rnd.gauss(16 + 8 * hard, 4))), 'awakenings': max(0, int(rnd.gauss(2 + 2 * hard, 1.2))),
            'bedtime': r1(bedtime, 2), 'waketime': r1(waketime, 2),
            'bb_wake': r1(max(10, min(100, rnd.gauss(75 + 4 * (sleep_h - 7.3) - 18 * hard, 9))), 0) if has_bb else None,
            'hrv': r1(rnd.gauss(55 + fitness * 3 - 9 * hard, 6), 0) if has_hrv else None,
            'readiness': r1(max(5, min(100, rnd.gauss(70 - 25 * hard, 12))), 0) if has_hrv else None,
            'train_min': r1(train_min, 0), 'im_vig': r1(im_vig, 0), 'im_mod': r1(im_mod, 0),
            'kcal_active': r1(kcal_active, 0), 'train_end_h': r1(train_end, 2),
        }
        row.update({k: r1(v, 0) for k, v in per_sport.items()})
        # ohne genug Tragezeit keine Puls-/Stresswerte (wie in den echten Daten)
        if wear_h < 12:
            for k in ('rhr', 'stress_awake', 'stress_high_min', 'hrv'):
                row[k] = None
        daily.append(row)
        prev_vig = im_vig

        # VO2max nach Läufen, FTP ab Februar 2026, Fitnessalter wöchentlich
        if 'Laufen' in acts_today and rnd.random() < 0.8:
            vo2.append({'date': ds, 'sport': 'RUNNING', 'vo2max': r1(rnd.gauss(49 + fitness * 1.2, 0.6))})
        if 'Gehen' in acts_today and rnd.random() < 0.1:
            vo2.append({'date': ds, 'sport': 'WALKING', 'vo2max': r1(rnd.gauss(44 + fitness, 1.0))})
        if d.weekday() == 0:
            age = 38 + (d - date(2022, 1, 1)).days / 365.25
            fitage.append({'date': ds, 'fit_age': r1(age - 6 - fitness * 1.5 + rnd.gauss(0, 0.3)), 'age': r1(age)})
        if d >= date(2026, 2, 1) and d.day == 1:
            ftp.append({'date': ds, 'ftp_w': int(245 + (d.month - 2) * 3 + rnd.gauss(0, 4))})

    files = {
        'garmin_aktivitaeten.json': activities, 'garmin_tageswerte.json': daily,
        'garmin_vo2max.json': vo2, 'garmin_fitnessalter.json': fitage, 'garmin_ftp.json': ftp,
    }
    for name, rows in files.items():
        with open(os.path.join(out_dir, name), 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
        print(f'{name}: {len(rows)} Zeilen')


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'demo-data'))
