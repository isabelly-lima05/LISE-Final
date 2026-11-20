"""Regressões da experiência: filtros, tema, movimento e conexões entre palavras."""

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

    def login(page, email):
        page.goto(base)
        page.locator("[name=email]").fill(email)
        page.locator("[name=password]").fill("LiseDemo123!")
        page.locator("[data-form=login] [type=submit]").click()
        page.locator("main .page-title").wait_for()

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="msedge")
            context = browser.new_context(
                viewport={"width": 1366, "height": 900}, locale="pt-BR"
            )
            context.route(
                "**/*",
                lambda route: route.continue_()
                if route.request.url.startswith(base + "/")
                else route.abort(),
            )
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            login(page, "aluno@lise.demo")

            greeting = page.locator(".student-greeting .page-title").inner_text()
            check("Cumprimento mantém o nome visível", "Aluno" in greeting)
            check("Selo redundante da área foi removido", page.locator(".workspace-role").count() == 0)

            toggle = page.locator("[data-theme-toggle]")
            sun_before = page.locator(".appearance-sun").evaluate("el=>getComputedStyle(el).transform")
            toggle.click()
            page.wait_for_timeout(220)
            sun_after = page.locator(".appearance-sun").evaluate("el=>getComputedStyle(el).transform")
            check("Troca de tema transforma os ícones", sun_before != sun_after)
            toggle.click()
            page.wait_for_timeout(220)

            page.get_by_role("button", name="Explorar", exact=True).click()
            page.locator(".specimen-card").first.wait_for()
            check(
                "Filtros rápidos são pills alternáveis",
                page.locator(".filter-pill").count() == 2
                and page.locator(".explore-filters > .check-row").count() == 0,
            )
            page.evaluate("""() => {
              const button=document.createElement('button');
              button.id='pagination-contrast-probe';
              button.className='pagination-button is-current';
              button.textContent='1';
              document.querySelector('.explorer-controls').append(button);
            }""")
            pager = page.locator("#pagination-contrast-probe")
            pager_idle = pager.evaluate("el=>getComputedStyle(el).backgroundColor")
            pager.hover()
            page.wait_for_timeout(190)
            pager_hover = pager.evaluate("el=>getComputedStyle(el).backgroundColor")
            check(
                "Página selecionada não desaparece no hover claro",
                pager_idle != pager_hover,
            )
            pager.evaluate("el=>el.remove()")
            toggle.click()
            page.wait_for_timeout(220)
            page.evaluate("""() => {
              const button=document.createElement('button');
              button.id='pagination-contrast-probe';
              button.className='pagination-button is-current';
              button.textContent='1';
              document.querySelector('.explorer-controls').append(button);
            }""")
            pager = page.locator("#pagination-contrast-probe")
            pager_idle = pager.evaluate("el=>getComputedStyle(el).backgroundColor")
            pager.hover()
            page.wait_for_timeout(190)
            pager_hover = pager.evaluate("el=>getComputedStyle(el).backgroundColor")
            check(
                "Página selecionada não desaparece no hover escuro",
                pager_idle != pager_hover,
            )
            pager.evaluate("el=>el.remove()")

            page.evaluate("""() => {
              const original=window.LiseInteractions.motion;
              window.__motionCalls=[];
              window.LiseInteractions.motion=(el,frames,opts={})=>{
                window.__motionCalls.push({frames,opts});
                return original(el,frames,opts);
              };
            }""")
            search = page.locator("#explore-search")
            search.fill("auto")
            page.wait_for_timeout(300)
            search.fill("")
            page.wait_for_timeout(300)
            stagger = page.evaluate("""() => window.__motionCalls.filter(call =>
              call.frames?.[0]?.transform==='translateY(10px)'
            ).map(call=>call.opts)""")
            check(
                "Grade usa entrada escalonada curta",
                len(stagger) >= 2
                and all(call.get("duration") == 220 for call in stagger)
                and max(call.get("delay", 0) for call in stagger) <= 270,
            )

            page.evaluate("""() => {
              window.__viewTransitions=0;
              const original=document.startViewTransition?.bind(document);
              if(original)document.startViewTransition=callback=>{
                window.__viewTransitions++;
                return original(callback);
              };
            }""")
            bio = page.locator(".specimen-card").filter(
                has=page.locator(".word-name", has_text="Biologia")
            )
            bio.get_by_role("button", name="Investigar palavra").click()
            page.locator(".term-shared-surface").wait_for()
            check(
                "Card cresce para a ficha com View Transitions",
                page.evaluate("window.__viewTransitions") == 1,
            )
            check(
                "Mapa explica origem, elementos e destinos",
                page.locator(".connection-origin-kicker").inner_text().casefold() == "palavra em foco"
                and page.locator(".connection-tokens span").count() >= 1
                and page.locator(".connection-reason").count() >= 1,
            )

            page.locator("[data-action=detail-back]").click()
            page.locator(".specimen-card").first.wait_for()
            page.emulate_media(reduced_motion="reduce")
            transitions_before = page.evaluate("window.__viewTransitions")
            page.locator(".specimen-card").filter(
                has=page.locator(".word-name", has_text="Biologia")
            ).get_by_role("button", name="Investigar palavra").click()
            page.locator(".term-shared-surface").wait_for()
            check(
                "Movimento reduzido evita a transição compartilhada",
                page.evaluate("window.__viewTransitions") == transitions_before,
            )

            page.get_by_role("button", name="Início", exact=True).click()
            page.locator(".student-greeting .page-title").wait_for()
            check(
                "Cumprimento fica fixo durante a sessão",
                page.locator(".student-greeting .page-title").inner_text() == greeting,
            )

            teacher_context = browser.new_context(
                viewport={"width": 1366, "height": 900}, locale="pt-BR"
            )
            teacher_context.route(
                "**/*",
                lambda route: route.continue_()
                if route.request.url.startswith(base + "/")
                else route.abort(),
            )
            teacher = teacher_context.new_page()
            teacher.on("pageerror", lambda error: errors.append(str(error)))
            login(teacher, "professor@lise.demo")
            create = teacher.get_by_role("button", name="Criar turma", exact=True).first
            welcome_box = teacher.locator(".teacher-welcome").bounding_box()
            toggle_box = teacher.locator("[data-theme-toggle]").bounding_box()
            create_box = create.bounding_box()
            overlaps = not (
                toggle_box["x"] + toggle_box["width"] <= create_box["x"]
                or create_box["x"] + create_box["width"] <= toggle_box["x"]
                or toggle_box["y"] + toggle_box["height"] <= create_box["y"]
                or create_box["y"] + create_box["height"] <= toggle_box["y"]
            )
            check(
                "Conteúdo aproveita o topo sem colidir com o tema",
                welcome_box["y"] < 40 and not overlaps,
            )
            check(
                "Cabeçalho usa a largura disponível",
                welcome_box["width"] >= 0.88 * (1366 - 72),
            )
            idle_light = create.evaluate("el=>getComputedStyle(el).backgroundColor")
            surface_light = teacher.locator(".teacher-welcome").evaluate(
                "el=>getComputedStyle(el).backgroundColor"
            )
            create.hover()
            teacher.wait_for_timeout(190)
            hovered_light = create.evaluate("el=>getComputedStyle(el).backgroundColor")
            check(
                "Criar turma continua visível no hover claro",
                idle_light != hovered_light and hovered_light != surface_light,
            )
            if teacher.locator("[data-theme-toggle]").get_attribute("aria-checked") != "true":
                teacher.locator("[data-theme-toggle]").click()
                teacher.wait_for_timeout(220)
            idle = create.evaluate("el=>getComputedStyle(el).backgroundColor")
            surface = teacher.locator(".teacher-welcome").evaluate(
                "el=>getComputedStyle(el).backgroundColor"
            )
            create.hover()
            teacher.wait_for_timeout(190)
            hovered = create.evaluate("el=>getComputedStyle(el).backgroundColor")
            check(
                "Criar turma continua visível no hover escuro",
                idle != hovered and hovered != surface,
            )

            check("Nenhum erro JavaScript", not errors)
            teacher_context.close()
            context.close()
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
