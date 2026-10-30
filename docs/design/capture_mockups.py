import sys, re
from pathlib import Path
from playwright.sync_api import sync_playwright
html, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
css = """.task{grid-template-columns:1fr!important}
.shots{width:680px}
.mock.tall{display:flex!important;flex-direction:column;height:510px!important}
.mock.tall>.m-body{flex:1;min-height:0!important}
.mock.tall>.m-body>*{min-height:0}"""
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    pg = b.new_page(viewport={'width':1100,'height':900}, device_scale_factor=2, color_scheme='light')
    pg.goto(html.as_uri()); pg.add_style_tag(content=css)
    for f in pg.query_selector_all('figure.shot'):
        cap = f.query_selector('figcaption b').inner_text().strip('. ')
        m = f.query_selector('.mock')
        if m and cap not in ('4a', '5a'): m.evaluate('e => e.classList.add("tall")')
        if m: m.screenshot(path=str(out / f'{cap}.png')); print(cap, m.bounding_box()['width'])
    b.close()
