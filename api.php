<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

define('DATA_DIR', __DIR__ . '/data');

function output_json($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_name($name) {
    $name = trim(preg_replace('/\s+/', ' ', (string)$name));
    if ($name === '' || strlen($name) > 40) {
        output_json(array('ok' => false, 'error' => 'Invalid user name.'), 400);
    }
    if (!preg_match("/^[a-zA-Z0-9 .'-]+$/", $name)) {
        output_json(array('ok' => false, 'error' => 'Invalid user name.'), 400);
    }
    return $name;
}

function data_file($name) {
    return DATA_DIR . '/' . hash('sha256', strtolower($name)) . '.json';
}

function ensure_data_dir() {
    if (!is_dir(DATA_DIR)) {
        @mkdir(DATA_DIR, 0775, true);
    }

    if (!is_dir(DATA_DIR) || !is_writable(DATA_DIR)) {
        output_json(array(
            'ok' => false,
            'error' => 'data folder is not writable by PHP/Apache.'
        ), 500);
    }
}

function load_records($name) {
    ensure_data_dir();

    $file = data_file($name);
    if (!file_exists($file)) {
        return array();
    }

    $raw = @file_get_contents($file);
    if ($raw === false || trim($raw) === '') {
        return array();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return array();
    }

    return isset($decoded['records']) && is_array($decoded['records'])
        ? array_values($decoded['records'])
        : array();
}

function save_records($name, $records) {
    ensure_data_dir();

    $payload = array(
        'userName' => $name,
        'records' => array_values($records),
        'updatedAt' => gmdate('c')
    );

    $json = json_encode(
        $payload,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    if ($json === false) {
        output_json(array('ok' => false, 'error' => 'Unable to encode records.'), 500);
    }

    $file = data_file($name);

    if (@file_put_contents($file, $json, LOCK_EX) === false) {
        output_json(array(
            'ok' => false,
            'error' => 'Unable to write records to data folder.'
        ), 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    output_json(array('ok' => false, 'error' => 'POST only.'), 405);
}

$raw = file_get_contents('php://input');
$body = json_decode($raw ? $raw : '{}', true);

if (!is_array($body)) {
    output_json(array('ok' => false, 'error' => 'Invalid request.'), 400);
}

$action = isset($body['action']) ? (string)$body['action'] : '';
$name = clean_name(isset($body['userName']) ? $body['userName'] : '');

if ($action === 'load') {
    output_json(array(
        'ok' => true,
        'records' => load_records($name)
    ));
}

if ($action === 'saveAll') {
    $records = isset($body['records']) && is_array($body['records'])
        ? $body['records']
        : array();

    save_records($name, $records);

    output_json(array(
        'ok' => true,
        'records' => $records
    ));
}

output_json(array('ok' => false, 'error' => 'Unknown action.'), 400);
