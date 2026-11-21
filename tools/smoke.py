import sys, json, os, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
URL=(ROOT/'dist'/'index.html').as_uri()
SHOTS=ROOT/'shots'; SHOTS.mkdir(exist_ok=True)
CHROME=os.environ.get('CHROME')  # 비우면 Playwright 기본 Chromium 사용
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--no-sandbox']) if CHROME else p.chromium.launch()
    pg=b.new_page(viewport={'width':1280,'height':760})
    pg.on('console',lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('pageerror:'+str(e)))
    pg.goto(URL); pg.wait_for_timeout(1500)
    pg.screenshot(path=str(SHOTS/'s1_title.png'))
    pg.fill('#inName','테스트'); pg.fill('#inCode','A반'); pg.check('#mDemo'); pg.click('button[type=submit]')
    pg.wait_for_timeout(300)
    for i in range(3): pg.click('#pop .btn'); pg.wait_for_timeout(100)
    # 걷기
    pg.keyboard.down('ArrowLeft'); pg.wait_for_timeout(600); pg.keyboard.up('ArrowLeft')
    print('player', pg.evaluate('[pl.x,pl.y]'))
    # 은행 앞에서 상호작용
    pg.evaluate("guideTo('bank')"); pg.wait_for_timeout(1200)
    print('view after guide', pg.evaluate('view && view.t'))
    pg.screenshot(path=str(SHOTS/'s2_bank.png'))
    pg.evaluate("closeView()")
    # 매수/PF
    print('buy L2', pg.evaluate("doBuy('L2','mort',.5)"), 'cash', pg.evaluate('S.cash'))
    pg.evaluate("openView({t:'pf'})"); pg.wait_for_timeout(100); pg.screenshot(path=str(SHOTS/'s3_pf.png'))
    pg.evaluate("startPF('L2','apt',1)"); print('projects', pg.evaluate('S.projects.length'),'cash',pg.evaluate('S.cash'))
    print('buy A3 live', pg.evaluate("doBuy('A3','mort',.6,null,true)"), pg.evaluate('S.cash'))
    pg.evaluate("openView({t:'prop',id:'A2'})"); pg.wait_for_timeout(150); pg.screenshot(path=str(SHOTS/'t1_buy.png'))
    pg.evaluate("openView({t:'hall'})"); pg.wait_for_timeout(150); pg.screenshot(path=str(SHOTS/'t2_hall.png'))
    for v in ["{t:'agent'}","{t:'paper'}","{t:'hall'}","{t:'station'}","{t:'prop',id:'L2'}","{t:'prop',id:'O1'}","{t:'bank'}"]:
        pg.evaluate(f"openView({v})")
    for t in ['asset','market','news','macro']: pg.evaluate(f"ACT.tab('{t}')")
    pg.evaluate("usdBuy()"); pg.evaluate("creditMove(.5)"); pg.evaluate("mezzBuy(0)")
    # 분기 진행
    log=[]
    for q in range(40):
        over=pg.evaluate("S.over")
        if over: break
        pg.evaluate("advanceQuarter()")
        n=0
        while pg.evaluate("!!popup") and n<12:
            title=pg.evaluate("popup.title"); nch=pg.evaluate("popup.choices.length")
            log.append(f"q{pg.evaluate('S.q')}: {title}")
            # 첫 번째 가능한 선택지
            idx=pg.evaluate("popup.choices.findIndex(c=>!c.dis)")
            pg.evaluate(f"choose({idx})"); n+=1
        if q==6:
            pg.evaluate("doBuy('A4','jeonse',0)")
            pg.evaluate("openView({t:'prop',id:'A3'})"); pg.evaluate("ACT.tab('asset')"); pg.wait_for_timeout(200); pg.screenshot(path=str(SHOTS/'s4_prop.png'))
            pg.evaluate("closeView()")
        if q==20: print('sell A4', pg.evaluate("JSON.stringify(S.own.A4?sellCalc('A4').c:null)")); pg.evaluate("S.own.A4&&doSell('A4')")
        if q==9: pg.evaluate("ACT.tab('macro')"); pg.wait_for_timeout(200); pg.screenshot(path=str(SHOTS/'s5_macro.png'))
        for v in ["{t:'pf'}","{t:'prop',id:'A3'}","{t:'bank'}","{t:'agent'}","{t:'paper'}","{t:'hall'}"]:
            if not pg.evaluate("S.over"): pg.evaluate(f"openView({v})")
        if not pg.evaluate("S.over"): pg.evaluate("closeView()")
    print('\n'.join(log))
    print('elect', pg.evaluate("JSON.stringify(W.elect.map(e=>[e.q,e.type,e.devWin,e.from,e.to]))"), 'due', pg.evaluate("JSON.stringify(S.due)"))
    print('final q',pg.evaluate('S.q'),'nw',pg.evaluate('netWorth()'),'stats',json.dumps(pg.evaluate('S.stats'),ensure_ascii=False))
    pg.wait_for_timeout(300); pg.screenshot(path=str(SHOTS/'s6_report.png'))
    # 모바일
    pg2=b.new_page(viewport={'width':390,'height':780}); pg2.on('pageerror',lambda e: errs.append('m-pageerror:'+str(e)))
    pg2.goto(URL); pg2.wait_for_timeout(800); pg2.check('#mDemo'); pg2.click('button[type=submit]')
    for i in range(3): pg2.click('#pop .btn'); pg2.wait_for_timeout(100)
    pg2.mouse.click(120,400); pg2.wait_for_timeout(900); pg2.screenshot(path=str(SHOTS/'s7_mobile.png'))
    pg2.click('#mnav button[data-v=market]'); pg2.wait_for_timeout(400); pg2.screenshot(path=str(SHOTS/'s8_mobile_tab.png'))
    b.close()
print('ERRORS',errs)
