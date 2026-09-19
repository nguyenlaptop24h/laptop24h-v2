// Laptop 24h - Bản desktop (Electron)
// Mở phần mềm web (GitHub Pages) trong một cửa sổ ứng dụng riêng.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const APP_URL = 'https://nguyenlaptop24h.github.io/laptop24h-v2/';

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,           // ẩn thanh menu (nhấn Alt để hiện)
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadURL(APP_URL);

  // Mở link ngoài (target=_blank, tel:, mailto:...) bằng trình duyệt mặc định
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Nếu mất mạng / lỗi tải trang → thử lại sau 3 giây
  win.webContents.on('did-fail-load', (e, code, desc, validatedURL, isMainFrame) => {
    if (isMainFrame) setTimeout(() => win.loadURL(APP_URL), 3000);
  });
}

// Menu tối giản: Tải lại, In, Phóng to/nhỏ, Toàn màn hình
function buildMenu() {
  const template = [
    {
      label: 'Ứng dụng',
      submenu: [
        { label: 'Tải lại', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        { label: 'In', accelerator: 'CmdOrCtrl+P', click: () => win && win.webContents.print() },
        { type: 'separator' },
        { label: 'Phoóng to', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Thu nhỏ', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Cỡ mặc định', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toàn màn hình', accelerator: 'F11', role: 'togglefullscreen' },
        { label: 'Thoát', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
