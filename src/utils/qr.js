const QRCode = require('qrcode');

async function toDataUrl(qr) {
  if (!qr) return null;
  return QRCode.toDataURL(qr);
}

module.exports = {
  toDataUrl
};
