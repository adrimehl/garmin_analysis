# -*- coding: utf-8 -*-
"""Baut garmin-dashboard.html: das ganze Dashboard in EINER Datei.

Stylesheet und alle Skripte (inkl. d3 und fflate) werden direkt in die Seite
eingebettet. Die Datei funktioniert dadurch auch, wenn sie allein heruntergeladen,
aus einer ZIP heraus oder am Handy geöffnet wird.

Aufruf (nach Änderungen an index.html, *.js oder *.css):  python build_single_file.py
"""
import os
import re

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


if __name__ == '__main__':
    main()
