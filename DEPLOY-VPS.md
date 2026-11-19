# Постоянен VPS deployment на Офертикс с личен домейн

Това ръководство публикува production версията на Офертикс на собствен Linux VPS и домейн. Примерите са за Ubuntu/Debian, Node.js 22 и публичното GitHub repository `Manolov9/ofertix`.

> Замени примерите `ofertix.example.com`, `www.example.com`, `203.0.113.10` и `/opt/ofertix`, когато имаш действителния домейн, IP адрес и път. Примерът обслужва двете посочени имена; DNS, Nginx и Certbot трябва да изброяват едни и същи hostnames. Ако ще използваш само едното, махни другото навсякъде. Не изпращай SSH пароли, private keys или GitHub tokens в чат и не ги записвай в repository.

## Какво точно ще работи

Сървърът ще обслужва frontend-а и API-то на Офертикс; Nginx ще приема HTTPS заявките на домейна и ще ги препраща към Node процеса. `systemd` ще стартира приложението след рестарт на VPS-а и ще го пуска отново при срив.

Текущото търсене взема каталожните резултати и изображенията директно от `katalozi-bg.info`. За този режим **не са нужни MySQL/MariaDB, OCR/Tesseract или потребителски вход**. Локалната OCR синхронизация е изключена. Кешът е в паметта на Node процеса и се изгражда отново след рестарт. Ако външният каталожен сайт е бавен, недостъпен или ограничи заявките, търсенето може временно да се забави или да върне грешка; собствен домейнът не премахва тази външна зависимост.

## Необходими неща

- VPS с Ubuntu/Debian, публичен IPv4 адрес и потребител с `sudo`.
- Node.js 22.x, SSH достъп и възможност за изходящ HTTPS трафик.
- Домейн, чийто DNS можеш да редактираш.
- Входящи портове TCP `22` (SSH по подразбиране; използвай твоя порт, ако е сменен), `80` (HTTP за Certbot) и `443` (HTTPS), разрешени и във firewall-а на доставчика на VPS-а.
- Изходящ достъп до GitHub, npm registry/pnpm и `katalozi-bg.info`.

Тук не са нужни AI prompt-ове. Изпълняват се shell командите по-долу, а единствените интерактивни въпроси обикновено са тези на Certbot при издаване на HTTPS сертификата.

## 1. Насочи домейна към VPS-а

В DNS панела на регистратора добави записи към публичния IP на VPS-а. За примерен `ofertix.example.com`:

| Тип | Име/Host | Стойност |
|---|---|---|
| `A` | `ofertix` за `ofertix.example.com`, или `@` за коренния `example.com` | `203.0.113.10` — замени с IP адреса на VPS-а |
| `A` | `www.ofertix` за `www.ofertix.example.com`, или `www` за `www.example.com` (само ако ще ползваш това име) | същият публичен IPv4 |

Ако има стар `AAAA` запис за IPv6, той също трябва да сочи към IPv6 адрес на този VPS; иначе премахни грешния запис. Поискай от доставчика да разреши TCP `22`, `80` и `443`. **Не отваряй публично порт `3000`** — той е само за вътрешната връзка Nginx → Node.

След като DNS се запише, в SSH сесията провери, че домейнът сочи към правилния VPS адрес:

```bash
getent ahostsv4 ofertix.example.com
```

Показаният IPv4 трябва да е адресът на сървъра. Ако ще използваш и `www`, провери и `getent ahostsv4 www.example.com`.

## 2. Влез през SSH и провери Node

От твоя компютър се свържи с потребителя, който ти е създаден на VPS-а (примерът `ubuntu` е само име за пример):

```bash
ssh ubuntu@203.0.113.10
```

На VPS-а:

```bash
whoami
node --version
npm --version
corepack --version
```

За този проект използвай Node `v22.x`. Ако `node` не е Node 22 или липсва `corepack`, първо инсталирай/поправи Node 22 според начина, по който доставчикът ти е настроил VPS-а. Не продължавай, докато `node --version` не показва `v22...`.

## 3. Инсталирай системни пакети и настрой firewall

В SSH сесията:

```bash
sudo apt-get update
sudo apt-get install -y git nginx certbot python3-certbot-nginx curl ca-certificates ufw
```

Ако ползваш UFW, първо разреши SSH, за да не се заключиш извън VPS-а, после разреши Nginx:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw status verbose
# Ако SSH е на custom port, добави правило за него преди UFW enable (пример: 2222/tcp):
# sudo ufw allow 2222/tcp
```

Провери, че правилото за SSH е налице, преди при нужда да включиш UFW:

```bash
sudo ufw enable
sudo ufw status verbose
```

Firewall-ът в контролния панел на VPS доставчика също трябва да допуска портове `22`, `80` и `443`. Не добавяй правило за публичен порт `3000`.
Ако SSH при теб работи на различен порт от стандартния `22`, първо разреши действителния SSH порт, например `sudo ufw allow 2222/tcp`, и чак след това включи UFW.

## 4. Клонирай проекта от GitHub

Repository-то е публично, така че за клониране не се иска GitHub login или token. Работи като обикновения VPS потребител, не като `root`:

```bash
sudo mkdir -p /opt/ofertix
sudo chown "$USER":"$(id -gn)" /opt/ofertix
git clone https://github.com/Manolov9/ofertix.git /opt/ofertix
cd /opt/ofertix
git branch --show-current
git log -1 --oneline
```

Ако `/opt/ofertix` вече съдържа клонираното repository, **не изпълнявай отново** `git clone`; вместо това:

```bash
cd /opt/ofertix
git pull --ff-only origin main
```

## 5. Инсталирай зависимости, провери и изгради production версията

Проектът pin-ва pnpm `10.18.0`. Изпълни:

```bash
cd /opt/ofertix
corepack enable
corepack prepare pnpm@10.18.0 --activate
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm build
```

`corepack pnpm --version` трябва да покаже `10.18.0`. Ако `corepack enable` получи permission error за системна Node инсталация, не изпълнявай цялата инсталация като root; използвай `sudo npm install --global pnpm@10.18.0`, след което провери `pnpm --version`, или настрой Corepack за твоя потребител.

## 6. Създай production `.env`

Създай `.env` в `/opt/ofertix`:

```bash
cd /opt/ofertix
cat > .env <<'ENV'
PORT=3000
NODE_ENV=production
ENV
chmod 600 .env
```

Това е достатъчно за текущото публично търсене. `DATABASE_URL`, Manus OAuth и други credentials не са нужни, освен ако отделно не активираш бъдещи login/database функции. `.env` не трябва да се commit-ва или качва в GitHub.

## 7. Направи първи тест локално на VPS-а

Стартирай приложението временно в SSH прозореца:

```bash
cd /opt/ofertix
corepack pnpm start
```

Отвори **втори SSH прозорец** към същия VPS и провери health и реално търсене:

```bash
curl --fail --show-error http://127.0.0.1:3000/api/health
curl -G 'http://127.0.0.1:3000/api/catalog' \
  --data-urlencode 'q=dolce gusto' \
  --data-urlencode 'category=1'
```

Health трябва да върне `{"status":"ok"}`; заявката за каталог трябва да върне JSON с `sourceMatches` и `offers`. След теста се върни в първия SSH прозорец и натисни `Ctrl+C`.

## 8. Настрой автоматичен старт със systemd

Провери точните стойности за потребител, група и Node executable:

```bash
whoami
id -gn
command -v node
```

Следната команда генерира systemd service с тези стойности. Изпълни я, докато си влязъл като потребителя, който притежава `/opt/ofertix`:

```bash
SERVICE_USER="$(whoami)"
SERVICE_GROUP="$(id -gn)"
NODE_BIN="$(command -v node)"
printf 'User=%s\nGroup=%s\nNode=%s\n' "$SERVICE_USER" "$SERVICE_GROUP" "$NODE_BIN"
sudo tee /etc/systemd/system/ofertix.service >/dev/null <<UNIT
[Unit]
Description=Ofertix live catalog search
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=/opt/ofertix
EnvironmentFile=/opt/ofertix/.env
ExecStart=${NODE_BIN} /opt/ofertix/dist/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
```

Провери, че `Node=` показва абсолютния път до Node 22 и че service сочи към правилните директории, след което активирай услугата:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ofertix
sudo systemctl status ofertix --no-pager
curl --fail --show-error http://127.0.0.1:3000/api/health
```

Приложението вече стартира автоматично след рестарт на VPS-а. При смяна на Node версията през NVM пътят до `node` може да се промени; тогава обнови `ExecStart` в service файла, изпълни `sudo systemctl daemon-reload` и рестартирай услугата.

Полезни команди за състояние и логове:

```bash
sudo systemctl status ofertix --no-pager
sudo journalctl -u ofertix -n 100 --no-pager
sudo journalctl -u ofertix -f
```

## 9. Настрой Nginx reverse proxy за домейна

Отвори конфигурацията:

```bash
sudo nano /etc/nginx/sites-available/ofertix
```

Постави конфигурацията по-долу и замени `ofertix.example.com` и `www.example.com` с действителните домейни. Ако няма да ползваш `www`, махни го и от `server_name`, и от Certbot командата:

```nginx
server {
    listen 80;
    server_name ofertix.example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 45s;
        proxy_send_timeout 45s;
    }
}
```

Запази файла в `nano` с `Ctrl+O`, `Enter`, `Ctrl+X`, активирай го и тествай Nginx:

```bash
sudo ln -sfn /etc/nginx/sites-available/ofertix /etc/nginx/sites-enabled/ofertix
sudo nginx -t
sudo systemctl reload nginx
```

Провери временния HTTP адрес:

```bash
curl -I http://ofertix.example.com
```

Ако отговорът не е успешен, провери DNS, правилата за порт `80` и Nginx лога:

```bash
sudo journalctl -u nginx -n 100 --no-pager
```

## 10. Издай HTTPS сертификат

Изпълни Certbot само след като домейнът сочи към VPS-а и портове `80`/`443` са достъпни отвън:

```bash
sudo certbot --nginx -d ofertix.example.com -d www.example.com
```

Certbot ще поиска имейл за известия, съгласие с условията и избор дали HTTP да пренасочва към HTTPS. Въведи твоя имейл, приеми условията и избери пренасочване към HTTPS. Ако не ползваш `www`, махни втория `-d` аргумент.

Провери сайта и автоматичното обновяване на сертификата:

```bash
curl --fail --show-error https://ofertix.example.com/api/health
sudo certbot renew --dry-run
```

## 11. Финален тест през личния домейн

От компютър или VPS изпълни:

```bash
curl --fail --show-error https://ofertix.example.com/api/health
curl -G 'https://ofertix.example.com/api/catalog' \
  --data-urlencode 'q=dolce gusto' \
  --data-urlencode 'category=1'
```

После отвори `https://ofertix.example.com` в браузър. Провери търсене, категория, най-ниска цена, бадж „НАЙ-ЕВТИНО“ и отваряне/затваряне на прегледа на брошурата.

## 12. Подготви скрипт за бъдещ GitHub update

Този скрипт дърпа `main`, проверява зависимостите и тестовете, прави production build и рестартира услугата само ако всички команди успеят. Създай го в home директорията на VPS потребителя (не вътре в repository):

```bash
cat > "$HOME/deploy-ofertix.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/ofertix"
cd "$APP_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ГРЕШКА: /opt/ofertix има локални промени. Запази ги или ги разреши преди deployment." >&2
  exit 1
fi

git fetch origin
git pull --ff-only origin main
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm build
sudo systemctl restart ofertix
sudo systemctl is-active --quiet ofertix
curl --fail --show-error http://127.0.0.1:3000/api/health
SCRIPT
chmod +x "$HOME/deploy-ofertix.sh"
```

Когато публикуваш нова версия в GitHub, стартирай:

```bash
"$HOME/deploy-ofertix.sh"
```

Ако се поиска `sudo` парола при рестарта, въведи я в SSH терминала. Скриптът спира при неуспешен тест/build и тогава не рестартира стартираната версия. Не задавай `NOPASSWD` за всички `sudo` команди.

## 13. Проверки и отстраняване на чести проблеми

**Сайтът показва 502 Bad Gateway:**

```bash
sudo systemctl status ofertix --no-pager
sudo journalctl -u ofertix -n 100 --no-pager
curl -v http://127.0.0.1:3000/api/health
sudo nginx -t
```

Провери, че услугата работи, че `PORT=3000` е в `.env`, и че Nginx сочи към `127.0.0.1:3000`.

**Certbot не издава сертификат:** провери, че всички домейни в `server_name` сочат към правилния IPv4, че няма погрешен `AAAA` запис и че портове `80` и `443` са разрешени както във firewall-а на VPS-а, така и в контролния панел на доставчика.

**Health работи, но търсенето връща грешка/се бави:** Node и Nginx са стартирани, но приложението зависи от външния `katalozi-bg.info`. Провери интернет/DNS от VPS-а и логовете. Health endpoint проверява само Офертикс, не и наличността на каталожния сайт.

**Сайтът не се рестартира след промяна:** изпълни `sudo systemctl daemon-reload`, после `sudo systemctl restart ofertix`; виж причината с `sudo journalctl -u ofertix -n 100 --no-pager`.

## Архитектурна бележка

Собственият домейн и VPS правят сайта постоянно достъпен от твоя сървър, но не копират каталожните данни локално и не гарантират нулево време за зареждане: самите резултати и preview изображения идват от външния каталог. В текущия режим няма база с локални каталози за backup; след рестарт кешът просто се запълва наново от външния източник.
