// core/qr.js — Sinh mã QR (SVG) ngay trên máy, KHÔNG gửi gì ra ngoài.
// QR chứa link tra cứu tĩnh: https://laptop24hstore.vn/tra-cuu-bao-hanh?ma=<KEY>

let _qrPromise = null;

// Tải thư viện qrcode-generator (cdnjs) một lần.
export function ensureQrLib() {
  if (window.qrcode) return Promise.resolve();
  if (_qrPromise) return _qrPromise;
  _qrPromise = new Promise(function (res) {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    s.onload = function () { res(); };
    s.onerror = function () { res(); };
    document.head.appendChild(s);
  });
  return _qrPromise;
}
ensureQrLib();

// Link tra cũu cho một Key (Firebase push id). Key an toàn URL nên dán thẳng.
export function qrLookupUrl(key) {
  return 'https://laptop24hstore.vn/tra-cuu-bao-hanh?ma=' + String(key == null ? '' : key);
}

// Trả về chuỗi <svg> mã hoá text. '' nếu thư viện chưa sẵn sàng / lỗi.
export function qrSvg(text, cellSize, margin) {
  try {
    if (!window.qrcode || !text) return '';
    var qr = window.qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    return qr.createSvgTag({ cellSize: cellSize || 3, margin: (margin == null ? 1 : margin), scalable: true });
  } catch (e) { return ''; }
}

// Khối QR hoàn chỉnh (SVG + chú thích) để chèn vào phiếu in. '' nếu không có key.
export function qrBlock(key, caption) {
  var svg = qrSvg(qrLookupUrl(key));
  if (!svg) return '';
  var cap = caption || 'Quét để tra cứu bảo hành / tình trạng máy';
  return '<div style="display:flex;align-items:center;gap:10px;justify-content:center;margin:8px 0">' +
    '<div style="width:92px;height:92px;flex:none">' + svg + '</div>' +
    '<div style="font-size:11px;color:#333;line-height:1.5;white-space:nowrap">' +
    '<b>📱 ' + cap + '</b><br>laptop24hstore.vn/tra-cuu-bao-hanh</div>' +
    '</div>';
}
