const { app, BrowserWindow, dialog, Menu, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');

let mainWindow;

// Set to true once the user has actually chosen to exit (via the
// File > Exit menu / Alt+F4, or an update is about to install).
// The window is created with closable:false so the OS-level close
// (and therefore app.quit()) is normally blocked; this flag is how
// we tell the 'close' handler below "no really, let it go".
let isQuitting = false;

// ============================================================
// APP CONFIGURATION
// ============================================================

app.commandLine.appendSwitch('disable-features', 'msWindowsTaskbar');

// ============================================================
// AUTO UPDATER
// ============================================================
//
// The portable edition produced by Electron Packager does not
// have an installer/updater mechanism. The application therefore
// only attempts automatic updates when an installed version is
// explicitly configured to allow them.
//
// Set HIRAGANA_DOJO_DISABLE_UPDATES=1 to disable updates.
//
// ============================================================

const disableUpdates =
  process.env.HIRAGANA_DOJO_DISABLE_UPDATES === '1';

if (!disableUpdates) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
}

// ============================================================
// CLOSE OTHER APPS
// ============================================================
//
// Best-effort: asks other top-level windows to close gracefully
// (CloseMainWindow via PowerShell), then force-kills anything
// still running after a short grace period. Excludes this
// process and a small denylist of core system processes so we
// don't take down the desktop shell. Windows-only (matches the
// rest of this script's Windows-specific lockdown behavior); on
// other platforms this is a no-op.
//
// ============================================================

function closeOtherApps() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      console.log('closeOtherApps: not on Windows, skipping.');
      resolve();
      return;
    }

    const ownPid = process.pid;

    // Processes we never want to touch. Adjust the last entry to
    // match this app's actual built .exe name if it differs.
    const protectedNames = [
      'explorer.exe',
      'dwm.exe',
      'winlogon.exe',
      'csrss.exe',
      'wininit.exe',
      'services.exe',
      'lsass.exe',
      'svchost.exe',
      'ctfmon.exe',
      'Japanese Boost Dojo App.exe'
    ];

    const protectedFilter = protectedNames
      .map((n) => `($_.ProcessName + '.exe') -ne '${n}'`)
      .join(' -and ');

    const buildFilterScript = (action) => `
      Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and
        $_.Id -ne ${ownPid} -and
        ${protectedFilter}
      } | ForEach-Object { ${action} }
    `.replace(/\s+/g, ' ');

    // Step 1: ask windows nicely to close (lets apps prompt to save, etc.)
    const closeScript = buildFilterScript('$_.CloseMainWindow() | Out-Null');

    exec(
      `powershell -NoProfile -Command "${closeScript}"`,
      (closeError) => {
        if (closeError) {
          console.error('Error closing other apps gracefully:', closeError);
        }

        // Step 2: give apps a moment to close/save, then force-kill stragglers.
        setTimeout(() => {
          const killScript = `
            Get-Process | Where-Object {
              $_.MainWindowHandle -ne 0 -and
              $_.Id -ne ${ownPid} -and
              ${protectedFilter}
            } | Stop-Process -Force -ErrorAction SilentlyContinue
          `.replace(/\s+/g, ' ');

          exec(
            `powershell -NoProfile -Command "${killScript}"`,
            (killError) => {
              if (killError) {
                console.error('Error force-closing remaining apps:', killError);
              }
              resolve();
            }
          );
        }, 3000); // 3s grace period for graceful closes to finish
      }
    );
  });
}

// ============================================================
// QUIT
// ============================================================
//
// closable:false / minimizable:false / kiosk mode all fight a
// plain app.quit(), because app.quit() still tries to close each
// BrowserWindow first, and closable:false blocks that. This is
// what made "File > Exit" appear to do nothing. quitApp() marks
// intent to quit, destroys the window directly (bypassing the
// blocked close path), then force-exits the app.
//
// ============================================================

function quitApp() {
  isQuitting = true;

  globalShortcut.unregisterAll();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }

  app.exit(0);
}

// ============================================================
// BLOCK VIRTUAL DESKTOP SWITCHING
// ============================================================
//
// Ctrl+Win+Left / Ctrl+Win+Right normally switch Windows virtual
// desktops, which would let someone swipe away from the locked-down
// window. Registering them as global shortcuts with a no-op handler
// claims the hotkey system-wide so Windows never acts on it while
// the app is running. Released again in quitApp()/before-quit so we
// don't leave a stray hotkey registration behind after exit.
//
// ============================================================

function blockVirtualDesktopSwitching() {

  const blockedAccelerators = [
    'Control+Super+Left',
    'Control+Super+Right'
  ];

  blockedAccelerators.forEach((accelerator) => {

    try {

      globalShortcut.register(accelerator, () => {
        // Intentionally empty: swallow the key combo.
      });

    } catch (error) {

      console.error(
        `Unable to block ${accelerator}:`,
        error
      );
    }
  });
}

// ============================================================
// CREATE WINDOW
// ============================================================

function createWindow() {

  // ==========================================================
  // MENU
  // ==========================================================

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',

      submenu: [
        {
          label: 'Exit',

          accelerator: 'Alt+F4',

          click: () => {
            quitApp();
          }
        }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);

  // ==========================================================
  // BROWSER WINDOW
  // ==========================================================

  mainWindow = new BrowserWindow({

    title: 'Japanese Boost Dojo App',

    // ========================================================
    // FULLSCREEN
    // ========================================================
    //
    // NOTE: We deliberately do NOT use kiosk:true here. Electron's
    // kiosk mode forces the frame/menu bar to hide on Windows even
    // when frame:true is set - that contradiction is what made the
    // File menu (and therefore File > Exit) unreachable once the
    // window went fullscreen. Plain fullscreen + the restrictions
    // below gets the same locked-down feel while keeping the menu
    // usable. fullscreenable is left true (default) since setting
    // it false while also setting fullscreen:true is contradictory
    // and can stop setFullScreen() from taking effect reliably.
    // ========================================================

    fullscreen: true,

    // ========================================================
    // WINDOW RESTRICTIONS
    // ========================================================

    minimizable: false,

    maximizable: false,

    closable: false,

    resizable: false,

    movable: false,

    // Keep frame so File menu remains available.
    frame: true,

    // Keep the application above normal windows.
    alwaysOnTop: true,

    // ========================================================
    // WEB PREFERENCES
    // ========================================================

    webPreferences: {

      partition: 'persist:hiraganadojo',

      nodeIntegration: false,

      contextIsolation: true,

      webSecurity: true
    }
  });

  // ==========================================================
  // READY
  // ==========================================================

  mainWindow.once('ready-to-show', () => {

    if (!mainWindow.isDestroyed()) {

      mainWindow.setFullScreen(true);

      mainWindow.setAlwaysOnTop(true);

      mainWindow.focus();
    }
  });

  // ==========================================================
  // MENU BAR
  // ==========================================================

  mainWindow.setAutoHideMenuBar(false);

  mainWindow.setMenuBarVisibility(true);

  // ==========================================================
  // LOAD WEBSITE
  // ==========================================================
  //
  // NOTE: fixed a duplicated "https://" typo from the original
  // script that would have made this URL fail to load.
  //
  // ==========================================================

  mainWindow.loadURL(
    'https://dojo.japaneseboost.com/'
  );

  // ==========================================================
  // RE-ASSERT LOCKDOWN (only when actually needed)
  // ==========================================================
  //
  // Previously this was also triggered on every 'focus' event,
  // which fired setKiosk()/setFullScreen() constantly - even when
  // the window was already fullscreen - and caused visible
  // flicker/stutter on Windows as it fought the OS window manager.
  // Now it only fires from the specific "we actually left that
  // state" events below, and only calls the setters when the
  // window isn't already in the desired state.
  //
  // ==========================================================

  function reassertLockdown() {

    if (isQuitting || mainWindow.isDestroyed()) {
      return;
    }

    if (!mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(true);
    }

    mainWindow.focus();
  }

  // ==========================================================
  // PREVENT MINIMIZING
  // ==========================================================

  mainWindow.on('minimize', (event) => {

    if (isQuitting) {
      return;
    }

    event.preventDefault();

    if (!mainWindow.isDestroyed()) {
      mainWindow.restore();
      reassertLockdown();
    }
  });

  // ==========================================================
  // PREVENT LEAVING FULLSCREEN
  // ==========================================================

  mainWindow.on('leave-full-screen', reassertLockdown);

  // ==========================================================
  // PREVENT LEAVING HTML FULLSCREEN
  // ==========================================================

  mainWindow.on('leave-html-full-screen', reassertLockdown);

  // ==========================================================
  // BLOCK NATIVE CLOSE UNLESS WE'RE ACTUALLY QUITTING
  // ==========================================================
  //
  // closable:false already hides/disables the native close button
  // on most platforms, but this is the belt-and-suspenders version:
  // if anything ever fires a close (Alt+F4 caught by the OS before
  // our accelerator, an updater path, etc.) and we did NOT set
  // isQuitting via quitApp(), swallow it so kiosk lockdown holds.
  //
  // ==========================================================

  mainWindow.on('close', (event) => {

    if (!isQuitting) {
      event.preventDefault();
    }
  });

  // ==========================================================
  // UPDATE CHECK
  // ==========================================================
  //
  // Only fires when updates aren't disabled. Errors are caught so
  // a failed/offline check never blocks the app from launching.
  // Actual update handling (download progress, install prompt) is
  // wired up via the autoUpdater event listeners below, which are
  // registered once at module load time - not inside createWindow -
  // so they're active for the whole app lifetime, not just while a
  // window exists.
  //
  // ==========================================================

  if (!disableUpdates) {

    try {

      autoUpdater.checkForUpdatesAndNotify();

    } catch (error) {

      console.error(
        'Unable to check for updates:',
        error
      );
    }
  }
}

// ============================================================
// ELECTRON READY
// ============================================================

app.whenReady().then(async () => {

  blockVirtualDesktopSwitching();

  const choice = dialog.showMessageBoxSync({

    type: 'warning',

    title: 'Before You Continue',

    message:
      'Please close all other applications before continuing.',

    detail:
      'Japanese Boost Dojo App runs in a locked, full-screen mode. ' +
      'Clicking Continue will close other open applications automatically.',

    buttons: [
      'Continue',
      'Cancel'
    ],

    defaultId: 0,

    cancelId: 1
  });

  if (choice === 1) {
    app.exit(0);
    return;
  }

  await closeOtherApps();

  createWindow();

});

// ============================================================
// UPDATE DOWNLOADED
// ============================================================
//
// Registered at module scope (once), not per-window, so it will
// still fire correctly even if createWindow() were ever called
// more than once. Guarded by disableUpdates so it's inert in the
// portable/no-updater build.
//
// ============================================================

autoUpdater.on('update-downloaded', () => {

  if (disableUpdates) {
    return;
  }

  dialog.showMessageBox({

    type: 'info',

    title: 'Update Ready',

    message:
      'A new version of Japanese Boost Dojo App is ready. Restart now to apply?',

    buttons: [
      'Restart',
      'Later'
    ]

  }).then((result) => {

    if (result.response === 0) {

      // Must set isQuitting BEFORE quitAndInstall(), otherwise the
      // 'close' handler above (closable:false lockdown) will swallow
      // the close event quitAndInstall() triggers and the update
      // will silently fail to install.
      isQuitting = true;

      autoUpdater.quitAndInstall();
    }
  });
});

// ============================================================
// AUTO UPDATE EVENTS
// ============================================================

autoUpdater.on('error', (error) => {
  console.error(
    'AutoUpdater Error:',
    error
  );
});

autoUpdater.on('checking-for-update', () => {
  console.log(
    'Checking for updates...'
  );
});

autoUpdater.on('update-available', () => {
  console.log(
    'Update available.'
  );
});

autoUpdater.on('update-not-available', () => {
  console.log(
    'No updates available.'
  );
});

// ============================================================
// APP EVENTS
// ============================================================

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});