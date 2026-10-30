import markdown, re, sys
src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding='utf-8').read()
# Python-Markdown needs a blank line before a list that follows a paragraph line
text = re.sub(r'(?m)^(?!\s*(?:\d+\.|[-*]) |\s*$)(.+)\n(?=\s*(?:\d+\.|[-*]) )', r'\1\n\n', text)
text = re.sub(r'```mermaid\n(.*?)```', lambda m: '<pre class="mermaid">' + m.group(1) + '</pre>', text, flags=re.S)
body = markdown.markdown(text, extensions=['tables', 'fenced_code', 'md_in_html'])
css = '''@page{size:letter;margin:0.5in}
body{font:11pt/1.5 "Segoe UI",Arial,sans-serif;color:#111;margin:0}
h1{font-size:22pt}h2{font-size:16pt;margin-top:22pt}h3{font-size:13pt;margin-top:18pt}
img{display:block;width:100%;height:auto;margin:4pt 0 14pt;border:1px solid #ccc;border-radius:6px;break-inside:avoid}
p:has(>img){break-inside:avoid}
table{border-collapse:collapse;width:100%;font-size:10pt;margin:8pt 0}th,td{border:1px solid #ccc;padding:4pt 6pt;vertical-align:top}th{background:#f2f2f2}
td img{width:90px;margin:0;border:none}
li{margin-bottom:3pt}
pre.mermaid{text-align:center;break-inside:avoid}
code{font-family:Consolas,monospace;font-size:.9em;background:#f2f2f2;padding:0 3px}'''
open(out, 'w', encoding='utf-8').write(f'<!doctype html><html><head><meta charset="utf-8"><title>Nexis Lens Design Document</title><style>{css}</style><script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script><script>mermaid.initialize({{startOnLoad:true,theme:"neutral"}})</script></head><body>{body}</body></html>')
