const electron = require('electron');
const rq = require('request-promise');
const notifier = require('node-notifier');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

let mainWindow

app.on('window-all-closed', function() {
    app.quit();
});

app.on('ready', function() {
  var mainAddr = 'http://127.0.0.1:0089'; // url yang akan di load

  var openWindow = function(){
    mainWindow = new BrowserWindow({
    show: false,
    fullscreen: true,
    toolbar: false,
    title: 'ODOO EXAMPLE',
    icon: '/home/me/Downloads/icon.jpg',
    width: 800,
    height: 600,
    backgroundColor: '#37b8fb',
    'auto-hide-menu-bar': true,
    webPreferences: {
        nodeIntegration: false
          }
    });

    mainWindow.loadURL(mainAddr);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setAutoHideMenuBar(true);
//     mainWindow.webContents.openDevTools(); // uncomment jika ingin mengkatifkan developer bar

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    
    mainWindow.on('closed', function() {
      notifier.notify({
        title: 'INFO',
        message: "Thanks For Using ODOO \n Send Your Feedback to repodevs@gmail.com :)",
        sound: true
      });
      mainWindow = null;
    });
  };

  console.log('Odoo Started to '+ mainAddr);
  
  var startUp = function(){
  rq(mainAddr)
     .then(function(htmlString){
       console.log('server started!');
       notifier.notify({
         title: 'INFO',
         message: 'ODOO Server started',
         sound: true
       });

       openWindow();
     })
     .catch(function(err){
        t = new Date().toUTCString()
        console.log('waiting for the server start...'+ t);
        notifier.notify({
          title: 'WARNING',
          message: 'Try to connecting to odoo server...',
          sound: true,
          wait: true
        });
        setTimeout(startUp, 10000)
     });
 };

  // lets fire!
 startUp();
});