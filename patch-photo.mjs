import { readFileSync, writeFileSync } from 'fs';

const b64 = readFileSync('D:/Claude/okna-calculator/summer.b64', 'utf8').trim();
let html = readFileSync('D:/Claude/okna-calculator/index.html', 'utf8');

// 1. Заменяем SUMMER_IMG или создаём его
if (html.includes("var SUMMER_IMG=")) {
  html = html.replace(/var SUMMER_IMG='[^']*';/, `var SUMMER_IMG='data:image/jpeg;base64,${b64}';`);
} else {
  html = html.replace("var _sceneDefs=false;", `var _sceneDefs=false;\nvar SUMMER_IMG='data:image/jpeg;base64,${b64}';`);
}

// 2. Заменяем svgSceneDefs — убираем SVG-градиенты неба/травы, оставляем только glassGlare
const oldDefs = /function svgSceneDefs\(\)\{[\s\S]*?\n\}/;
const newDefs = `function svgSceneDefs(){
  if(_sceneDefs)return '';
  _sceneDefs=true;
  return '<defs><linearGradient id="glassGlare" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.22"/><stop offset="25%" stop-color="#fff" stop-opacity="0.03"/><stop offset="60%" stop-color="#fff" stop-opacity="0"/><stop offset="92%" stop-color="#fff" stop-opacity="0.06"/></linearGradient></defs>';
}`;
html = html.replace(oldDefs, newDefs);

// 3. Заменяем svgScene — вместо SVG-рисунка показываем фото
const oldScene = /function svgScene\(x,y,w,h\)\{[\s\S]*?\n\}/;
const newScene = `function svgScene(x,y,w,h){
  var cid='gc'+Math.round(x)+'_'+Math.round(y);
  return '<clipPath id="'+cid+'"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'"/></clipPath><image href="'+SUMMER_IMG+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#'+cid+')"/>';
}`;
html = html.replace(oldScene, newScene);

writeFileSync('D:/Claude/okna-calculator/index.html', html);
console.log('Done, size:', Math.round(html.length / 1024), 'KB');
