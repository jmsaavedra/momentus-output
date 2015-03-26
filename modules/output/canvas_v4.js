
var Canvas    = require('canvas'),
    async     = require('async'),
    _         = require('lodash'),
    spawn     = require('child_process').spawn,
    debug     = function(msg){ log.info("/output/Output_canvas_v3:: ".magenta.bold+msg); },
    // S3        = require('../storage/S3Utils'),
    path      = require('path'),
    GifEncoder = require('gif-encoder'),
    // User      = require('./../../models/user'),
    // Output    = require('./../../models/output'),
    // Moment    = require('./../../models/moment'),
    // Story     = require('./../../models/story'),
    Folders = require('./../utils/FolderUtils');
    gm        = require('gm'),
    rimraf    = require('rimraf'),
    request = require("request"),
    fs        = require('fs');


var googleGeocoder = require('node-geocoder').getGeocoder('google', 'http', {});
var osmGeocoder = require('node-geocoder').getGeocoder('openstreetmap', 'http', {});

/* Canvas & GIFEncoder creations */
/* canvas install - */

/** output module information **/
//  about this module, author, and it's output //
var module_info = {
  name : "canvas_v4",
  version : "0.7",
  output_type : "image/gif", //mime-type
  description : "node-canvas module with new gif lib, cairo rendering engine. queries lat/lon for street, city, state.",
  author : {
    name: "momentus team",
    url: "http://momentus.io"
  }
};

var canvas_v4 = function(obj,cb){
  //debug("THIS OUTPUT PROCESS obj: ".inverse+JSON.stringify(obj, null, '\t')); //*** uncomment to see the entire thing ***//
  debug("[Starting Output Module: ".cyan+module_info.name+" version ".cyan+module_info.version+" ]".cyan);
  var now_unix = new Date().getTime();

  //*** file and path globals ***//
  var thisOutputFileName = now_unix.toString()+'_canvas_v4_output.gif'; //unique string for this output file
  var localMomentPath = path.join(__dirname, obj.moment.path.local);
  debug("L : "+localMomentPath);
  var localModuleProcessFolder = path.join(localMomentPath, obj.module.toString());
  var thisLocalOutputFilePath = path.join(localModuleProcessFolder, thisOutputFileName);
  var momentusLogoFile = 'http://momentus.io/img/logo/madewith_nourl.png';
  var setupComplete = false;
  //** check that all of our local process folders exist, or make them **//
  async.mapSeries([ path.join(__dirname,'../../moments/temp'),
                    localMomentPath,
                    localModuleProcessFolder ],
    Folders.checkDir,
    function(err, results){
      if(err) debug("error creating folders".red);
      beginDownloads();
  });

  function beginDownloads(){
    debug("begin download of ".cyan.bold+ obj.moment.stories.length+ " stories files".cyan.bold);

    //*** download all images first ***//
    async.mapSeries(obj.moment.stories,function(thisStory, _callback){ //iterate through stories in order

      var storyId = thisStory._id;
      //var findFile = path.basename(thisStory.file.path);
      var thisFile = thisStory.file.path; //_.contains(obj.files, findFile) ? findFile : callback("story.file not found in obj.files: "+findFile);
      var MomentParticipants = obj.moment.participants;
      var backupProfilePic = 'http://momentus.io/img/moment-placeholder/puppy_profile.png';
      //debug("thisStory.user: "+JSON.stringify(thisStory.user));
      var userPicfileType = '.png'; //twitter
      var userPic = thisStory.user.twitter ? thisStory.user.twitter.profileImg : null;
      if(!userPic){
        userPicfileType = '.JPG'; //fb profile pics
        userPic = thisStory.user.facebook ? thisStory.user.facebook.profileImg : backupProfilePic;
      }
      var userPicLocal = path.join(localModuleProcessFolder,thisStory._id+'_profileImg'+userPicfileType);
      var userPicLocalSized = path.join(localModuleProcessFolder,thisStory.user._id+'_profileImg_resized'+userPicfileType);

      var storyPicLocal = path.join(localModuleProcessFolder,thisStory._id+'_storyImg.jpg');

      //*** DOWNLOAD ALL NEEDED FILES AND STORE LOCAL FILE URIs TO THIS MOMENT ***//
      async.parallel([
        async.apply(downloadImage, userPic, userPicLocal), //downloadImage(picUrl, picDestinationLocalPath)
        async.apply(downloadImage, thisFile, storyPicLocal)

      ], function(e, downloadedFiles){
        if(e) debug('error downloading Files: '.red+e);
        debug("storyId: "+storyId+ " downloadedFiles.length: ".cyan+downloadedFiles.length);
        // debug("downloadedFiles: ".yellow+JSON.stringify(downloadedFiles));
        thisStory.user.profileImgLocal = downloadedFiles[0];
        thisStory.file.storyImgLocal   = downloadedFiles[1];
        _callback(e, thisStory)
      });
    }, function(e, theseStories){
      if(e) return cb(e);
      debug("download of all story + user images complete".green);
      debug("theseStories.length: ".cyan+theseStories.length);
      // debug("theseStories: ".yellow+JSON.stringify(theseStories));

      //*** we have all files downloaded. go go go !
      //ProcessMoment(rawImageBuffers);
    });
  }


  //*** output module globals and setup ***//
  // var gif = new GifEncoder(500,500,{highWaterMark:999999999}); //default process memory limit is 64kb, way too small.
  // var file = fs.createWriteStream(thisLocalOutputFilePath);
  // gif.pipe(file);
  // gif.setQuality(20); // image quality. 10 is default.
  // gif.setRepeat(0); //-1, play once. 0, loop indefinitely. positive number, loop n times.
  // // gif.setFrameRate(10);
  // // gif.setDispose(1);
  // gif.writeHeader();



  var storyCt = 1;

  function ProcessMoment(rawImageBuffs){

    //***** go through every story *****//
    async.mapSeries(obj.moment.stories,function(thisStory, _callback){

      //-- do any API stuff to this moment, get any data needed for processing ****//
      getCityState(thisStory, function(_e, _updatedStory){
        if(_e) return _callback(_e); //get out, this output module won't work for you.

        //--  PROCESS THIS INDIVIDUAL STORY DATA + IMAGE + ******//
        processSingleOverlayImage(rawImageBuffs, _updatedStory, gif, function(e){
          if(e) debug("error on processOverlayImage: ".red + e);
          _callback(e);
        });
      });

    },function(err){

      //*** DONE PROCESSING ALL FILES INDIVIDUALLY -- wrap it up ***//
      if(err) return debug('outputModule 02 error creating Overlays: '.red+err);
      debug('  All individual files have been processed successfully  '.cyan.inverse);

      // gif.finish(); //finish the gif file, it's now saved locally
      gif.finish();

      var newOutput = {};//new Output(module_info);
      newOutput.moment = obj.moment._id;
      newOutput.file_url = S3OutputFilePath;
      //fs.readFile(thisLocalOutputFilePath, function(__erro, _buf){
      gm(thisLocalOutputFilePath) //using gm() just to encode to Buffer for upload
      .toBuffer('GIF',function (err, _buf) { //toBuffer for immediate upload
        if (err) return debug("toBufferErr: ".red, err);
        // S3.uploadFile(S3OutputKey, _buf, module_info.output_type, function(err, FileInfo){
          if(err) debug("err S3 uploadFile: ".read+err);
          //**** delete all local (ec2) process files ****//
          rimraf(path.dirname(thisLocalOutputFilePath), function(e){
            newOutput.save(function(e, _newOutput){
              if(e) return debug("error updating moment with output file in Moments: ".red + e);
              //ThisMoment.addOutputFileById(obj.moment._id, newOutput._id, function(__e){
              debug("_newOutput: ".cyan+JSON.stringify(_newOutput));
                if(__e) return debug("error updating moment with output file in Moments: ".red + __e);
                // debug("outputFile: ".green+FileInfo.path+" saved to moment: ".green+obj.moment._id);
                debug("OUTPUT MODULE ".bold+obj.module+" - DONE. ".bold+"//output object id: ".green+newOutput._id+"\n// output file: ".green+S3OutputFilePath+"\n// saved to moment: ".green+obj.moment._id);
                //**** FINAL CALLBACK, WE'RE DONE HERE ****//
                cb(null, S3OutputFilePath);
              //});
            });
          });
        //});
      });
    });


    function processSingleOverlayImage(_rawImageBufs, _story, _gif, _cb){

      debug("hit processOverlayImage #"+(storyCt));
      debug("_story: ".cyan.inverse + JSON.stringify(_story, null, '\t'));

      // pull this story's image out of the array of buffers:
      var thisImgBuf = _.result(_.find(_rawImageBufs,{storyId: _story._id}), 'buf');

      var _user = _story.user,
      Image     = Canvas.Image,
      canvas    = new Canvas(500,500),
      img       = new Image();

      // stick this buffer into Canvas.Image object. ** it comes as binary! **
      img.src   = new Buffer(thisImgBuf, 'binary');

      var author    = _user.local.name ? _user.local.name + ' is' : 'anonymous is',
          _comment  = _story.comment,
          comment   = [],
          location  = [_story.loc.street_name, _story.loc.city+', '+_story.loc.state];//location string array (of lines)

      /* "clever" font sizing and line breaking based on comment length */
      var commentSize = 34;
      if (_story.comment.length < 15){
        commentSize = 36;
        comment.push(_story.comment);
      }
      else if (_story.comment.length <= 32){
        comment.push(_story.comment);
      }
      else if (_story.comment.length > 32){
        var indexToLineBreak;
        for(var i=0; i<_story.comment.length;i++) {
          if (_story.comment[i] === " "){
            if ( i > 28){
              indexToLineBreak = i;
              break;
            }
          }
        }
        commentSize = 26;
        if(indexToLineBreak > 22)
          //comment = comment.slice(0, indexToLineBreak) + "\/n" + comment.slice(indexToLineBreak+1, comment.length);
          comment.push(_story.comment.slice(0, indexToLineBreak));
          comment.push(_story.comment.slice(indexToLineBreak+1, _story.comment.length));
      }

      debug("comment: "+JSON.stringify(comment));

      var smallestSide = img.height >= img.width ? img.width : img.height; //got smaller size
      var sizeScaler = 500/smallestSide; //because most images are not 500, find a scaler to multiply against
      // debug("img sizeScaler: ".yellow+sizeScaler);

      var imgDH = 500/sizeScaler;
      var imgDW = 500/sizeScaler;

      var starty = ((img.height/2) - imgDH/2);
      var startx = ((img.width/2) - imgDW/2);



      function draw1(cb){
        var numFramesTotal = 10;
        var frameCt = 0;

        //*** create my context ***//
        //*** https://github.com/Automattic/node-canvas ***//
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        // ctx.antialias = 'subpixel';
        // ctx.scale(imgDH, imgDW);
        // ctx.setTransform(1, 0, 0, 1, 0, 0);

        // for(var i=0; i<numFramesTotal; i++)
        async.whilst(
          function () { return frameCt < numFramesTotal; },
          function(_callback){
            ctx.globalAlpha = 1;

            //black bg
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 500, 500);
            currFade = map(frameCt, [0,numFramesTotal-1],[0.0, 1.0]);
            currFade = truncate(currFade, 2);
            debug('mini frame: '.yellow+frameCt + " // currFade: ".gray+currFade);

            //set global fade
            ctx.globalAlpha = currFade;

            //draw IMAGE
            ctx.drawImage(img, startx, starty, imgDW, imgDH, 0, 0, 500, 500);

            //LOCATION font/text settings
            ctx.fillStyle = '#FFF';
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#000';
            ctx.textAlign = "right";
            ctx.font = 'normal 30px Impact';//'25px AvantGarde-Book';

            //draw LOCATION stroke and fill texts
            ctx.strokeText(location[0], 470, 50);
            ctx.fillText(location[0], 470, 50);
            ctx.strokeText(location[1], 470, 100);
            ctx.fillText(location[1], 470, 100);

            ctx.globalAlpha = 1;
            ctx.save();

            //COMMENT string metrics
            ctx.font = 'normal '+commentSize+'px Futura';//'40px AvantGarde-Demi';
            var metric = ctx.measureText(comment[0]);
            // debug("metric: ".bold + JSON.stringify(metric));
            // metric: {"width":265.7958984375,"actualBoundingBoxLeft":262.79296875,"actualBoundingBoxRight":1.23046875,"actualBoundingBoxAscent":23.7158203125,"actualBoundingBoxDescent":2.724609375,"emHeightAscent":30.263671875,"emHeightDescent":6.328125,"alphabeticBaseline":0}

            //draw gray square behind comment
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            //ctx.fillRect(0,canvas.height-metric.width-65,comment.length*75,600); //(canvas.height-(canvas.height-metric.width))
            ctx.fillRect(0,0,30+comment.length*50,500); //(canvas.height-(canvas.height-metric.width))
            //comment font/text settings
            ctx.textAlign = "left";
            ctx.fillStyle = '#CAE1FF';
            ctx.strokeStyle = '#00C5CD';

            //rotate comment placement
            var cx = 50;
            var cy = 475;
            ctx.translate(cx,cy);
            ctx.rotate(-90 * Math.PI / 180);
            ctx.translate(-cx,-cy);

            //draw comment
            for(var j=0; j<comment.length; j++){
              ctx.fillText(comment[j], cx, cy+45*j);
            }

            // ctx.strokeText(comment, cx, cy);

            if(frameCt===0 || frameCt===numFramesTotal-1) _gif.setDelay(850);
            else _gif.setDelay(50);
            _gif.addFrame(ctx.getImageData(0,0,500,500).data);

            ctx.restore();
            frameCt++;
            _callback();
          },
          function(_err){
            cb(null);
          });
      }


      function drawLogo(cb){
        if(storyCt === obj.moment.stories.length){ //just finished the last story, add logo
          debug("-------- adding logo animation ----------".green);
          //*** create my context ***//
          //*** https://github.com/Automattic/node-canvas ***//
          // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
          var ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          var numFramesTotal = 6;
          // ctx.antialias = 'subpixel';
          // ctx.scale(imgDH, imgDW);
          // ctx.setTransform(1, 0, 0, 1, 0, 0);
          var madeByLogo = fs.readFile(momentusLogoFile, function(e, logo){
            if(e) return console.log("error loading image: ".red + e);
            var madeByImg = new Image();
            madeByImg.src = logo;
            ctx.textAlign = "left";

            for(var i=0; i<numFramesTotal; i++){

              ctx.globalAlpha = 1;
              ctx.fillStyle = "#FFFFFF";
              ctx.fillRect(0, 0, 500, 500);

              currFade = map(i, [0,numFramesTotal-1],[0.0, 1.0]);
              currFade = truncate(currFade, 2);
              debug('mini frame: '.yellow+i + " // currFade: ".gray+currFade);
              ctx.globalAlpha = currFade;

              ctx.drawImage(madeByImg, 0, 0, 500,500);

              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'normal 36px Futura';//'40px AvantGarde-Demi';
              // ctx.fillText("http://momentus.io", 140, 460);
              ctx.fillText("momentus.io", 260, 460);

              if(i===numFramesTotal-1) _gif.setDelay(850);
              else _gif.setDelay(50);
              _gif.addFrame(ctx.getImageData(0,0,500,500).data);
            }

            for(var j=0; j<numFramesTotal; j++){
              ctx.globalAlpha = 1;
              ctx.fillStyle = "#FFF";
              ctx.fillRect(0, 0, 500, 500);

              var bgFade = map(j, [0, numFramesTotal-1], [0, 255]);
              ctx.globalAlpha = bgFade;
              ctx.fillStyle = "#000";
              ctx.fillRect(0, 0, 500, 500);
              // ctx.fillStyle = '#000';
              // var col = map(j, [0, numFramesTotal-1], [255, 100]);
              // col = truncate(col, 1);
              // ctx.globalAlpha = 1;
              // var col = 255;
              //debug('col: '+col);
              // ctx.fillStyle = 'rgb('+col+','+col+','+col+')';
              // ctx.strokeStyle = 'rgb('+col+','+col+','+col+')';
              // ctx.strokeStyle = '#FFFFFF';
              // ctx.font = 'normal 36px Futura';//'40px AvantGarde-Demi';
              // ctx.strokeText("http://momentus.io", 140, 460);
              // ctx.fillText("http://momentus.io", 140, 460);
              // ctx.strokeText("momentus.io", 260, 460);
              // ctx.fillText("momentus.io", 260, 460);

              currFade = map(j, [0,numFramesTotal-1],[1.0, 0.0]);
              currFade = truncate(currFade, 2);
              debug('mini frame: '.yellow+j + " // currFade: ".gray+currFade);
              ctx.globalAlpha = currFade;

              ctx.drawImage(madeByImg, 0, 0, 500,500);

              ctx.globalAlpha = 1;
              ctx.font = 'normal 36px Futura';//'40px AvantGarde-Demi';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText("momentus.io", 260, 460);

              if(j===numFramesTotal-1) _gif.setDelay(2000);
              else _gif.setDelay(50);
              _gif.addFrame(ctx.getImageData(0,0,500,500).data);
              // if(j===numFramesTotal-1) _gif.finish(); //finish the gif file, it's now saved locally
            }
            return cb(null);
          });
        } else cb(null);
      }


      async.series([ draw1, drawLogo ], function(e){
        if(e) debug("error: ".red+e);
        debug("-----------------------------------".gray);
        storyCt ++;
        _cb();//done with this story, next
      });
    }
  }
};

module.exports = canvas_v3;

/************************ END MODULE *****************************/



/*****************************************************************/
/********************** useful tools *****************************/


function downloadImage(imgUrl, saveAs, cb){
  //var saveToUri = localModuleProcessFolder+'/'+now_unix.toString()+'.jpg';
  fs.exists(saveAs, function (exists){
    if(!exists){
      debug("about to download imgUrl: ".yellow+imgUrl);
      request({ method: 'GET',
               url: imgUrl,
               dest: saveAs
      },function(err, response, body){
        if(err) debug("err downloading image: ".red.inverse + err);
        //debug('server encoded the data as: '.magenta.bold + (response.headers['content-type'] || 'identity'))
        if(response.statusCode == 200){
          debug("img downloaded to: ".green+saveAs);
          // debug("hit 200".green);
          cb(null, saveAs);
        } else cb(response.body);
      }).pipe(fs.createWriteStream(saveAs));
    } else {
      //debug("file already downloaded.".yellow);
      cb(null, saveAs);
    }
  });
}


function sizeImage(_file, _type, cb){

  debug('hit sizeProfileAndProcessOverlays'.green);

  var _thisFile = _file+_type;
  debug("thisFile: ".gray+_thisFile);
  gm(_thisFile).resize(30).write(userPicLocalSized+_type, function (_err) {
    if (_err){
      console.log('err dl + resize profile pic: '.red.inverse+_err);
      //callback(_err);
    } else {
      thisUser.local.profileImgSized = userPicLocalSized+_type; //storing buffer in object
      // thisUser.local.profileImg = buff; //storing buffer in object
      //***** PROCESS THIS INDIVIDUAL STORY DATA + IMAGE + USER ******//
      processOverlayImage(thisFile, thisUser, thisStory, function(){
        callback();
      });
    }
  });
}

//truncate a float
var truncate = function (number, digits) {
  var multiplier = Math.pow(10, digits),
  adjustedNum = number * multiplier,
  truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);
  return truncatedNum / multiplier;
};

//map any number: map(myVal, [fromLow, fromHigh], [toLow, toHigh])
var map = function(s, from, to) {
  return to[0] + (s - from[0]) * (to[1] - to[0]) / (from[1] - from[0]);
};

//geocoder!
function getCityState(_thisStory, cb){
  var thisStory = _thisStory;

  if(!_thisStory.loc.lat || !_thisStory.loc.lon) return (cb("no lat/lon found"));

  googleGeocoder.reverse(_thisStory.loc.lat, _thisStory.loc.lon, function(err, res) {
    // console.log(res);
    debug("GOOGLE lat/long lookup: ".cyan.bold+ JSON.stringify(res));
    var location = {};
    if(res){
      location = res[0];
      thisStory.loc.country        = location.country;
      thisStory.loc.country_code   = location.countryCode;
      thisStory.loc.state          = location.state;
      thisStory.loc.city           = location.city;
      thisStory.loc.zip            = location.zipcode;
      thisStory.loc.street_name    = location.streetName;
      thisStory.loc.street_number  = location.streetNumber;
    }

    if(!location.state || !location.city || !location.streetName){ //three things used in this module
      osmGeocoder.reverse(thisStory.loc.lat, thisStory.loc.lon, function(err, _res) {
        if(_res){
          debug("OPENSTREETMAP lat/long lookup: ".cyan.bold+ JSON.stringify(_res));
          if (!location.state) thisStory.loc.state = _res[0].state;
          if (!location.city) thisStory.loc.city  = _res[0].city;
          if (!location.streetName) thisStory.loc.street_name  = _res[0].streetName;
          cb(err, thisStory);
        } else cb("unable to get location from either geocode provider", null);
      });
    } else cb(null, thisStory);
  });
}






//*** UNUSED, TEST FUNCTIONS ***//
// function draw1a(cb){
//   //for(var i=-10; i<25; i++){
//
//
//   ctx.fillStyle = '#FD0';
//   ctx.fillRect(0,0,75,75);
//   ctx.fillStyle = '#6C0';
//   ctx.fillRect(75,0,75,75);
//   ctx.fillStyle = '#09F)';
//   ctx.fillRect(0,75,75,75);
//   ctx.fillStyle = '#F30';
//   ctx.fillRect(75,75,150,150);
//   ctx.fillStyle = '#FFF';
//
//   // set transparency value
//   ctx.globalAlpha = 0.2;
//
//   // Draw semi transparent circles
//   for (i=0;i<7;i++){
//       ctx.beginPath();
//       ctx.arc(75,75,10+10*i,0,Math.PI*2,true);
//       ctx.fill();
//       _gif.setDelay(50);
//       _gif.addFrame(ctx.getImageData(0,0,500,500).data);
//   }
//   cb(null);
// }


//
// function draw1b(cb){
// ctx.globalAlpha = .2;
//
// ctx.strokeRect(0,0,200,200);
// ctx.lineTo(0,100);
// ctx.lineTo(200,100);
// ctx.stroke();
//
// _gif.setDelay(100);
// _gif.addFrame(ctx.getImageData(0,0,500,500).data);
//
// ctx.beginPath();
// ctx.lineTo(100,0);
// ctx.lineTo(100,200);
// ctx.stroke();
//
// _gif.setDelay(100);
// _gif.addFrame(ctx.getImageData(0,0,500,500).data);
//
// ctx.globalAlpha = 1;
// ctx.font = 'normal 40px Impact, serif';
//
// ctx.rotate(.5);
// ctx.translate(20,-40);
//
// ctx.lineWidth = 1;
// ctx.strokeStyle = '#ddd';
// ctx.strokeText("Wahoo", 50, 100);
//
// _gif.setDelay(100);
// _gif.addFrame(ctx.getImageData(0,0,500,500).data);
//
// ctx.fillStyle = '#000';
// ctx.fillText("Wahoo", 49, 99);
//
// _gif.setDelay(100);
// _gif.addFrame(ctx.getImageData(0,0,500,500).data);
//
// var m = ctx.measureText("Wahoo");
//
// ctx.strokeStyle = '#f00';
//
// ctx.strokeRect(49 + m.actualBoundingBoxLeft,
//   99 - m.actualBoundingBoxAscent,
//   m.actualBoundingBoxRight - m.actualBoundingBoxLeft,
//   m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
//
//   _gif.setDelay(100);
//   _gif.addFrame(ctx.getImageData(0,0,500,500).data);
//
//   cb();
// }
//
