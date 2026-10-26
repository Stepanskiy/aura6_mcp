# 5. Тенденції MCP і альтернативи

## Куди рухається MCP

- У грудні 2025 Anthropic передала MCP у Linux Foundation (Agentic AI Foundation). Співзасновники — Anthropic, OpenAI, Block; підтримують Google, Microsoft, AWS, Cloudflare.
- Клієнти: ChatGPT, Claude, Microsoft Copilot, Gemini, Cursor, VS Code.
- SDK має десятки мільйонів завантажень на тиждень.

На горизонті 2–3 років протокол нікуди не зникне. Ризик залежності зміщується з протоколу на **ліцензії клієнтів** (Claude Team / ChatGPT Business на кожного співробітника).

## Як протокол еволюціонує

- **Code Mode** (Cloudflare, Anthropic, осінь 2025). Замість десятків tool-викликів агент пише короткий скрипт проти SDK у пісочниці, модель бачить тільки результат. Cloudflare так віддав увесь свій API через два tools: `search` і `execute`. Для Аури з ~700 обʼєктами це пряма відповідь на проблему «занадто багато tools», і водночас проміжні дані не потрапляють у контекст. Застереження: потрібна надійна пісочниця; для невеликої кількості tools звичайні виклики простіші.
- **Agent Skills** — переносимі знання домену як файли, не привʼязані до MCP. Глосарій Аури (Ф2/Ф3/Ф4, AVB, PRIPS, кривий платіж) живе тут і працює в будь-якому клієнті.
- **Stateless HTTP** (специфікація 2026-07-28). MCP-сервер дедалі більше схожий на звичайний HTTP API зі схемою.
- **A2A** — протокол агент-до-агента. Для Аури поки нерелевантно.

## Висновок

Усі тренди зводяться до одного: виграє той, у кого є добре описаний звичайний API плюс SDK, а протокол доступу — тонкий адаптер. Звідси принцип архітектури в [02-архітектура.md](02-архітектура.md): ядро — REST + SDK, MCP — один з адаптерів. Користувацькі SPA ходять у REST і від MCP не залежать зовсім.

## План Б

- **Власний агент** (Claude Agent SDK / Managed Agents) на своїй інфраструктурі, з чатом у Teams — HTTP-сервіс MSTeams в Аурі 3 вже є. Суперечить принципу «без власного інтерфейсу», зате повністю вирішує питання транзиту даних і ліцензій на користувача. Кандидат для зарплатного модуля, якщо прототип покаже, що iframe-автентифікація в хостах не працює.
- **Copilot у Teams** як клієнт: той самий MCP-сервер, але користувачі залишаються в уже оплаченому M365. Перевірити наявність відповідних ліцензій.

## Джерела

- [Agentic AI Foundation](https://intuitionlabs.ai/articles/agentic-ai-foundation-open-standards), [MCP adoption statistics](https://gravity.fast/data/mcp-adoption-statistics/), [MCP roadmap 2026](https://a2a-mcp.org/blog/mcp-2026-roadmap), [MCP vs A2A](https://atlan.com/know/agent-interoperability-protocols/)
- [MCP Spec 2026-07-28 — Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [сесії прибрано](https://ppc.land/mcp-forces-ad-tech-to-rebuild-agent-servers-as-sessions-disappear/), [огляд специфікації](https://pub.towardsai.net/model-context-protocols-2026-07-28-spec-puts-governance-before-speed-2b240295a1c5)
- [MCP Apps — Thoughtworks Radar](https://www.thoughtworks.com/radar/platforms/mcp-apps), [MCP Apps ecosystem](https://glama.ai/mcp/servers/@markster-exec/mcp-unicorn/blob/ddbb82559bb5f1a082923dc01665846ee976ecbc/research/tech/mcp-apps-ecosystem.md)
- [Cloudflare: Code Mode](https://cfl.re/4rZwWJp), [Classic MCP vs Code Mode](https://www.getmaxim.ai/articles/classic-mcp-vs-code-mode-a-side-by-side-comparison/), [Code execution with MCP](https://getmaxim.ai/articles/code-execution-with-mcp-how-code-mode-cuts-agent-token-costs-by-90/), [Nordic APIs](https://nordicapis.com/how-code-mode-builds-on-mcp-for-agent-tooling/), [критика Code Mode](https://contextbolt.com/blog/code-mode-mcp/)
