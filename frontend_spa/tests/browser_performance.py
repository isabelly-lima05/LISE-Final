"""Baseline local de resposta das telas e fluidez das animações do LISE."""

import json
import logging
import statistics
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright
from werkzeug.serving import make_server

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from run_demo import create_demo_app


def percentile(values, fraction=0.95):
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, round((len(ordered) - 1) * fraction)))]


def summary(values):
    return {
        "first_ms": round(values[0], 1),
        "median_ms": round(statistics.median(values), 1),
        "p95_ms": round(percentile(values), 1),
        "samples": len(values),
    }


def frame_summary(values):
    return {
        "frames": len(values),
        "median_ms": round(statistics.median(values), 2) if values else 0,
        "p95_ms": round(percentile(values), 2),
        "max_ms": round(max(values), 2) if values else 0,
        "over_25ms": sum(value > 25 for value in values),
        "over_50ms": sum(value > 50 for value in values),
    }


def click_to_ready(page, trigger, ready):
    page.evaluate("performance.clearMarks('lise-route-start')")
    trigger.evaluate(
        "el=>{performance.mark('lise-route-start');el.click()}"
    )
    ready()
    page.evaluate(
        "()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))"
    )
    return page.evaluate(
        "performance.now()-performance.getEntriesByName('lise-route-start').at(-1).startTime"
    )


def nav_button(page, name):
    return page.get_by_role("button", name=name, exact=True)


def biologia_card(page):
    return page.locator(".specimen-card").filter(
        has=page.locator(".word-name", has_text="Biologia")
    )


def sample_frames(page, selector, duration=420):
    return page.evaluate(
        """async ({selector,duration}) => {
          const target=document.querySelector(selector);
          if(!target)throw new Error(`Controle ausente: ${selector}`);
          const frames=[];
          let start=0,last=0;
          const done=new Promise(resolve=>{
            const tick=now=>{
              if(!start)start=now;
              if(last)frames.push(now-last);
              last=now;
              if(now-start>=duration)resolve();else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          target.click();
          await done;
          return frames;
        }""",
        {"selector": selector, "duration": duration},
    )


def install_observers(context):
    context.add_init_script(
        """(() => {
          window.__lisePerf={longTasks:[],layoutShifts:[]};
          try { new PerformanceObserver(list=>window.__lisePerf.longTasks.push(
            ...list.getEntries().map(entry=>({duration:entry.duration,
              startTime:entry.startTime,name:entry.name}))
          )).observe({type:'longtask',buffered:true}); } catch(_error) {}
          try { new PerformanceObserver(list=>window.__lisePerf.layoutShifts.push(
            ...list.getEntries().filter(entry=>!entry.hadRecentInput).map(entry=>entry.value)
          )).observe({type:'layout-shift',buffered:true}); } catch(_error) {}
        })()"""
    )


def allow_local_requests(context, base):
    context.route(
        "**/*",
        lambda route: route.continue_()
        if route.request.url.startswith(base + "/")
        else route.abort(),
    )


def login(page, base):
    page.goto(base, wait_until="load")
    navigation = page.evaluate(
        """() => {const n=performance.getEntriesByType('navigation')[0];return {
          dom_content_loaded:n.domContentLoadedEventEnd,
          load:n.loadEventEnd,
          transfer:n.transferSize,
          decoded:n.decodedBodySize
        }}"""
    )
    startup = page.evaluate(
        """() => {
          const resources=performance.getEntriesByType('resource').map(entry=>({
            path:new URL(entry.name).pathname,duration:entry.duration,
            transfer:entry.transferSize,decoded:entry.decodedBodySize
          }));
          return {
            requests:resources.length,
            transfer:resources.reduce((total,item)=>total+item.transfer,0),
            decoded:resources.reduce((total,item)=>total+item.decoded,0),
            slowest:[...resources].sort((a,b)=>b.duration-a.duration).slice(0,8)
          };
        }"""
    )
    page.locator("[name=email]").fill("aluno@lise.demo")
    page.locator("[name=password]").fill("LiseDemo123!")
    start = time.perf_counter()
    page.locator("[data-form=login] [type=submit]").click()
    page.locator(".student-greeting").wait_for()
    page.evaluate(
        "()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))"
    )
    return navigation, (time.perf_counter() - start) * 1000, startup


def main():
    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    app = create_demo_app(database_url="sqlite:///:memory:")
    server = make_server("127.0.0.1", 0, app)
    base = f"http://127.0.0.1:{server.server_port}"
    app.config.update(FRONTEND_URL=base, FRONTEND_ORIGINS=base)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    results = {
        "environment": {
            "browser": "Microsoft Edge/Chromium",
            "viewport": "1366x900",
            "server": "Flask local + SQLite em memória",
            "iterations": 5,
        },
        "routes": {},
        "animations": {},
        "runtime": {},
    }
    errors = []

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="msedge")
            context = browser.new_context(
                viewport={"width": 1366, "height": 900}, locale="pt-BR"
            )
            install_observers(context)
            allow_local_requests(context, base)
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            navigation, login_ms, startup = login(page, base)
            results["document"] = {
                key: round(value, 1) for key, value in navigation.items()
            }
            results["login_ready_ms"] = round(login_ms, 1)
            results["startup_resources"] = {
                "requests": startup["requests"],
                "transfer_kb": round(startup["transfer"] / 1024, 1),
                "decoded_kb": round(startup["decoded"] / 1024, 1),
                "slowest": [
                    {
                        "path": item["path"],
                        "duration_ms": round(item["duration"], 1),
                        "decoded_kb": round(item["decoded"] / 1024, 1),
                    }
                    for item in startup["slowest"]
                ],
            }

            samples = {
                "dashboard": [],
                "explore": [],
                "term_detail": [],
                "collections": [],
                "classes": [],
                "games": [],
                "account": [],
            }

            for _round in range(5):
                samples["dashboard"].append(
                    click_to_ready(
                        page,
                        nav_button(page, "Início"),
                        lambda: page.locator(".student-greeting").wait_for(),
                    )
                )
                samples["explore"].append(
                    click_to_ready(
                        page,
                        nav_button(page, "Explorar"),
                        lambda: page.locator(".specimen-card").first.wait_for(),
                    )
                )
                samples["term_detail"].append(
                    click_to_ready(
                        page,
                        biologia_card(page).get_by_role(
                            "button", name="Investigar palavra"
                        ),
                        lambda: page.locator(".term-shared-surface").wait_for(),
                    )
                )
                page.locator("[data-action=detail-back]").click()
                page.locator(".specimen-card").first.wait_for()
                samples["collections"].append(
                    click_to_ready(
                        page,
                        nav_button(page, "Coleções"),
                        lambda: page.get_by_role(
                            "heading", name="Coleções", exact=True
                        ).wait_for(),
                    )
                )
                samples["classes"].append(
                    click_to_ready(
                        page,
                        nav_button(page, "Turmas"),
                        lambda: page.get_by_role(
                            "heading", name="Turmas", exact=True
                        ).wait_for(),
                    )
                )
                samples["games"].append(
                    click_to_ready(
                        page,
                        nav_button(page, "Praticar"),
                        lambda: page.get_by_role(
                            "heading", name="Praticar", exact=True
                        ).wait_for(),
                    )
                )
                samples["account"].append(
                    click_to_ready(
                        page,
                        page.locator(".side-account:visible"),
                        lambda: page.get_by_role(
                            "heading", name="Minha conta", exact=True
                        ).wait_for(),
                    )
                )

            results["routes"] = {
                name: summary(values) for name, values in samples.items()
            }

            resources = page.evaluate(
                """() => performance.getEntriesByType('resource')
                  .filter(entry=>entry.name.includes('/api/v1/'))
                  .map(entry=>({name:entry.name,duration:entry.duration,
                    transfer:entry.transferSize,decoded:entry.decodedBodySize}))"""
            )
            grouped = {}
            for resource in resources:
                path = urlparse(resource["name"]).path.replace("/api/v1", "")
                path = path.replace("/explore/terms/1", "/explore/terms/:id")
                grouped.setdefault(path, []).append(resource["duration"])
            results["api"] = {
                path: summary(values) for path, values in sorted(grouped.items())
            }

            nav_button(page, "Explorar").click()
            page.locator(".specimen-card").first.wait_for()
            page.evaluate(
                """() => {
                  window.__motionCalls=[];
                  const original=window.LiseInteractions.motion;
                  window.LiseInteractions.motion=(element,frames,options={})=>{
                    window.__motionCalls.push({frames,options});
                    return original(element,frames,options);
                  };
                }"""
            )
            search = page.locator("#explore-search")
            search.fill("auto")
            page.wait_for_timeout(300)
            search.fill("")
            page.wait_for_timeout(300)
            stagger = page.evaluate(
                """() => window.__motionCalls.filter(call=>
                  call.frames?.[0]?.transform==='translateY(10px)'
                ).map(call=>call.options)"""
            )
            results["animations"]["stagger"] = {
                "cards": len(stagger),
                "duration_ms": stagger[0]["duration"] if stagger else 0,
                "max_delay_ms": max(
                    (item.get("delay", 0) for item in stagger), default=0
                ),
                "easing": stagger[0]["easing"] if stagger else "",
            }

            page.evaluate(
                """() => {
                  window.__vtDuration=null;
                  const original=document.startViewTransition?.bind(document);
                  if(original)document.startViewTransition=callback=>{
                    const start=performance.now(),transition=original(callback);
                    transition.finished.finally(()=>window.__vtDuration=performance.now()-start);
                    return transition;
                  };
                }"""
            )
            biologia_card(page).get_by_role(
                "button", name="Investigar palavra"
            ).click()
            page.wait_for_function("window.__vtDuration!==null")
            results["animations"]["shared_view_transition_ms"] = round(
                page.evaluate("window.__vtDuration"), 1
            )
            page.locator("[data-action=detail-back]").click()
            page.locator(".specimen-card").first.wait_for()

            frame_normal = sample_frames(
                page,
                '[data-action="explore-mode"][data-mode="study"]',
            )
            results["animations"]["frames_normal"] = frame_summary(frame_normal)
            observed_before_cpu = page.evaluate("structuredClone(window.__lisePerf)")
            page.locator(
                '[data-action="explore-mode"][data-mode="browse"]'
            ).click()

            cdp = context.new_cdp_session(page)
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
            frame_throttled = sample_frames(
                page,
                '[data-action="explore-mode"][data-mode="study"]',
            )
            results["animations"]["frames_cpu_4x"] = frame_summary(
                frame_throttled
            )
            page.locator(
                '[data-action="explore-mode"][data-mode="browse"]'
            ).click()
            cpu_routes = {"explore": [], "term_detail": []}
            for _round in range(3):
                nav_button(page, "Início").click()
                page.locator(".student-greeting").wait_for()
                cpu_routes["explore"].append(
                    click_to_ready(
                        page,
                        nav_button(page, "Explorar"),
                        lambda: page.locator(".specimen-card").first.wait_for(),
                    )
                )
                browse = page.locator(
                    '[data-action="explore-mode"][data-mode="browse"]'
                )
                if browse.get_attribute("aria-pressed") != "true":
                    browse.click()
                    page.locator(".specimen-card .word-name").first.wait_for()
                cpu_routes["term_detail"].append(
                    click_to_ready(
                        page,
                        biologia_card(page).get_by_role(
                            "button", name="Investigar palavra"
                        ),
                        lambda: page.locator(".term-shared-surface").wait_for(),
                    )
                )
                page.wait_for_function(
                    "document.documentElement.dataset.termTransition!=='true'"
                )
                page.locator("[data-action=detail-back]").click()
                page.locator(".specimen-card").first.wait_for()
            results["routes_cpu_4x"] = {
                name: summary(values) for name, values in cpu_routes.items()
            }
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})

            observed = page.evaluate("window.__lisePerf")
            normal_tasks = observed_before_cpu["longTasks"]
            cpu_tasks = observed["longTasks"][len(normal_tasks) :]
            normal_longest = max(
                normal_tasks, key=lambda item: item["duration"], default=None
            )
            cpu_longest = max(
                cpu_tasks, key=lambda item: item["duration"], default=None
            )
            results["runtime"] = {
                "normal": {
                    "long_tasks": len(normal_tasks),
                    "longest_task_ms": round(normal_longest["duration"], 1)
                    if normal_longest
                    else 0,
                },
                "cpu_4x": {
                    "long_tasks": len(cpu_tasks),
                    "longest_task_ms": round(cpu_longest["duration"], 1)
                    if cpu_longest
                    else 0,
                },
                "layout_shift_score": round(sum(observed["layoutShifts"]), 4),
                "javascript_errors": errors,
            }

            reduced = browser.new_context(
                viewport={"width": 1366, "height": 900},
                locale="pt-BR",
                reduced_motion="reduce",
            )
            allow_local_requests(reduced, base)
            reduced_page = reduced.new_page()
            login(reduced_page, base)
            nav_button(reduced_page, "Explorar").click()
            reduced_page.locator(".specimen-card").first.wait_for()
            reduced_page.evaluate(
                """() => {
                  window.__reducedVt=0;
                  const original=document.startViewTransition?.bind(document);
                  if(original)document.startViewTransition=callback=>{
                    window.__reducedVt++;
                    return original(callback);
                  };
                }"""
            )
            biologia_card(reduced_page).get_by_role(
                "button", name="Investigar palavra"
            ).click()
            reduced_page.locator(".term-shared-surface").wait_for()
            results["animations"]["reduced_motion"] = {
                "shared_transitions": reduced_page.evaluate("window.__reducedVt"),
                "active_animations": reduced_page.evaluate(
                    "document.getAnimations().filter(a=>a.playState==='running').length"
                ),
                "media_matches": reduced_page.evaluate(
                    "matchMedia('(prefers-reduced-motion: reduce)').matches"
                ),
            }

            reduced.close()
            context.close()
            browser.close()
    finally:
        server.shutdown()

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
