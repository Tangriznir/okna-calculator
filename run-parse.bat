@echo off
cd /d D:\Claude\okna-calculator
"C:\Program Files\nodejs\node.exe" --input-type=module < parse-competitors.mjs >> parse-log.txt 2>&1
echo %date% %time% Парсинг завершён >> parse-log.txt
