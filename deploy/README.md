# Розгортання PoC-стенду Аури 6 на VPS

Сервер: vpsag.com, VPS-118217, Ubuntu 22, 1 ядро, 2 ГБ RAM, 20 ГБ диска.

Що піднімається: PostgreSQL, Keycloak (OAuth/OIDC) і Caddy, який сам отримує HTTPS-сертифікати Let's Encrypt. MCP-сервер Аури додається пізніше, коли з'явиться код.

## Бюджет памʼяті

| Сервіс | RAM |
|---|---|
| Ubuntu + Docker | ~300 МБ |
| PostgreSQL | до 384 МБ |
| Keycloak | до 768 МБ (heap 512 МБ) |
| Caddy | ~30 МБ |
| MCP-сервер Аури (пізніше) | ~150–250 МБ |
| **Разом** | **~1,7 ГБ** + 2 ГБ swap як запас |

Впритул, але для PoC достатньо. Якщо `free -h` покаже постійне використання swap або Keycloak падатиме з OOM, переходьте на тариф з 4 ГБ.

## 0. Перевірити, що вже працює на сервері

Панель показує 1,72 ГБ зайнятої памʼяті й 95 ГБ трафіку, тож на сервері, ймовірно, вже щось працює. Перед розгортанням:

```bash
free -h                      # скільки памʼяті реально зайнято (buff/cache не рахується)
df -h /                      # вільне місце на диску
sudo ss -tlnp                # що слухає порти, особливо 80 і 443
docker ps 2>/dev/null        # чи є вже контейнери
systemctl list-units --type=service --state=running
```

Якщо порти 80/443 уже зайняті (nginx, apache, інший сайт), Caddy не запуститься. Тоді Аура має йти або за існуючий веб-сервер, або на окремий VPS.

## 1. Домен і DNS

Потрібен справжній домен: на нього дивляться OAuth і CSP, а `v118217-vps.local` назовні не резолвиться. Створіть у DNS два A-записи на IP сервера:

```
auth.<ваш-домен>  →  IP VPS
mcp.<ваш-домен>   →  IP VPS
```

Перевірка з будь-якої машини: `nslookup auth.<ваш-домен>`.

## 2. Базове налаштування сервера

Скопіювати папку `deploy` на сервер і запустити скрипт:

```bash
scp -r deploy root@<IP>:/opt/aura
ssh root@<IP>
cd /opt/aura
sudo bash server-setup.sh
```

Скрипт оновлює систему, додає 2 ГБ swap, ставить Docker з офіційного репозиторію й відкриває у firewall тільки порти 22, 80 і 443.

Рекомендовано окремо, вручну: вхід по SSH-ключу замість пароля. Спершу перевірте, що вхід по ключу працює, і тільки потім вимикайте пароль у `/etc/ssh/sshd_config` (`PasswordAuthentication no`). Інакше можна втратити доступ до сервера.

## 3. Конфігурація

```bash
cd /opt/aura
cp .env.example .env
nano .env        # домени, пошта, паролі
```

Паролі згенерувати: `openssl rand -base64 24`.

## 4. Запуск

```bash
docker compose up -d
docker compose ps
docker compose logs -f keycloak    # Ctrl+C для виходу
```

Перший старт Keycloak займає 1–2 хвилини.

## 5. Перевірка

- `https://mcp.<ваш-домен>` → «Aura 6 MCP: not deployed yet» з валідним сертифікатом.
- `https://auth.<ваш-домен>` → сторінка входу Keycloak, вхід під `KEYCLOAK_ADMIN`.
- `free -h` — скільки памʼяті лишилось.

## 6. Налаштування Keycloak під PoC

1. Створити realm `aura`.
2. Створити користувачів для тестових ролей: еккаунт, НЕО, ФД.
3. Створити realm-ролі `account`, `head_of_account`, `fin_director` і призначити їх користувачам.
4. Клієнти Claude і ChatGPT реєструються через Dynamic Client Registration. У realm `aura` → Clients → Client registration → Anonymous access policies → Trusted Hosts додати хости Anthropic і OpenAI. Точні значення уточнимо на першому тижні PoC за актуальною документацією коннекторів.

## Резервні копії

Хостинг робить знімки VPS (у панелі — 2 бекапи). Додатково — щоденний дамп бази:

```bash
mkdir -p /opt/aura/backups
crontab -e
# додати рядок:
0 3 * * * cd /opt/aura && docker compose exec -T postgres pg_dumpall -U aura | gzip > backups/pg-$(date +\%F).sql.gz && find backups -mtime +14 -delete
```

## Оновлення

```bash
cd /opt/aura
docker compose pull
docker compose up -d
```
