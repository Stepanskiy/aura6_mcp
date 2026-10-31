# Аура 6 — демо-прототип

Управлінський облік проєктів у браузері: каталог SPA, проєкти, імпорт бюджетів з Excel за допомогою моделі (OpenRouter), фінальні суми, версії плану, рахунки клієнтам з друкованою формою, конструктор звітів, чат-помічник. Без сервера: дані в localStorage.

Опис, межі й сценарій показу — [drafts/варіант-управлінський-облік/14-демо-прототип.md](../drafts/варіант-управлінський-облік/14-демо-прототип.md).

```
npm install
npm run dev        # http://localhost:5173
npm run samples    # перегенерувати samples/*.xlsx
npm run build      # статична збірка в dist/
node --experimental-strip-types scripts/test-import.ts   # тест імпорту на зразках
```

Структура: `src/domain` — типи й чисті розрахунки; `src/store.ts` — правила запису; `src/shell` — каталог, вхід, контракт запуску SPA; `src/features/*` — SPA; `src/llm` — адаптер OpenRouter; `src/data/seed.ts` — демо-дані.
