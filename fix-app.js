const fs = require('fs');
const path = require('path');

const appFilePath = path.join(__dirname, 'src', 'App.js');

// 파일 읽기 (UTF-8 인코딩)
let content = fs.readFileSync(appFilePath, 'utf8');

// API_URL이 이미 정의되어 있는지 확인
if (!content.includes('const API_URL')) {
  // API_URL 정의 추가
  content = content.replace(
    /import { useState, useEffect, useRef, useCallback } from "react";[\s\S]*?const CATEGORIES/,
    `import { useState, useEffect, useRef, useCallback } from "react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QrScanner from 'qr-scanner';

// ───────── API 설정 ─────────
const API_URL = \`http://\${window.location.hostname}:3003\`;

// ───────── 더미 데이터 ─────────
const CATEGORIES`
  );
}

// 모든 'http://localhost:3003'을 '${API_URL}'로 변경
content = content.replace(/http:\/\/localhost:3003/g, '${API_URL}');

// 파일 쓰기
fs.writeFileSync(appFilePath, content, 'utf8');
console.log('✓ App.js 수정 완료');
