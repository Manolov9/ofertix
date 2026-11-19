# Офертикс

Офертикс е българска търсачка за актуални брошури в [katalozi-bg.info](https://katalozi-bg.info/companies). Търсенето се изпълнява динамично към каталожния източник; приложението показва съвпадащите брошури в source реда, наличната най-ниска разпозната цена и преглед на намерената страница.

## Как работи текущият режим

- Търси продукт във външните каталози по фраза, магазин, категория и период.
- Показва каталожни карти, магазин, страница и брой намерени съвпадения.
- Извлича ценови етикет само когато текстът, върнат от източника, съдържа сума с валута. Показва най-ниската разпозната цена и магазина в горната обобщаваща лента, а съответната брошура запазва зеления бадж „НАЙ-ЕВТИНО“.
- Не показва отделен списък с ценови редове. Клик върху брошура отваря намерената страница в затваряем прозорец; от него може да се отвори и оригиналният резултат в katalozi-bg.info.
- Не изисква потребителски вход, MySQL база или локално OCR за търсенето.

Цените се извличат от текстовия индекс на външния сайт, не чрез OCR на сървъра на Офертикс. Текстът на източника може да съдържа OCR шум; неясните суми без валута не се показват като цени. Различни разфасовки и единици не се преизчисляват към обща цена за килограм/опаковка. Проверявай крайната цена, разфасовката и срока в оригиналната брошура.

Локалният OCR pipeline остава в кода за евентуално бъдещо обработване на собствени каталози, но не е част от текущия публичен поток. Няма бутон за синхронизация, а `POST /api/sync` връща HTTP `410 Gone`, за да не стартира тежка OCR задача публично.

## Кеш и свежест

Външните заявки се кешират в паметта на Node процеса по търсене и категория. Резултатът е свеж 5 минути; след това може да се подава stale резултат до още 55 минути, докато се обновява във фонов режим. Еднакви конкурентни заявки се обединяват, а кешът е ограничен до 200 ключа. Първата заявка за нов продукт зависи от наличността и скоростта на външния сайт. Кешът е временен и се изгражда отново след рестарт — каталоговите данни не се губят, защото се зареждат наново от източника.

## Технологии и изисквания

- React, TypeScript и Vite за интерфейса.
- Node.js 22, Express и tRPC за сървъра.
- pnpm 10.18.
- Изходящ HTTPS достъп до `katalozi-bg.info`.

За публично търсене не са нужни MySQL/MariaDB или Tesseract. `DATABASE_URL` се използва само от останалите опционални platform/auth функции; не е нужен за каталожните резултати.

## Локално стартиране

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
```

За development стартирай Vite командата; `.env` не е задължителен. Production `.env` е показан в ръководството за VPS по-долу.

Минималният `.env` за локално/production търсене:

```env
PORT=3000
NODE_ENV=production
```

Стартирай в development режим:

```bash
pnpm dev
```

Или направи production build:

```bash
pnpm build
pnpm start
```

Провери health endpoint и директно търсене:

```bash
curl http://127.0.0.1:3000/api/health
curl -G 'http://127.0.0.1:3000/api/catalog' \
  --data-urlencode 'q=кафе' \
  --data-urlencode 'category=1'
```

`/api/health` връща `{"status":"ok"}`. `/api/catalog` връща `sourceMatches` от каталожния сайт и `offers` само за източникови попадения с разпозната валутна цена. Наличните категории и техните ID-та са в `shared/catalog-categories.ts`.

## Подробен пример: Linux VPS с Node.js

Примерът е за Ubuntu/Debian VPS с вече инсталиран Node.js 22. За самото live search не инсталирай MySQL, Tesseract или OCR worker. За домейн и HTTPS ще се използват Nginx и Let's Encrypt.

Пълното ръководство за DNS, firewall, systemd, Nginx, HTTPS, GitHub обновяване, проверки и troubleshooting е в [DEPLOY-VPS.md](DEPLOY-VPS.md). Следвай него като основна инструкция; примерът по-долу е съкратен.

### 1. Инсталирай системните пакети и клонирай проекта

```bash
sudo apt-get update
sudo apt-get install -y git nginx certbot python3-certbot-nginx ufw
sudo mkdir -p /opt/ofertix
sudo chown "$USER":"$(id -gn)" /opt/ofertix
git clone https://github.com/Manolov9/ofertix.git /opt/ofertix
cd /opt/ofertix
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
```

Ако repository-то вече е клонирано в `/opt/ofertix`, не повтаряй `git clone`; изпълнявай останалите команди в съществуващата директория. Deployment командите се изпълняват като обикновен Linux потребител, не като `root`.

### 2. Настрой `.env` и изгради приложението

```bash
cd /opt/ofertix
nano .env
```

```env
PORT=3000
NODE_ENV=production
```

Ограничи достъпа до файла, ако добавиш други secrets за опционални функции:

```bash
chmod 600 .env
pnpm build
```

За каталожното търсене не изпълнявай database migrations. Не добавяй пароли или secrets към GitHub.

### 3. Тествай Node сървъра

Стартирай временно:

```bash
pnpm start
```

От втори SSH прозорец провери:

```bash
curl http://127.0.0.1:3000/api/health
curl -G 'http://127.0.0.1:3000/api/catalog' \
  --data-urlencode 'q=кафе' \
  --data-urlencode 'category=1'
```

След теста спри временния процес с `Ctrl+C`.

### 4. Настрой автоматично стартиране със systemd

Провери потребителя и пътищата:

```bash
whoami
id -gn
command -v node
command -v pnpm
```

Създай `/etc/systemd/system/ofertix.service`, замени потребителя/групата с резултатите от предните команди и постави в `ExecStart` абсолютния път, върнат от `command -v node` (не само думата `node`):

```ini
[Unit]
Description=Ofertix live catalog search
After=network.target

[Service]
Type=simple
User=ЗАМЕНИ_С_LINUX_ПОТРЕБИТЕЛ
Group=ЗАМЕНИ_С_LINUX_ГРУПА
WorkingDirectory=/opt/ofertix
EnvironmentFile=/opt/ofertix/.env
ExecStart=/ABSOLUTE/PATH/TO/node /opt/ofertix/dist/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Точният път в `ExecStart` позволява услугата да работи и когато Node е инсталиран с `nvm`; при обновяване на Node версията провери дали този път не се е променил.

Включи и провери услугата:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ofertix
sudo systemctl status ofertix --no-pager
sudo journalctl -u ofertix -f
```

### 5. Свържи домейн и HTTPS чрез Nginx

Настрой DNS `A` запис на домейна към публичния IPv4 адрес на VPS-а. След като DNS се разпространи, създай `/etc/nginx/sites-available/ofertix` и замени домейна:

```nginx
server {
    listen 80;
    server_name ofertix.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активирай конфигурацията и издай TLS сертификат:

```bash
sudo ln -s /etc/nginx/sites-available/ofertix /etc/nginx/sites-enabled/ofertix
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d ofertix.example.com
```

Във firewall-а разреши SSH, HTTP `80` и HTTPS `443`; първо добави SSH правилото, за да не се заключиш извън сървъра:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw status verbose
sudo ufw enable
sudo ufw status verbose
```

Разреши същите TCP портове и във firewall-а на VPS доставчика. Не отваряй порт `3000` публично и не е нужно MySQL `3306` за този режим.

### 6. Обновявай приложението

```bash
cd /opt/ofertix
git pull --ff-only
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
sudo systemctl restart ofertix
sudo systemctl status ofertix --no-pager
```

## Проверки и ограничения

```bash
pnpm check
pnpm test
pnpm build
```

Публичният сайт е без login. Резултатите зависят от достъпността и съдържанието на katalozi-bg.info; кеширането ускорява повтарящи се заявки, но не гарантира скоростта на първата заявка или непрекъсната наличност на външния сайт. Точната цена и условията се проверяват чрез кликаемата връзка към оригиналния източник.

При бъдеща нужда от OCR за собствени качени каталози той трябва да се добави като отделен, контролиран workflow, с Tesseract и подходящи ресурси. Текущата публична инсталация не стартира OCR.

## Основни команди

```bash
pnpm dev       # development server с Vite
pnpm check     # TypeScript проверка
pnpm test      # unit тестове
pnpm build     # production build
pnpm start     # production server
```

## Източник

Каталожните резултати и изображенията се зареждат от [katalozi-bg.info](https://katalozi-bg.info/companies). Данните и условията за използване на външния източник са предмет на правилата на съответния сайт.
