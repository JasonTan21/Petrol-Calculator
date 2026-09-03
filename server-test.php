<?php
header('Content-Type: text/plain; charset=utf-8');
echo "PHP is working\n";
echo "PHP version: " . PHP_VERSION . "\n";
echo "data folder exists: " . (is_dir(__DIR__ . '/data') ? 'YES' : 'NO') . "\n";
echo "data folder writable: " . (is_writable(__DIR__ . '/data') ? 'YES' : 'NO') . "\n";
