/**
 * Google Apps Script для записи цен конкурентов + email-рассылка
 *
 * ИНСТРУКЦИЯ:
 * 1. Открой таблицу "Цены калькулятор" в Google Sheets
 * 2. Создай новый лист с названием "Конкуренты"
 * 3. В первой строке: key | price_m2 | sash_extra | mullion_extra | name | note | date
 * 4. Расширения → Apps Script
 * 5. ЗАМЕНИ весь код в Code.gs на этот (или добавь к существующему)
 * 6. Deploy → Manage Deployments → Edit → New Version → Deploy
 *
 * Email будет приходить на адрес владельца таблицы (твой Google аккаунт)
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Заявка от калькулятора
    if (data.ip) {
      return handleOrder(data);
    }

    // Данные конкурентов от парсера
    if (data.competitors) {
      return handleCompetitors(data);
    }

    // Произвольное письмо (subject + htmlBody)
    if (data.sendReport) {
      return handleReport(data);
    }

    return jsonResponse({status: 'error', message: 'Unknown data type'});
  } catch (err) {
    return jsonResponse({status: 'error', message: err.toString()});
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleOrder(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Заявки') || ss.getSheets()[0];
  sheet.appendRow([
    new Date(),
    data.ip || '',
    data.type || '',
    data.size || '',
    data.glazing || '',
    data.sashes || '',
    data.nets || '',
    data.price || '',
    data.profit || '',
    data.extras || ''
  ]);
  return jsonResponse({status: 'ok'});
}

function handleCompetitors(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Конкуренты');

  if (!sheet) {
    sheet = ss.insertSheet('Конкуренты');
    sheet.appendRow(['key', 'price_m2', 'sash_extra', 'mullion_extra', 'name', 'note', 'date']);
    // Форматирование заголовка
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#f0f0f0');
  }

  var date = data.date || Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyyy-MM-dd');
  var competitors = data.competitors;
  var parseStatus = data.status || {}; // {kaleva: 'ok'/'error', okno: 'ok'/'error', satels: 'ok'/'error'}

  // Очищаем старые данные (кроме заголовка)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
  }

  // Записываем
  var rows = [];
  for (var i = 0; i < competitors.length; i++) {
    var c = competitors[i];
    rows.push([
      c.id || ('comp_' + i),
      c.pricePerM2 || c.price_m2 || 0,
      c.sashExtra || c.sash_extra || 0,
      c.mullionExtra || c.mullion_extra || 0,
      c.name || '',
      c.note || '',
      date
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }

  // Отправляем email с отчётом
  if (data.sendEmail !== false) {
    sendCompetitorReport(competitors, parseStatus, date);
  }

  return jsonResponse({status: 'ok', count: rows.length, date: date});
}

function sendCompetitorReport(competitors, parseStatus, date) {
  var email = Session.getActiveUser().getEmail();
  if (!email) return;

  var subject = '🪟 Цены конкурентов — ' + date;

  // Статус парсинга
  var statusHtml = '<h3>Статус парсинга</h3><table style="border-collapse:collapse;font-family:Arial,sans-serif">';

  var sources = [
    {name: 'Калева (okna.ru)', key: 'kaleva'},
    {name: 'О-КНО (o-kno.ru)', key: 'okno'},
    {name: 'Сателс (satels-okna.ru)', key: 'satels'},
    {name: 'Окна Свет (40-okna.ru)', key: 'oknasvet'}
  ];

  for (var i = 0; i < sources.length; i++) {
    var s = sources[i];
    var ok = parseStatus[s.key] === 'ok';
    var color = ok ? '#2a9d2a' : '#dc3545';
    var text = ok ? '✅ Актуальный парсинг' : '❌ Парсинг не удался (кэш)';
    statusHtml += '<tr><td style="padding:4px 12px;border:1px solid #ddd">' + s.name + '</td>';
    statusHtml += '<td style="padding:4px 12px;border:1px solid #ddd;color:' + color + ';font-weight:bold">' + text + '</td></tr>';
  }
  statusHtml += '</table>';

  // Таблица цен
  var priceHtml = '<h3>Цены конкурентов (за м²)</h3>';
  priceHtml += '<table style="border-collapse:collapse;font-family:Arial,sans-serif;width:100%">';
  priceHtml += '<tr style="background:#1a5cb8;color:#fff"><th style="padding:8px;text-align:left">Конкурент</th>';
  priceHtml += '<th style="padding:8px;text-align:right">Цена/м²</th>';
  priceHtml += '<th style="padding:8px;text-align:right">Створка</th>';
  priceHtml += '<th style="padding:8px">Примечание</th></tr>';

  for (var j = 0; j < competitors.length; j++) {
    var c = competitors[j];
    var bg = j % 2 === 0 ? '#fff' : '#f8f8f8';
    priceHtml += '<tr style="background:' + bg + '">';
    priceHtml += '<td style="padding:6px 8px;border:1px solid #eee">' + (c.name || c.id) + '</td>';
    priceHtml += '<td style="padding:6px 8px;border:1px solid #eee;text-align:right;font-weight:bold">' + (c.pricePerM2 || 0) + ' ₽</td>';
    priceHtml += '<td style="padding:6px 8px;border:1px solid #eee;text-align:right">' + (c.sashExtra || 0) + ' ₽</td>';
    priceHtml += '<td style="padding:6px 8px;border:1px solid #eee;color:#888;font-size:12px">' + (c.note || '') + '</td>';
    priceHtml += '</tr>';
  }
  priceHtml += '</table>';

  var body = '<div style="font-family:Arial,sans-serif;max-width:600px">';
  body += '<h2 style="color:#1a5cb8">Мониторинг конкурентов — ' + date + '</h2>';
  body += statusHtml;
  body += '<br>' + priceHtml;
  body += '<br><p style="color:#888;font-size:12px">Автоматический отчёт от парсера окон. Данные обновляются 1-го числа каждого месяца.</p>';
  body += '<p style="color:#888;font-size:12px">Редактировать цены: <a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">Открыть таблицу</a></p>';
  body += '</div>';

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: body
  });
}

function handleReport(data) {
  var email = 'tangriznir@gmail.com';
  MailApp.sendEmail({
    to: email,
    subject: data.subject || 'Отчёт',
    htmlBody: data.htmlBody || ''
  });
  return jsonResponse({status: 'ok', sent: email});
}
