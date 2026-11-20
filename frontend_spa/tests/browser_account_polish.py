"""Regressões visuais e funcionais da conta, tema escuro, toasts e seletores."""

import logging
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from werkzeug.serving import make_server

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from run_demo import create_demo_app


def main():
    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    app = create_demo_app(database_url="sqlite:///:memory:")
    server = make_server("127.0.0.1", 0, app)
    base = f"http://127.0.0.1:{server.server_port}"
    app.config.update(FRONTEND_URL=base, FRONTEND_ORIGINS=base)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    errors = []

    def check(label, condition):
        assert condition, label
        print("PASS", label, flush=True)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="msedge")
            context = browser.new_context(
                viewport={"width": 1280, "height": 900}, locale="pt-BR"
            )
            context.route(
                "**/*",
                lambda route: (
                    route.continue_()
                    if route.request.url.startswith(base + "/")
                    else route.abort()
                ),
            )
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base)
            page.locator("[name=email]").fill("aluno@lise.demo")
            page.locator("[name=password]").fill("LiseDemo123!")
            page.locator("[data-form=login] [type=submit]").click()
            page.locator("main .page-title").wait_for()

            page.goto(base + "/#conta/privacidade")
            page.locator("[data-crud-form=delete-account]").wait_for(state="attached")
            page.get_by_role("button", name="Excluir conta", exact=True).click()
            if (
                page.locator("[data-theme-toggle]").get_attribute("aria-checked")
                != "true"
            ):
                page.locator("[data-theme-toggle]").click()
            page.wait_for_timeout(350)

            tab = page.get_by_role("tab", name="Privacidade", exact=True)
            indicator = page.locator(".account-tabs > .tab-indicator")
            tab_box, indicator_box = tab.bounding_box(), indicator.bounding_box()
            check(
                "Indicador fica abaixo da aba ativa",
                abs(tab_box["x"] - indicator_box["x"]) < 1.5
                and abs(tab_box["width"] - indicator_box["width"]) < 1.5
                and indicator_box["y"] >= tab_box["y"] + tab_box["height"] - 2,
            )

            account_style = page.locator(".account-tabs").evaluate(
                "el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})"
            )
            check(
                "Abas não criam uma faixa clara no tema escuro",
                account_style["background"] == "rgba(0, 0, 0, 0)",
            )

            danger = page.locator(".account-danger")
            danger_style = danger.evaluate(
                "el=>({border:getComputedStyle(el).borderTopWidth,color:getComputedStyle(el).borderTopColor,red:getComputedStyle(el.querySelector('h2')).color})"
            )
            check(
                "Área de exclusão tem borda vermelha reforçada",
                danger_style["border"] == "2px"
                and danger_style["color"] == danger_style["red"],
            )
            check(
                "Aviso antigo de configuração não é exibido",
                "aguarda a configuração" not in danger.inner_text().lower(),
            )

            page.evaluate(
                "window.LiseInteractions.notify('Revise os campos e tente novamente.','error')"
            )
            notice = page.locator("#toast .notice").last
            check(
                "Toast separa título e orientação",
                notice.locator(".notice-title").inner_text()
                == "Não foi possível concluir"
                and notice.locator(".notice-message").inner_text()
                == "Revise os campos e tente novamente.",
            )
            check(
                "Toast possui ícone e botão de fechar acessível",
                notice.locator(".notice-mark svg").count() == 1
                and notice.get_by_role("button", name="Dispensar aviso").count() == 1,
            )
            contrast = page.evaluate("""() => {
              const parse=value=>{const n=value.match(/[\\d.]+/g)?.map(Number)||[];return [n[0]||0,n[1]||0,n[2]||0,n.length>3?n[3]:1]};
              const lum=rgb=>{const c=rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
              const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
              const background=el=>{for(let n=el;n;n=n.parentElement){const color=parse(getComputedStyle(n).backgroundColor);if(color[3]>.95)return color}return [0,0,0,1]};
              return ['.account-tabs .tab.active','.account-danger p','.account-danger h2','#toast .notice-title','#toast .notice-message'].map(selector=>{const el=document.querySelector(selector);return [selector,ratio(parse(getComputedStyle(el).color),background(el))]});
            }""")
            check(
                "Textos principais mantêm contraste no tema escuro",
                all(value >= 4.5 for _, value in contrast),
            )

            page.locator("[data-action=navigate][data-view=explore]:visible").click()
            page.locator(".segmented").wait_for()
            before = page.locator(".segmented").evaluate(
                "el=>getComputedStyle(el,'::before').transform"
            )
            page.get_by_role("button", name="Estudar", exact=True).click()
            page.wait_for_timeout(80)
            middle = page.locator(".segmented").evaluate(
                "el=>getComputedStyle(el,'::before').transform"
            )
            page.wait_for_timeout(260)
            after = page.locator(".segmented").evaluate(
                "el=>getComputedStyle(el,'::before').transform"
            )
            check(
                "Seletor de área desliza com estado intermediário",
                before != middle and middle != after and before != after,
            )

            page.goto(base + "/#conta/privacidade")
            form = page.locator("[data-crud-form=delete-account]")
            form.wait_for(state="attached")
            if not form.is_visible():
                page.get_by_role("button", name="Excluir conta", exact=True).click()
            form.locator("[name=password]").fill("LiseDemo123!")
            form.locator("[name=confirmation]").fill("EXCLUIR")
            form.locator("[name=preserve]").check()
            form.locator("[type=submit]").click()
            page.locator(".interaction-dialog [data-confirm]").click()
            page.locator("[data-form=login]").wait_for()
            check(
                "Usuário exclui a própria conta e perde o acesso",
                page.locator("[data-form=login]").is_visible(),
            )
            check("Nenhum erro JavaScript", not errors)
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
