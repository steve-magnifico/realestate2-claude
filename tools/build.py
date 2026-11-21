import sys, pathlib
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
rd = lambda n: (src / n).read_text(encoding='utf-8')
js = '\n'.join(rd(n) for n in ['world.js', 'econ.js', 'ui.js', 'map.js'])
assert '</script' not in js
html = f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>청운시 부동산 대작전</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet">
<style>
{rd('style.css')}
</style>
</head>
<body>
{rd('body.html')}
<script>
{js}
</script>
</body>
</html>
'''
out.write_text(html, encoding='utf-8'); print(len(html), 'bytes')
