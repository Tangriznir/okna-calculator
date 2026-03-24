<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

$to = 'sales@okna-suslov.ru';
$subject = $data['subject'] ?? 'Заявка из калькулятора';

// Собираем HTML письмо
$html = $data['html'] ?? '';

// Добавляем эскизы окон как inline images
if (!empty($data['sketches'])) {
    $html .= '<h3 style="color:#1a5cb8;margin:24px 0 12px">Эскизы конструкций</h3>';
    foreach ($data['sketches'] as $sketch) {
        $html .= '<div style="margin-bottom:12px;display:inline-block;border:1px solid #ddd;padding:4px;border-radius:4px">';
        $html .= '<div style="font-size:11px;color:#888;margin-bottom:4px">' . htmlspecialchars($sketch['key']) . '</div>';
        $html .= '<img src="' . $sketch['dataUrl'] . '" style="max-width:300px">';
        $html .= '</div> ';
    }
}

// Скриншот 3D
if (!empty($data['screenshot3d'])) {
    $html .= '<h3 style="color:#1a5cb8;margin:24px 0 12px">3D модель дома</h3>';
    $html .= '<img src="' . $data['screenshot3d'] . '" style="max-width:600px;border:1px solid #ddd;border-radius:8px">';
}

// MIME boundary для HTML письма с inline images
$boundary = md5(time());

$headers = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=utf-8\r\n";
$headers .= "From: Калькулятор окон <noreply@okna-suslov.ru>\r\n";
$headers .= "Reply-To: noreply@okna-suslov.ru\r\n";
$headers .= "X-Mailer: OknaCalculator/1.0\r\n";

// Тема в UTF-8
$subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$result = mail($to, $subject, $html, $headers);

if ($result) {
    // Логируем заявку
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) mkdir($logDir, 0755, true);
    $logFile = $logDir . '/orders_' . date('Y-m') . '.log';
    $logEntry = date('Y-m-d H:i:s') . ' | ' .
        ($data['isAutoReport'] ? 'AUTO' : 'ORDER') . ' | ' .
        ($data['clientName'] ?? '') . ' | ' .
        ($data['clientPhone'] ?? '') . ' | ' .
        ($data['city'] ?? '') . ' | ' .
        ($data['timeSpent'] ?? '') . ' | ' .
        ($data['orderData']['totalPrice'] ?? 0) . " руб\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);

    echo json_encode(['ok' => true]);
} else {
    echo json_encode(['ok' => false, 'error' => 'Mail send failed']);
}
