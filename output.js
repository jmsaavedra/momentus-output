/***********************************************/
/*  MOMENTUS.IO OUTPUT DEVELOPMENT APPLICATION */
/*                                             */
/***********************************************/


var PROTOTYPE_VERSION = '2A';
var logo ='\n\n________  ___                                 _____                 \n'+'_____   |/  /______ _______ ___ _____ _______ __  /_____  __________\n'+'____  /|_/ / _  __ \\__  __ `__ \\_  _ \\__  __ \\_  __/_  / / /__  ___/\n'+'___  /  / /  / /_/ /_  / / / / //  __/_  / / // /_  / /_/ / _(__  ) \n'+'__/_/  /_/   \\____/ /_/ /_/ /_/ \\___/ /_/ /_/ \\__/  \\__,_/  /____/  BETA '+PROTOTYPE_VERSION+'\n\n'+">>>> OUTPUT TEST APP <<<<"+'\n\n';

// set up ======================================================================
var http         = require('http'),
    express      = require('express'),
    app          = express(),
    colors       = require('colors'),
    port         = process.env.PORT || 8080,
    path         = require('path'),
    fs           = require('fs'),
    _            = require('lodash');


//=== what are you testing =========================================================
var myTestModule = './modules/output/canvas_v4'; //your module you want to test

// edit this JSON object to change out images, etc //
var myTestMoment = JSON.parse(fs.readFileSync('./moments/test_moment.json', 'utf8')); //fake moment object


//=== app globals + config =========================================================
global.log = require('console-log-level')({ level: 'info' });
global._ = _;
global.APPDIR = __dirname;

app.use(express.static(path.join(__dirname, 'public')));


//=== launch ======================================================================
http.createServer(app).listen(port, function() { //server just in case this is useful later
  console.log('\n\n'+logo.gray+'\n\n');
  log.info('\n    Momentus Output Dev App Started    '.white.inverse);
  // var listeningString = '        Listening on port ' + port + '         ';// log.info(listeningString.cyan.inverse);
  log.info('Running output module: '.cyan+myTestModule);
  var run = new require(myTestModule)(myTestMoment, function(e, outputObj){
      log.info(">>> output test complete: ".cyan);
      if(e){
        log.error(' output module FAILED: '.red.bold.inverse+myTestModule);
        log.error(' ERROR: '.red.bold.inverse+e);
      } else {
        log.info(">>> SUCCESS. output object: \n".green + JSON.stringify(outputObj, null, '\t'));  
      }
    });
});
