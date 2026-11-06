# -*- coding: utf-8 -*-
"""Baut garmin-dashboard.html: das ganze Dashboard in EINER Datei.

Stylesheet und alle Skripte (inkl. d3 und fflate) werden direkt in die Seite
eingebettet. Die Datei funktioniert dadurch auch, wenn sie allein heruntergeladen,
aus einer ZIP heraus oder am Handy geöffnet wird.

Aufruf (nach Änderungen an index.html, *.js oder *.css):  python build_single_file.py

Mit  --artifact <datei>  entsteht zusätzlich die Variante für ein claude.ai-Artefakt:
ohne <html>/<head>/<body> (das ergänzt claude.ai), ohne Download-Knöpfe (dort gesperrt).
Die Demo-Daten werden dort als eigene Dateien unter demo-data/ mitveröffentlicht.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'garmin-dashboard.html')


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


def inline_script(match):
    code = read(match.group(1))
    # ein "</script" im Code würde das <script>-Element vorzeitig beenden
    code = re.sub(r'</(script)', r'<\\/\1', code, flags=re.IGNORECASE)
    return '<script>\n' + code + '\n</script>'


def main():
    html = read('index.html')
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>\n' + read(m.group(1)) + '\n</style>', html)
    html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
    html = html.replace('<meta charset="utf-8">',
                        '<meta charset="utf-8">\n<!-- Automatisch erzeugt aus index.html mit build_single_file.py - nicht von Hand ändern -->', 1)
    if re.search(r'<(script|link)[^>]+(src|href)=', html):
        raise SystemExit('Nicht alle Dateien wurden eingebettet.')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print(f'{os.path.basename(OUT)}: {len(html.encode("utf-8")) // 1024} KB')

    if '--artifact' in sys.argv:
        target = sys.argv[sys.argv.index('--artifact') + 1]
        head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
        body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
        title = re.search(r'<title>.*?</title>', head, re.S).group(0)
        head = re.sub(r'<title>.*?</title>|<meta [^>]*>|<!--.*?-->', '', head, flags=re.S)
        page = (title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n'
                '<!-- Automatisch erzeugt mit build_single_file.py --artifact - nicht von Hand ändern -->\n'
                "<script>window.DASH_ENV = 'artifact';</script>\n" + head.strip() + '\n' + body.strip() + '\n')
        with open(target, 'w', encoding='utf-8', newline='\n') as f:
            f.write(page)
        print(f'{target}: {len(page.encode("utf-8")) // 1024} KB')


if __name__ == '__main__':
    main()
