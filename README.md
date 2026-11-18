# Офертикс

Офертикс е български сайт за търсене на продукти и сравнение на оферти в каталозите на [katalozi-bg.info](https://katalozi-bg.info/companies). Той съчетава резултати от търсенето в източника с локален продуктов индекс, извлечен от страниците на брошурите чрез OCR.

## Какво може сайтът

- Търси продукти и многословни фрази в каталожните резултати и индексираните OCR оферти. Думите във фразата се търсят заедно в един контекст, а търсенето не различава главни и малки букви.
- Показва оригиналните каталожни карти, магазин, страница, период и валидност на брошурата, с връзки към резултата и страницата в източника.
- Предоставя филтри по магазин и период, както и сортиране на наличните ценови оферти.
- Съпоставя изписването на цената от брошурата; разпознава цени в левове и евро и използва числова стойност за сортиране.
- Позволява обновяване на каталога от бутона **„Синхронизирай“**. Статусът и прогресът на обработката се виждат в приложението.

## Ръководство за потребителя

### Кога да натисна „Синхронизирай“?

Не е необходимо да натискаш бутона при всяко посещение. При стартиране приложението зарежда последния успешно записан индекс от MySQL, ако е конфигурирана база данни. Натисни **„Синхронизирай“**, когато искаш да провериш за нови брошури — например веднъж дневно или след публикуване на нови оферти.

Синхронизацията може да отнеме време: страниците на каталозите са изображения и продуктите се извличат чрез OCR. Докато обработката тече, приложението показва етапа и броя обработени елементи. Не стартирай нова синхронизация, докато текущата не приключи. Последният успешно активиран индекс остава достъпен, докато новият не завърши.

При публична инсталация синхронизацията е обща за всички посетители. Натискането на бутона от един потребител стартира обновяване за сайта, а останалите виждат същия статус и данни. Защита от повторно стартиране има в рамките на един backend процес; вижте бележката за няколко инстанции по-долу.

### Как да търся и филтрирам?

Въведи име на продукт или фраза, например `кафе`, `кафе капсули`, `кисело мляко` или `кока кола`, след което натисни Enter или бутона за търсене. Избери магазин или период, за да ограничиш резултатите. Периодите включват всички, тази седмица, следващата седмица и приключили каталози.

Каталожните резултати могат да се появят и преди да има локално OCR индексиране. Детайлните оферти и сортирането по цена са налични, когато има подходящи данни от източника или успешен локален OCR индекс. Офертата води към оригиналната страница в брошурата; проверявай там крайната цена, разфасовката и срока на валидност.

Ако приложението показва, че няма зареден продуктов индекс, стартирай синхронизацията и изчакай нейния успешен край. При конфигурирана база данни индексът се запазва между рестартиранията. Без база данни каталогът е временен и се губи при рестарт.

## Техническа архитектура

- **Клиент:** React, TypeScript, Vite.
- **Сървър:** Node.js, Express, TypeScript и tRPC.
- **Постоянно хранилище:** MySQL или съвместима MariaDB чрез `mysql2` и Drizzle ORM.
- **Извличане на текст:** Tesseract OCR с езиците български и английски (`bul+eng`).
- **Външен източник:** публичните страници и изображения на `katalozi-bg.info`.

Каталогът се пази в MySQL, а изображенията се използват чрез URL адреси към източника. При синхронизацията се записва нов run; той става активен след успешното завършване. Ако обновяването прекъсне, последният активен run остава наличен. Без `DATABASE_URL` приложението може да стартира, но постоянният индекс и статусът не се запазват.

### Основни таблици

| Таблица | Предназначение |
| --- | --- |
| `users` | Потребители за OAuth/session функционалността на стартовата платформа; търсенето в каталога не изисква вход. |
| `catalog_stores` | Магазини, ред на показване, адреси, лога и активност. |
| `catalog_brochures` | Брошури, магазини, периоди, дати и URL адреси на страниците. |
| `catalog_sync` | Текущ статус, прогрес, броячи и ID на активния run. |
| `catalog_offers` | OCR оферти и техният `runId`; `price` се използва за сортиране, а `priceLabel` пази текста за показване. |

`drizzle/schema.ts` е източникът на истината за схемата. SQL миграциите са в директорията `drizzle/`.

## Стартиране на собствен сървър

### Изисквания

- Linux сървър/VPS или Docker host;
- Node.js 22 (съвпада с версията в `Dockerfile`) и pnpm 10.18;
- MySQL 8+ или съвместима MariaDB;
- Tesseract OCR с пакетите `bul` и `eng`;
- изходящ интернет достъп до `katalozi-bg.info`.

Ако инсталираш директно на Debian/Ubuntu, Tesseract може да се инсталира така:

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-bul tesseract-ocr-eng
```

При Docker инсталацията Tesseract пакетите се добавят от `Dockerfile`.

### 1. Клониране и зависимости

```bash
git clone https://github.com/Manolov9/ofertix.git
cd ofertix
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
```

### 2. Създаване на база данни

Пример за MySQL:

```sql
CREATE DATABASE ofertix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ofertix'@'localhost' IDENTIFIED BY 'ИЗБЕРИ-СИЛНА-ПАРОЛА';
GRANT ALL PRIVILEGES ON ofertix.* TO 'ofertix'@'localhost';
FLUSH PRIVILEGES;
```

Използвай отделен database user с ограничени права. Ако базата е на друг host, настрой достъпа според конфигурацията на сървъра и firewall-а. Не публикувай паролата в GitHub.

### 3. Environment настройки

Създай `.env` в root директорията на проекта и не го commit-вай:

```env
DATABASE_URL=mysql://ofertix:ИЗБЕРИ-СИЛНА-ПАРОЛА@127.0.0.1:3306/ofertix
PORT=3000
NODE_ENV=production

# По избор: настройки за OCR ресурсите
OCR_BATCH_SIZE=12
OCR_BATCH_CONCURRENCY=6
```

`DATABASE_URL` е необходим за Drizzle миграциите и за постоянния продуктов индекс. `PORT` по подразбиране е `3000`. При deployment през secret manager или настройките на хостинг доставчика задай тези стойности там, вместо да съхраняваш secrets в source кода.

Основните публични функции за търсене и синхронизация не изискват потребителски вход. OAuth/session променливите на Manus са нужни само ако конфигурираш съответната интеграция от стартовия шаблон; те не са заместител на `DATABASE_URL`.

### 4. Създаване или обновяване на схемата

В свежа база приложи наличните SQL миграции:

```bash
pnpm db:migrate
```

Скриптът изпълнява `drizzle-kit migrate` върху миграциите в `drizzle/`. При промяна на схемата генерирай и приложи нова миграция с:

```bash
pnpm db:push
```

Преди да приложиш промяна върху production база, направи backup и прегледай генерираната миграция.

### 5. Build и стартиране

```bash
pnpm build
pnpm start
```

Сървърът слуша на `0.0.0.0:$PORT`. За production стартирай го с подходящ process manager или Docker и постави HTTPS reverse proxy като Nginx или Caddy отпред.

Провери състоянието на услугата:

```bash
curl http://127.0.0.1:3000/api/health
```

Очакван отговор:

```json
{"status":"ok"}
```

Примерна systemd service секция (настрой пътищата и потребителя за своя сървър):

```ini
[Service]
WorkingDirectory=/opt/ofertix
EnvironmentFile=/opt/ofertix/.env
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
```

### Стартиране с Docker

`Dockerfile` инсталира Node.js 22, pnpm и Tesseract с български и английски език, след което изгражда приложението.

```bash
docker build -t ofertix .
docker run -d --name ofertix \
  --env-file .env \
  -p 3000:3000 \
  ofertix
```

MySQL не е включен в този container. Осигури отделна MySQL/MariaDB услуга и задай достъпен от container-а host в `DATABASE_URL` (не използвай `127.0.0.1`, освен ако базата действително работи в същия container). Изпълни миграциите с достъпна база преди да разчиташ на постоянен каталог.

## Подробен пример: Linux VPS с вече инсталиран Node.js

Този сценарий е за Ubuntu/Debian VPS, на който Node.js вече е наличен. За постоянен индекс трябва да добавиш MySQL/MariaDB; за четене на изображенията от брошурите е необходим и Tesseract OCR. За публичен сайт с домейн са нужни още reverse proxy и HTTPS. Примерът използва MySQL на същия VPS, `systemd` за процеса и Nginx + Let's Encrypt за HTTPS. Ако вече имаш управлявана MySQL услуга, пропусни локалното инсталиране на MySQL и използвай нейните host, user, password и database настройки.

### Стъпка 1: провери Node.js и инсталирай нужните системни пакети

Провери версиите:

```bash
node --version
corepack --version
```

Проектът използва Node.js 22 във `Dockerfile`; използвай Node.js 22 или съвместима по-нова версия. Ако Node.js вече е инсталиран, не е нужно да го инсталираш повторно. Ако е инсталиран само чрез `nvm`, запомни кой Linux потребител го е инсталирал — услугата `systemd` трябва да вижда същия Node.js и pnpm в своя `PATH`.

Инсталирай MySQL, Git и OCR пакетите:

```bash
sudo apt-get update
sudo apt-get install -y mysql-server git \
  tesseract-ocr tesseract-ocr-bul tesseract-ocr-eng
sudo systemctl enable --now mysql
sudo mysql_secure_installation
```

`mysql_secure_installation` е интерактивен помощник за базова защита на MySQL. При MariaDB използвай съответните пакети/услуга на дистрибуцията, например `mariadb-server` и `mariadb`.

### Стъпка 2: създай празна база и отделен потребител за приложението

Отвори MySQL локално:

```bash
sudo mysql
```

В MySQL конзолата изпълни командите по-долу. Замени `ЗАМЕНИ-С-ПАРОЛА` със силна, уникална парола:

```sql
CREATE DATABASE ofertix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ofertix'@'localhost' IDENTIFIED BY 'ЗАМЕНИ-С-ПАРОЛА';
GRANT ALL PRIVILEGES ON ofertix.* TO 'ofertix'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Тествай връзката:

```bash
mysql -u ofertix -p -h 127.0.0.1 ofertix -e 'SELECT 1;'
```

При базата на същия VPS не отваряй порт `3306` към публичния интернет. Ако използваш външна/управлявана база, ограничи достъпа ѝ до IP адреса на VPS-а и следвай указанията на доставчика; в такъв случай host-ът в `DATABASE_URL` няма да бъде `127.0.0.1`.

### Стъпка 3: изтегли приложението и инсталирай зависимостите

Изпълнявай deployment командите като обикновен потребител, не като `root`. Примерът приема, че този потребител ще притежава файловете в `/opt/ofertix`:

```bash
sudo mkdir -p /opt/ofertix
sudo chown "$USER":"$(id -gn)" /opt/ofertix
git clone https://github.com/Manolov9/ofertix.git /opt/ofertix
cd /opt/ofertix
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
```

Ако repository-то вече е клонирано в `/opt/ofertix`, не повтаряй `git clone`; влез в директорията му и продължи. Потвърди, че `node --version` показва Node.js 22 или съвместима по-нова версия.

### Стъпка 4: настрой `.env`

В root директорията на проекта създай файл:

```bash
cd /opt/ofertix
nano .env
```

Примерно съдържание за MySQL на същия VPS:

```env
DATABASE_URL=mysql://ofertix:URL_ENCODED_PASSWORD@127.0.0.1:3306/ofertix
PORT=3000
NODE_ENV=production
OCR_BATCH_SIZE=12
OCR_BATCH_CONCURRENCY=6
```

Замени `URL_ENCODED_PASSWORD` с паролата от стъпка 2. Ако паролата съдържа специални URL символи като `@`, `:`, `/`, `#` или `%`, URL-encode-ни ги в connection string-а. Пази `.env` извън Git и ограничи достъпа:

```bash
chmod 600 .env
```

При управлявана база промени адреса в `DATABASE_URL` според доставчика. Основните функции за публично търсене и синхронизация не изискват Manus OAuth secrets.

### Стъпка 5: създай таблиците и изгради приложението

От `/opt/ofertix` изпълни миграциите, които вече са включени в repository-то, след което изгради production bundle:

```bash
pnpm db:migrate
pnpm build
```

### Стъпка 6: тествай приложението локално на VPS-а

Стартирай приложението временно в терминала:

```bash
pnpm start
```

От втори SSH прозорец провери health endpoint-а:

```bash
curl http://127.0.0.1:3000/api/health
```

Очакваният отговор е `{"status":"ok"}`. След успешната проверка спри временния процес с `Ctrl+C`; по-нататък `systemd` ще го стартира постоянно.

### Стъпка 7: настрой `systemd`, за да се стартира автоматично

Услугата трябва да работи под потребителя, който има достъп до проекта, `.env`, Node.js и pnpm. Провери пътищата:

```bash
whoami
id -gn
command -v node
command -v pnpm
```

Създай `/etc/systemd/system/ofertix.service`:

В примерната секция `After`/`Wants` е посочена услугата `mysql.service`. Ако използваш MariaDB, замени я с името на MariaDB услугата на дистрибуцията (обикновено `mariadb.service`). Ако базата е външна/управлявана, премахни `Wants=mysql.service` и зависимостта от локалната база.

```ini
[Unit]
Description=Ofertix product search
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=ЗАМЕНИ_С_LINUX_ПОТРЕБИТЕЛ
Group=ЗАМЕНИ_С_LINUX_ГРУПА
WorkingDirectory=/opt/ofertix
EnvironmentFile=/opt/ofertix/.env
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/env pnpm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Замени потребителя и групата с резултатите от `whoami` и `id -gn`. Ако `command -v node` или `command -v pnpm` сочи към `~/.nvm/...`, добави директорията, която съдържа тези изпълними файлове, в `Environment=PATH=...` и използвай същия потребител, който има тази `nvm` инсталация. `systemd` не зарежда интерактивния shell профил автоматично.

Запази файла и включи услугата:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ofertix
sudo systemctl status ofertix --no-pager
```

Полезни команди за проверка:

```bash
sudo journalctl -u ofertix -f
sudo systemctl restart ofertix
sudo systemctl stop ofertix
```

### Стъпка 8: свържи домейн, Nginx и HTTPS

За публичен сайт настрой DNS `A` запис на домейна (например `ofertix.example.com`) към публичния IPv4 адрес на VPS-а. Добави `AAAA` запис само ако IPv6 е конфигуриран и достъпен. Изчакай DNS името да сочи към сървъра.

Инсталирай Nginx и Certbot:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Създай `/etc/nginx/sites-available/ofertix` и замени примерния домейн:

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

Активирай настройката и издай сертификат:

```bash
sudo ln -s /etc/nginx/sites-available/ofertix /etc/nginx/sites-enabled/ofertix
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d ofertix.example.com
```

Във firewall-а на VPS доставчика и/или `ufw` разреши входящи връзки само за необходимите услуги: SSH, HTTP `80` и HTTPS `443`. **Не отваряй MySQL `3306` към целия интернет.** Ако активираш `ufw`, първо разреши SSH порта, който използваш, за да не загубиш отдалечения достъп.

След това отвори `https://ofertix.example.com`, натисни **„Синхронизирай“** и следи процеса с `sudo journalctl -u ofertix -f`. Първото индексиране може да отнеме време, защото Tesseract обработва изображенията на каталозите.

### Стъпка 9: backup, възстановяване и обновяване

Направи ръчен backup на базата:

```bash
mysqldump --single-transaction -u ofertix -p ofertix \
  > "$HOME/ofertix-$(date +%F).sql"
```

Командата ще поиска паролата интерактивно. Копирай backup файла и извън VPS-а; repository-то съдържа кода, но не и каталожните данни. За restore към празна база използвай:

```bash
mysql -u ofertix -p ofertix < "$HOME/ofertix-YYYY-MM-DD.sql"
```

При следващо обновяване на кода изпълни като deployment потребителя:

```bash
cd /opt/ofertix
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
sudo systemctl restart ofertix
sudo systemctl status ofertix --no-pager
```

При публична инсталация имай предвид, че посетителите могат да стартират sync, а OCR използва CPU и памет. Остави една backend инстанция, освен ако не добавиш distributed lock/job worker, и обмисли rate limiting за публичния sync endpoint.

## OCR производителност

Текущите стойности по подразбиране са партиди до 12 страници (`OCR_BATCH_SIZE=12`) и до 6 едновременно изпълнявани Tesseract задачи (`OCR_BATCH_CONCURRENCY=6`). Кодът ограничава стойностите съответно до максимум 12 и 8. При по-малък VPS можеш да намалиш паралелизма, например:

```env
OCR_BATCH_SIZE=6
OCR_BATCH_CONCURRENCY=2
```

Tesseract използва осезаемо количество памет. Измери натоварването на конкретния сървър, преди да увеличаваш паралелизма; прекалено много едновременни OCR процеси могат да забавят синхронизацията или да изчерпят RAM.

## Backup и прехвърляне към друг сървър

Кодът в Git repository не включва MySQL данните. За да прехвърлиш и вече индексираните брошури/оферти, направи отделен SQL backup на базата:

```bash
mysqldump --single-transaction -u ofertix -p ofertix \
  > ofertix-$(date +%F).sql
```

Възстанови backup-а в предварително създадена база на новия сървър:

```bash
mysql -u ofertix -p ofertix < ofertix-YYYY-MM-DD.sql
```

След това:

1. Клонирай repository-то на новия сървър и инсталирай зависимостите.
2. Създай `.env` с новия `DATABASE_URL`, `PORT` и необходимите OCR настройки.
3. Увери се, че сървърът може да се свърже към MySQL.
4. Изпълни `pnpm db:migrate`, ако има миграции, които още не са приложени.
5. Изпълни `pnpm build` и стартирай с `pnpm start`.
6. Провери `/api/health`, отвори сайта и направи тестово търсене.

Ако преместиш само кода без SQL backup, постоянният индекс няма да се прехвърли. Създай празна база, приложи миграциите и стартирай **„Синхронизирай“**, за да изградиш нов индекс от източника.

Прави backup редовно и пази копията отделно от сървъра. Съхранявай `.env`, database паролите и други secrets в secret manager или в защитената конфигурация на хостинга, а не в Git.

## Няколко backend инстанции

Каталогът и sync статусът се пазят в MySQL, но защитата срещу паралелна синхронизация (`syncPromise`) е в паметта на отделния backend процес. Използвай една backend инстанция, ако синхронизацията се стартира от публичния бутон. При няколко replicas зад load balancer е необходим допълнителен distributed lock или отделен job worker; без него различни инстанции могат да стартират OCR паралелно.

Тъй като посетителите могат да задействат публичния sync endpoint, при публична self-hosted инсталация обмисли rate limiting или друг контрол на този endpoint на reverse proxy ниво, ако това е нужно за твоя deployment.

## Основни команди

```bash
pnpm dev       # development server (с Vite)
pnpm test      # unit тестове
pnpm check     # TypeScript проверка
pnpm build     # production build
pnpm start     # production server
pnpm db:migrate # прилагане на наличните миграции
pnpm db:push   # генериране и прилагане на миграция от текущата схема
```

## Източник на каталожните данни

Офертикс зарежда каталожна информация и изображения от [katalozi-bg.info](https://katalozi-bg.info/companies). Данните и условията за използване на външния източник са предмет на правилата на съответния сайт. Проверявай офертата и срока ѝ директно в оригиналната брошура.
