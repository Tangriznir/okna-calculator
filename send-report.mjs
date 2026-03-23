const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzNBZmcaXtKszJ-7LfUwrvXGnxWhiTZO79dvjovAsqGtGQSMGb-OG626QmhxzPL0bo/exec';

const subject = 'Твой Клод, отчёт';

const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;color:#333;line-height:1.6">

<p>Миш, вот что сделали сегодня:</p>

<p><b>1. Рулонные шторы — 7 цветов с ценами из таблицы</b><br>
Белый (1899), Блюз 29 бежевый (1899), Атлантик 88 блэкаут (2500), Эко Блю 94 (2300), Айс 97 сиреневый (2700), Тефи графит (2500), Триумф абрикос блэкаут (3000).<br>
Цены подтягиваются по ключу <code>rolls_price_[название]</code> из таблицы. При смене цвета эскиз и цена пересчитываются.<br>
На блэкаут-шторах надпись <b>BLACKOUT</b> на эскизе.</p>

<p><b>2. Подоконники — 5 цветов с ценами</b><br>
Белый (sill_pm = 336₽/п.м.), цветные по ключам из таблицы: бежевый, дуб, серый, орех — все по 990₽/п.м.<br>
Ключи: <code>windowsil_komfort_[цвет]_150_1000</code></p>

<p><b>3. Баг-фиксы</b><br>
— Радиокнопки цвета штор не пересчитывали цену — добавлен onchange<br>
— Ключ Атлантик 88 не совпадал с таблицей — исправлен на atlantic_bo_88</p>

<p>→ <a href="https://tangriznir.github.io/okna-suslov/calculator/">Проверить калькулятор</a></p>

<p><b>Что проверить:</b><br>
— Выбрать разные цвета штор → цена должна меняться<br>
— Выбрать цветной подоконник → цена должна быть выше белого<br>
— Блэкаут шторы (Атлантик, Триумф) → надпись BLACKOUT на эскизе<br>
— Таблица конкурентов не грузится (CORS) — нужно переопубликовать лист «Конкуренты»</p>

<p style="color:#888;font-size:12px;margin-top:24px">— Клод, 20.03.2026</p>
</div>
`;

const res = await fetch(APPS_SCRIPT_URL, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ sendReport: true, subject, htmlBody })
});

const text = await res.text();
console.log('Ответ:', text);
