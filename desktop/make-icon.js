// Tạo build/icon.ico từ logo cửa hàng (logo.png.JPG ở thư mục gốc repo).
// Chạy tự động trước khi build. Nếu không tìm thấy logo thì bỏ qua (dùng icon mặc định).
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const Jimp = require('jimp');
    const pngToIco = require('png-to-ico');

    // Tìm logo ở gốc repo (thư mục cha của desktop) hoặc ngay trong desktop
    const candidates = [
      path.join(__dirname, '..', 'logo-vang.jpg'),
      path.join(__dirname, '..', 'logo.png.JPG'),
      path.join(__dirname, '..', 'logo.png'),
      path.join(__dirname, '..', 'logo.jpg'),
      path.join(__dirname, 'logo-vang.jpg'),
      path.join(__dirname, 'logo.png')
    ];
    const logoPath = candidates.find(p => fs.existsSync(p));

    const buildDir = path.join(__dirname, 'build');
    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

    const S = 256;
    let canvas;
    if (logoPath) {
      const logo = await Jimp.read(logoPath);
      logo.scaleToFit(S - 24, S - 24);
      canvas = new Jimp(S, S, 0xffffffff); // nền trắng
      canvas.composite(logo, Math.round((S - logo.getWidth()) / 2), Math.round((S - logo.getHeight()) / 2));
      console.log('Tao icon tu logo:', path.basename(logoPath));
    } else {
      // Du phong: nen xanh dam + chu "24h"
      canvas = new Jimp(S, S, 0x1e293bff);
      try {
        const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
        canvas.print(font, 0, 0, { text: '24h', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, S, S);
      } catch (_) {}
      console.log('Khong thay logo -> dung icon du phong "24h".');
    }

    const pngPath = path.join(buildDir, 'icon.png');
    await canvas.writeAsync(pngPath);

    const icoBuf = await pngToIco([pngPath]);
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuf);
    console.log('Da tao build/icon.ico');
  } catch (e) {
    console.log('Khong tao duoc icon (' + e.message + '), dung icon mac dinh.');
  }
})();
