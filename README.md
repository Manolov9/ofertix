# Офертикс — търсачка и сравнение на оферти

Офертикс е български уеб агрегатор за магазини, каталози и промоционални оферти. Приложението зарежда магазина̀та от публичния каталог на [katalozi-bg.info/companies](https://katalozi-bg.info/companies), пази оригиналния им ред, показва актуалните брошури и позволява търсене на продукт между всички налични резултати.

Публична версия: [https://ofertix-hytuc6fq.manus.space](https://ofertix-hytuc6fq.manus.space)

## Основни възможности

Потребителят може да търси с малки или главни букви. Търсенето е по част от текста, така че `кока кола`, `КОКА КОЛА`, `кола` и други фрагменти намират съвпадащ продукт. Резултатите се сортират по възходяща или низходяща цена и най-ниската цена се откроява с етикет „НАЙ-ЕВТИНО“.

Има филтри за текущата седмица, другата седмица и приключили оферти. Всяка оферта показва продукт, магазин, цена, стара цена, период, връзка към източника и квадратна миниатюра от страницата на брошурата, когато източникът публикува такава.

Синхронизацията е ръчна. Бутонът се казва „Синхронизирай“, в нормално/готово състояние е зелен, а по време на изпълнение става сив и се деактивира, за да не се стартират две паралелни обновявания. След приключване се показват етапът, броят магазини, броят каталози, началото, краят и резултатното съобщение.

## Стартиране локално

Изисква се Node.js и pnpm 10.18.0 или по-нова съвместима версия.

```bash
pnpm install
pnpm dev
```

Приложението слуша на `http://localhost:3000`. За production build:

```bash
pnpm check
pnpm build
pnpm start
```

`PORT` се уважава от development и production сървъра. За чист frontend build без backend има `pnpm dev:static` и `pnpm build:static`, но Ofertix изисква server режима за синхронизацията.

## API

Всички API отговори са JSON.

### `GET /api/catalog`

Връща магазините, брошурите, филтрираните оферти, текущия статус и URL адреса на източника.

Поддържани query параметри:

- `q` — текст за търсене; сравнява се case-insensitive и чрез substring match.
- `period` — `all`, `this-week`, `next-week` или `ended`.
- `sort` — `price-asc` или `price-desc`.

Пример:

```bash
curl 'http://localhost:3000/api/catalog?q=%D0%BA%D0%BE%D0%BA%D0%B0%20%D0%BA%D0%BE%D0%BB%D0%B0&period=all&sort=price-asc'
```

### `POST /api/sync`

Стартира ръчна синхронизация. Ако вече има активна синхронизация, endpoint-ът връща HTTP `409`, вместо да създава втори процес. При нормален старт връща HTTP `202` и текущия статус.

### `GET /api/sync/status`

Връща текущото състояние:

```json
{
  "status": "idle | running | success | error",
  "stage": "текущ етап",
  "startedAt": "ISO дата",
  "finishedAt": "ISO дата",
  "storesProcessed": 66,
  "brochuresProcessed": 90,
  "offersProcessed": 9,
  "message": "описание на резултата"
}
```

### `GET /api/health`

Health check за runtime и deployment системата. Връща `{ "status": "ok" }`.

## Как работи синхронизацията

Логиката се намира в `server/catalog.ts`. Първо се прочита публичната страница с магазини и се нормализират всички връзки `/company/{id}`. За магазини без текстов slug се използва резервното име по ID, за да се запазят всички видими 66 позиции. След това се посещават страниците на магазините с ограничена паралелност от осем worker-а и се извличат връзките `/catalogs/`.

За всяка намерена брошура се прочита страницата ѝ. Адаптерът приоритизира изображения от вида `/catalogs/{id}/small/{page}.jpg`, защото те са кратки preview изображения с достатъчна площ за четим продукт. Връзката се пази като двойка `brochureUrl` + `imageUrl` от една и съща страница; например `.../promo-katalog-Billa/34848` е свързана с `.../catalogs/34848/small/1.jpg`. Снимките се връщат като `thumbnailUrl` към брошурата и `imageUrl` към офертата. Интерфейсът ги визуализира в квадратен контейнер с `object-fit: cover`; ако липсва изображение, показва неутрално „без снимка“, без да измисля продуктова снимка.

Оригиналният източник предоставя каталозите основно като брошурни страници/изображения, а не като готов продуктов JSON feed. Затова детайлните цени и продуктови редове трябва да се извличат от OCR/структурен parser в следващ слой, ако се изисква пълно автоматично разпознаване на всеки артикул. Текущият adapter е подготвен за това чрез полетата `product`, `price`, `oldPrice`, `priceLabel`, `unit`, `period`, `brochureUrl` и `imageUrl`. `price` е числова стойност за сортиране, а `priceLabel` е стойността за показване. Когато има две цени, интерфейсът ги изписва като `цена 1 лв. / цена 2 лв.`; при production OCR/parser `priceLabel` трябва да се попълва с точния оригинален текст от каталога.

## База данни

Проектът е инициализиран с управлявана MySQL база и Drizzle ORM. В момента starter схемата съдържа таблицата `users`, която обслужва стандартната Manus authentication основа. Тя има `id`, `openId`, `name`, `email`, `loginMethod`, `role`, `createdAt`, `updatedAt` и `lastSignedIn`.

Каталожният adapter в текущата версия използва runtime memory за бързия публичен прототип. Това означава, че магазините, брошурите, офертите и sync статуса се зареждат при runtime и се обновяват при натискане на бутона. Няма скрити credentials в кода и няма втори локален database файл.

За production persistence следва да се добавят следните Drizzle таблици:

- `stores`: `id`, `sourceId`, `displayOrder`, `name`, `sourceUrl`, `logoUrl`, `isActive`, timestamps.
- `brochures`: `id`, `storeId`, `sourceId`, `title`, `sourceUrl`, `period`, `validFrom`, `validTo`, `thumbnailUrl`, `syncedAt`.
- `offers`: `id`, `brochureId`, `storeId`, `productName`, `normalizedName`, `price`, `oldPrice`, `unit`, `period`, `imageUrl`, `sourceUrl`, `syncedAt`.
- `syncRuns`: `id`, `status`, `stage`, `startedAt`, `finishedAt`, `storesProcessed`, `brochuresProcessed`, `offersProcessed`, `message`.

Препоръчителните индекси са `stores.displayOrder`, `brochures.storeId`, `brochures.period`, `offers.normalizedName`, `offers.price`, `offers.storeId` и `syncRuns.startedAt`. Така търсенето ще може да се изпълнява с database query вместо с in-memory filter, а историята на синхронизациите ще остава налична след рестарт.

След добавяне на тези таблици миграцията се изпълнява с:

```bash
pnpm db:push
```

При production промени миграцията трябва да се прегледа и приложи контролирано чрез `pnpm db:migrate`. Не трябва да се съхраняват пълни HTML страници в MySQL; за изображения/големи файлове е по-подходящо object storage, а в базата се пази само стабилен URL и metadata.

## Структура на проекта

- `client/src/pages/Home.tsx` — основен dashboard, търсачка, филтри, офертни карти, миниатюри и manual sync бутон.
- `client/src/index.css` — тъмната визуална система „Неонова борса“, responsive layout и state стилове за бутона.
- `server/catalog.ts` — source adapter, синхронизация, substring search, period filtering и image extraction.
- `server/_core/index.ts` — Express health, catalog и sync endpoints.
- `drizzle/schema.ts` — Drizzle schema основа и users таблица.
- `drizzle/` — миграции за управляваната MySQL база.
- `public/manus-routes.json` — route manifest за `/`.
- `plan.md` — приети дизайн и implementation решения.
- `TODO.md` — проследяване на продуктовите резултати.

## Deployment и GitHub

Production контейнерът се изгражда с `pnpm build`, а runtime entrypoint е `node dist/index.js`. Health path е `/api/health`. Последната версия е записана в managed canonical Git и е качена в private GitHub repository:

[github.com/Manolov9/ofertix](https://github.com/Manolov9/ofertix)

Промените се правят с отделен commit и се качват в `main`. След промяна на backend API или frontend bundle се прави нов build, checkpoint и publish.

## Автоматизации

Ежедневната ScheduleTask е изключена по избор на продукта. Ofertix разчита на потребителския бутон „Синхронизирай“ и на публичните endpoints. Това запазва контрола на потребителя и предотвратява автоматични заявки към източника без негово действие.

## Unit tests

Тестовете се намират в `server/catalog.test.ts` и се изпълняват с:

```bash
pnpm test
```

Те проверяват case-insensitive и substring търсене, форматирането на една или две цени, приоритизирането на реална `/catalogs/{id}/small/{page}.jpg` снимка и връщането на реалния продукт „Кока Кола“. Runtime проверката на ръчната синхронизация потвърждава `success`, 66 обработени магазина, налични каталози, URL към същия каталог за `brochureUrl` и `imageUrl`, и двоен `priceLabel`.
