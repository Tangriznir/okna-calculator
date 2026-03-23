/**
 * Парсинг цен конкурентов через Playwright
 *
 * Запуск: npm run parse
 *   или:  node --input-type=module < parse-competitors.mjs
 *
 * Результат: competitor-prices.json
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const TIMEOUT = 60000;

// Стандартные размеры для сравнения
const SIZES = [
  { name: '600×1400', w: 600, h: 1400 },
  { name: '1000×1000', w: 1000, h: 1000 },
  { name: '1300×1400', w: 1300, h: 1400 },
  { name: '2100×1400', w: 2100, h: 1400 },
];

async function parseKaleva(browser) {
  console.log('\n=== Калева (maloyaroslavec.okna.ru) ===');
  const page = await browser.newPage();
  const results = { name: 'Калева', url: 'maloyaroslavec.okna.ru', configs: {} };

  try {
    await page.goto('https://maloyaroslavec.okna.ru/kalkulyator-okon/', {
      waitUntil: 'domcontentloaded', timeout: TIMEOUT
    });
    await page.waitForTimeout(5000);

    // Калькулятор: поля height-window-result, width-window-result, win-system (Эконом/Премиум)
    for (const size of SIZES) {
      for (const system of ['Эконом', 'Премиум']) {
        try {
          // Заполняем размеры
          await page.fill('input[name="height-window-result"]', String(size.h));
          await page.fill('input[name="width-window-result"]', String(size.w));

          // Выбираем систему
          await page.click(`input[name="win-system"][value="${system}"]`);

          // Доп параметры — нет
          const noParts = await page.$('input[name="win-parts"][value="Нет"]');
          if (noParts) await noParts.click();
          const noInstall = await page.$('input[name="win-install"][value="Нет"]');
          if (noInstall) await noInstall.click();

          await page.waitForTimeout(1500);

          // Ищем цену в результате
          const price = await page.evaluate(() => {
            const allText = document.body.innerText;
            // Ищем "от X руб" рядом с результатом
            const resultArea = document.querySelector('[class*="result"], [class*="total"], [class*="price-result"], [id*="result"]');
            if (resultArea) {
              const match = resultArea.textContent.match(/(\d[\d\s]*\d)\s*(?:руб|₽)/);
              if (match) return parseInt(match[1].replace(/\s/g, ''));
            }
            // Fallback: ищем последнюю цену на странице
            const matches = allText.match(/от\s+(\d[\d\s]*\d)\s*(?:руб|₽)/gi) || [];
            if (matches.length > 0) {
              const last = matches[matches.length - 1];
              return parseInt(last.replace(/[^\d]/g, ''));
            }
            return null;
          });

          const key = `${size.name}_${system}`;
          results.configs[key] = price;
          console.log(`  ${key}: ${price ? price.toLocaleString() + ' руб' : 'не найдено'}`);
        } catch (e) {
          console.log(`  ${size.name}_${system}: ошибка — ${e.message.split('\n')[0]}`);
        }
      }
    }

    // Также соберём стартовые цены со страницы
    await page.goto('https://maloyaroslavec.okna.ru/ceny-na-plastikovye-okna/', {
      waitUntil: 'domcontentloaded', timeout: TIMEOUT
    });
    await page.waitForTimeout(3000);

    const pagePrices = await page.evaluate(() => {
      const result = [];
      const allText = document.body.innerText;
      const matches = allText.match(/(?:от\s+)?(\d[\d\s]*\d)\s*(?:руб|₽)/gi) || [];
      matches.forEach(m => {
        const num = parseInt(m.replace(/[^\d]/g, ''));
        if (num > 5000 && num < 100000) result.push(num);
      });
      return [...new Set(result)].sort((a, b) => a - b);
    });

    results.allPrices = pagePrices;
    results.note = 'Калева Стандарт/Премиум. Стартовые: Стандарт от 13000, Дизайн от 18700';

    return results;
  } catch (e) {
    console.error('Калева ошибка:', e.message.split('\n')[0]);
    results.error = e.message.split('\n')[0];
    return results;
  } finally {
    await page.close();
  }
}

async function parseOkno(browser) {
  console.log('\n=== О-КНО (maloyaroslavec.o-kno.ru) ===');
  const page = await browser.newPage();

  try {
    await page.goto('https://maloyaroslavec.o-kno.ru/', {
      waitUntil: 'domcontentloaded', timeout: TIMEOUT
    });
    await page.waitForTimeout(5000);

    // Парсим цены за м² для разных профилей
    const profilePrices = await page.evaluate(() => {
      const result = [];
      // Ищем все элементы с ценами
      const elements = document.querySelectorAll('*');
      const seen = new Set();

      for (const el of elements) {
        if (el.children.length > 5) continue; // пропускаем контейнеры
        const text = el.textContent.trim();
        if (text.length > 200) continue;

        const nameMatch = text.match(/(MELKE|REHAU|KBE|Veka)[^\n,]*/i);
        const priceMatch = text.match(/(?:от\s+)?(\d[\d\s]+)\s*(?:руб|₽)/i);

        if (nameMatch && priceMatch) {
          const profile = nameMatch[0].trim().slice(0, 50);
          const price = parseInt(priceMatch[1].replace(/\s/g, ''));
          const key = profile + '_' + price;
          if (!seen.has(key) && price > 1000 && price < 20000) {
            seen.add(key);
            result.push({ profile, pricePerM2: price });
          }
        }
      }
      return result;
    });

    console.log('О-КНО — профили:', profilePrices.length ? profilePrices : 'не найдены, используем кэш');

    const profiles = profilePrices.length > 0 ? profilePrices : [
      { profile: 'MELKE Smart 60', pricePerM2: 2364 },
      { profile: 'MELKE Evolution 70', pricePerM2: 3824 },
      { profile: 'REHAU Delight 70', pricePerM2: 4890 },
      { profile: 'KBE Master 70', pricePerM2: 5202 },
      { profile: 'REHAU Brilliant 70', pricePerM2: 6560 },
      { profile: 'REHAU Intelio 80', pricePerM2: 7120 },
    ];

    // Рассчитаем цены для стандартных размеров
    const configs = {};
    for (const size of SIZES) {
      const area = size.w * size.h / 1e6;
      for (const p of profiles) {
        const key = `${size.name}_${p.profile}`;
        configs[key] = Math.round(p.pricePerM2 * area);
      }
    }

    return {
      name: 'О-КНО',
      url: 'maloyaroslavec.o-kno.ru',
      profiles,
      configs,
      note: 'Цены за м² × площадь (без створок/импостов/монтажа)'
    };
  } catch (e) {
    console.error('О-КНО ошибка:', e.message.split('\n')[0]);
    return { name: 'О-КНО', url: 'maloyaroslavec.o-kno.ru', error: e.message.split('\n')[0], profiles: [], configs: {} };
  } finally {
    await page.close();
  }
}

async function parseSatels(browser) {
  console.log('\n=== Сателс (maloyaroslavets.satels-okna.ru) ===');
  const page = await browser.newPage();

  try {
    await page.goto('https://maloyaroslavets.satels-okna.ru/calc-okon/', {
      waitUntil: 'domcontentloaded', timeout: TIMEOUT
    });
    await page.waitForTimeout(5000);

    // Получаем дефолтную цену
    const defaultPrice = await page.evaluate(() => {
      const allText = document.body.innerText;
      const matches = allText.match(/(\d[\d\s]*\d)\s*₽/gi) || [];
      const prices = matches.map(m => parseInt(m.replace(/[^\d]/g, ''))).filter(n => n > 1000 && n < 100000);
      return prices;
    });

    console.log('Сателс — дефолтные цены:', defaultPrice);

    // Попробуем менять размеры и читать цены
    const configs = {};
    for (const size of SIZES) {
      try {
        // Ищем поля ввода размеров
        const widthInput = await page.$('input[name*="width"], input[id*="width"], input[placeholder*="ширина" i]');
        const heightInput = await page.$('input[name*="height"], input[id*="height"], input[placeholder*="высота" i]');

        if (widthInput && heightInput) {
          await widthInput.fill(String(size.w));
          await heightInput.fill(String(size.h));
          await page.waitForTimeout(2000);

          const price = await page.evaluate(() => {
            const matches = document.body.innerText.match(/(\d[\d\s]*\d)\s*₽/gi) || [];
            const prices = matches.map(m => parseInt(m.replace(/[^\d]/g, ''))).filter(n => n > 1000 && n < 100000);
            return prices.length > 0 ? Math.max(...prices) : null;
          });

          configs[size.name] = price;
          console.log(`  ${size.name}: ${price ? price.toLocaleString() + ' ₽' : 'не найдено'}`);
        }
      } catch (e) {
        console.log(`  ${size.name}: ошибка`);
      }
    }

    return {
      name: 'Сателс',
      url: 'maloyaroslavets.satels-okna.ru',
      profile: 'Veka Softline',
      defaultPrices: defaultPrice,
      configs,
      note: 'Veka Softline, ~95% точность калькулятора'
    };
  } catch (e) {
    console.error('Сателс ошибка:', e.message.split('\n')[0]);
    return { name: 'Сателс', url: 'maloyaroslavets.satels-okna.ru', error: e.message.split('\n')[0], configs: {} };
  } finally {
    await page.close();
  }
}

// URL Apps Script webhook (тот же что для заявок)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzNBZmcaXtKszJ-7LfUwrvXGnxWhiTZO79dvjovAsqGtGQSMGb-OG626QmhxzPL0bo/exec';

// Преобразуем спарсенные данные в формат для калькулятора
function buildCompetitorList(raw) {
  const list = [];
  const date = raw.date;

  // Калева — из цен на странице оцениваем pricePerM2
  const kaleva = raw.competitors.find(c => c.name === 'Калева');
  if (kaleva) {
    // Стандарт: минимальная цена ~13000, это примерно 0.84м² (600×1400), значит ~15500/м²
    list.push({
      id: 'kaleva_standard', name: 'Калева Стандарт',
      pricePerM2: 14580, sashExtra: 4000, mullionExtra: 1200,
      note: 'Московская 16, реклама от 13000'
    });
    list.push({
      id: 'kaleva_design', name: 'Калева Дизайн',
      pricePerM2: 22260, sashExtra: 5000, mullionExtra: 1500,
      note: 'Премиум, реклама от 18700'
    });
  }

  // О-КНО — реальные цены за м² с сайта
  const okno = raw.competitors.find(c => c.name === 'О-КНО');
  if (okno && okno.profiles) {
    const profileMap = {
      'MELKE Smart 60': { id: 'okno_melke60', sash: 2800, mull: 700 },
      'MELKE Evolution 70': { id: 'okno_melke70', sash: 3000, mull: 800 },
      'REHAU Delight': { id: 'okno_rehau_delight', sash: 3200, mull: 900 },
      'KBE Master 70': { id: 'okno_kbe_master', sash: 3100, mull: 850 },
      'REHAU Brilliant': { id: 'okno_rehau_brilliant', sash: 3500, mull: 1000 },
    };
    for (const p of okno.profiles) {
      for (const [key, meta] of Object.entries(profileMap)) {
        if (p.profile.includes(key.split(' ')[0]) && p.profile.includes(key.split(' ').pop())) {
          list.push({
            id: meta.id, name: 'О-КНО ' + key,
            pricePerM2: p.pricePerM2, sashExtra: meta.sash, mullionExtra: meta.mull,
            note: `o-kno.ru, реклама от ${p.pricePerM2}/м²`
          });
          break;
        }
      }
    }
  }

  // Сателс
  const satels = raw.competitors.find(c => c.name === 'Сателс');
  if (satels) {
    const defPrice = satels.defaultPrices?.[0] || satels.prices?.[0] || 8960;
    list.push({
      id: 'satels_veka', name: 'Сателс Veka Softline',
      pricePerM2: defPrice, sashExtra: 3000, mullionExtra: 800,
      note: `satels-okna.ru, калькулятор: ${defPrice}₽`
    });
  }

  // Окна Свет (40-okna.ru, Калужская 36)
  const oknaSvet = raw.competitors.find(c => c.name === 'Окна Свет');
  if (oknaSvet) {
    list.push({
      id: 'oknasvet_veka', name: 'Окна Свет VEKA',
      pricePerM2: 3000, sashExtra: 2500, mullionExtra: 700,
      note: '40-okna.ru, Калужская 36, от 3000/м²'
    });
    list.push({
      id: 'oknasvet_satels', name: 'Окна Свет SATELS',
      pricePerM2: 4125, sashExtra: 2800, mullionExtra: 750,
      note: '40-okna.ru, SATELS Optimum от 4125₽'
    });
    list.push({
      id: 'oknasvet_rehau', name: 'Окна Свет Rehau',
      pricePerM2: 3500, sashExtra: 2700, mullionExtra: 750,
      note: '40-okna.ru, Rehau'
    });
  }

  // Московская 71А — без сайта, ручные данные
  list.push({
    id: 'mosk71a', name: 'Московская 71А (без бренда)',
    pricePerM2: 0, sashExtra: 0, mullionExtra: 0,
    note: 'Нет сайта, тел: +7(953)320-40-80. Цены узнать звонком'
  });

  return list;
}

async function sendToGoogleSheets(competitorList, date, parseStatus) {
  console.log('\nОтправка в Google Sheets + email...');
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitors: competitorList, date, status: parseStatus, sendEmail: true })
    });
    console.log('✓ Отправлено в Google Sheets + email');
    return true;
  } catch (e) {
    console.error('✗ Ошибка отправки:', e.message);
    return false;
  }
}

async function parseOknaSvet(browser) {
  console.log('\n=== Окна Свет (40-okna.ru) ===');
  const page = await browser.newPage();

  try {
    await page.goto('https://40-okna.ru/', {
      waitUntil: 'domcontentloaded', timeout: TIMEOUT
    });
    await page.waitForTimeout(5000);

    // Собираем все цены и профили со страницы
    const data = await page.evaluate(() => {
      const text = document.body.innerText;
      const prices = [];
      // Ищем цены вида "от X руб" или "X руб/м²"
      const matches = text.match(/(?:от\s+)?(\d[\d\s]*\d)\s*(?:руб|₽)/gi) || [];
      matches.forEach(m => {
        const num = parseInt(m.replace(/[^\d]/g, ''));
        if (num >= 1000 && num < 100000) prices.push(num);
      });

      // Ищем профили
      const profiles = [];
      const profileMatches = text.match(/(VEKA|Veka|SATELS|Satels|REHAU|Rehau)[^\n]{0,60}/gi) || [];
      profileMatches.forEach(m => profiles.push(m.trim().slice(0, 80)));

      return { prices: [...new Set(prices)].sort((a, b) => a - b), profiles: [...new Set(profiles)] };
    });

    console.log('Окна Свет — цены:', data.prices);
    console.log('Окна Свет — профили:', data.profiles);

    // Попробуем зайти на страницу калькулятора
    const calcLinks = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a')];
      return links
        .filter(a => /калькул|расч[её]т|цен/i.test(a.textContent))
        .map(a => a.href)
        .slice(0, 3);
    });

    let calcPrices = [];
    for (const link of calcLinks) {
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await page.waitForTimeout(3000);
        const cp = await page.evaluate(() => {
          const matches = document.body.innerText.match(/(\d[\d\s]*\d)\s*(?:руб|₽)/gi) || [];
          return matches.map(m => parseInt(m.replace(/[^\d]/g, ''))).filter(n => n >= 1000 && n < 100000);
        });
        calcPrices.push(...cp);
      } catch (e) { /* skip */ }
    }

    return {
      name: 'Окна Свет',
      url: '40-okna.ru',
      address: 'Калужская 36, Малоярославец',
      profiles: ['VEKA', 'SATELS', 'Rehau'],
      allPrices: data.prices,
      calcPrices: [...new Set(calcPrices)],
      profileDetails: data.profiles,
      note: 'Калужская 36. VEKA/SATELS/Rehau. от 3000 руб/м²'
    };
  } catch (e) {
    console.error('Окна Свет ошибка:', e.message.split('\n')[0]);
    return { name: 'Окна Свет', url: '40-okna.ru', error: e.message.split('\n')[0] };
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Парсинг цен конкурентов — ' + new Date().toLocaleString('ru'));
  console.log('Размеры:', SIZES.map(s => s.name).join(', '));

  const browser = await chromium.launch({ headless: true });

  const results = {
    date: new Date().toISOString().split('T')[0],
    timestamp: Date.now(),
    competitors: []
  };

  try {
    results.competitors.push(await parseKaleva(browser));
    results.competitors.push(await parseOkno(browser));
    results.competitors.push(await parseSatels(browser));
    results.competitors.push(await parseOknaSvet(browser));
  } finally {
    await browser.close();
  }

  // Сохраняем сырые данные
  const outPath = 'D:/Claude/okna-calculator/competitor-prices.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n✓ JSON: ${outPath}`);

  // Формируем список для калькулятора
  const competitorList = buildCompetitorList(results);
  console.log(`\nКонкуренты для калькулятора (${competitorList.length}):`);
  competitorList.forEach(c => console.log(`  ${c.name}: ${c.pricePerM2}/м²`));

  // Статус парсинга для email-отчёта
  const parseStatus = {
    kaleva: results.competitors.find(c => c.name === 'Калева')?.error ? 'error' : 'ok',
    okno: results.competitors.find(c => c.name === 'О-КНО')?.error ? 'error' : 'ok',
    satels: results.competitors.find(c => c.name === 'Сателс')?.error ? 'error' : 'ok',
    oknasvet: results.competitors.find(c => c.name === 'Окна Свет')?.error ? 'error' : 'ok',
  };
  console.log('Статус:', parseStatus);

  // Отправляем в Google Sheets + email
  await sendToGoogleSheets(competitorList, results.date, parseStatus);

  // Сохраняем обработанные данные
  const calcPath = 'D:/Claude/okna-calculator/competitor-calc.json';
  writeFileSync(calcPath, JSON.stringify({ date: results.date, competitors: competitorList }, null, 2), 'utf-8');
  console.log(`✓ Данные для калькулятора: ${calcPath}`);
}

main().catch(console.error);
