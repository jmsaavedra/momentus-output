
//***** OUTPUT MODULE INFORMATION ******//
/*
/*  about this module, author, and it's output 
/*  this will end up going into the final output object on completion 
*/
var module_info = {
  name : "basic_v3", //name of your only module.export function
  version : "0.12",
  output_type : "image/gif", //mime-type of what you are generating
  description : "first graphicsmagick module. 1 frame per story, text overlay of author name and comment. pulls twitter acct icon if user is registered.",
  author : {
    name: "joe",
    url: "http://momentus.io"
  }
};

//***** VARS + REQS ******//
/*
*/
var fs      = require('fs'),
    rimraf  = require('rimraf'),
    gm      = require('gm'),
    async   = require('async'),
    path    = require('path'),
    Folders = require('./../utils/FolderUtils'),
    FileUtils = require('./../utils/FileUtils'),
    spawn   = require('child_process').spawn,
    https   = require('https'),
    request = require("request"),
    qs      = require('querystring'),
    inspect = require('util').inspect,
    debug   = function(msg){ log.info("/output/%s:: ".magenta.bold+msg, module_info.name); };
    

//***** YOUR OUTPUT MODULE ******//
/*
/*  about this module, author, and it's output 
/*  this will end up going into the final output object on completion 
*/
var basic_v3 = function(obj,  cb){
  debug("[Starting Output Module: ".cyan.bold+module_info.name.bold+" version ".cyan.bold+module_info.version+" ]".cyan.bold);
  // to see the raw input object:
  // debug("\n---------------obj---------------\n".gray.inverse + JSON.stringify(obj) + "\n---------------------------------\n".gray.inverse);

  //** local folder for this moment
  // NOTE: after all output modules have finished processing this entire folder will get deleted by momentus app
  var localMomentFolder = path.join(__dirname, obj.moment.path.local.toString());
  //** local folder for downloading source files for this moment (profile pictures, story images)
  // NOTE: this is so that other output modules don't re-download the same images over and over
  var localMomentSrcDloadFolder = path.join(localMomentFolder, 'source_downloads');
  //** local folder where any temporary processed (individual frames, etc) files will live (on the EC2 instance)
  // NOTE: this folder + contents will get deleted by momentus app (after uploading your final output file)
  var localModuleProcessFolder = path.join(localMomentFolder, module_info.name);
  debug("localModuleProcessFolder: ".yellow+localModuleProcessFolder);

  
  //** check to make sure all local process folders exist for this moment + module **//
  async.mapSeries([ //array of paths
      path.join(__dirname,'../../moments/temp'),
      localMomentFolder,
      localMomentSrcDloadFolder,
      localModuleProcessFolder ],

    Folders.checkDir, //execute this on all paths, in order.
    function(err, results){ //cb
      if(err) debug("error creating folders".red);
      //-- folders exist, kick off module by downloading all needed files
      beginDownloads();
  });


  //*** go through all stories, and download any files necessary for processing ***//
  function beginDownloads(){
    
    async.mapSeries(obj.moment.stories,function(thisStory, callback){

      //debug("about to download story: ".cyan + JSON.stringify(thisStory));
      var storyPicLocal = path.join(localMomentSrcDloadFolder,thisStory._id+'_storyImg.jpg');
      var MomentParticipants = obj.moment.participants; //in case that's helpful
      var thisUser = thisStory.user;
      
      var backupProfilePic = 'http://momentus.io/img/moment-placeholder/puppy_profile.png';
      var userPicLocal = path.join(localMomentSrcDloadFolder,thisUser._id+'_profileImg');
      var userPicLocalSized = path.join(localModuleProcessFolder,thisUser._id+'_profileImg_resized');
      var userPic = thisUser.local.profileImg ? thisUser.local.profileImg : backupProfilePic;
      var fileType = path.extname(userPic);
      
      debug("userPic: ".yellow+userPic);

      //-- download both the userPic and storyFile
      async.parallel([
        async.apply(FileUtils.downloadImage, userPic, userPicLocal+fileType), //downloadImage(picUrl, picDestinationLocalPath)
        async.apply(FileUtils.downloadImage, thisStory.file.path, storyPicLocal)

      ], function(e, downloadedFiles){
        if(e) debug('error downloading Files: '.red+e);
        debug("thisStory._id: "+thisStory._id+ " downloadedFiles.length: ".cyan+downloadedFiles.length);
        // debug("downloadedFiles: ".yellow+JSON.stringify(downloadedFiles));
        thisStory.user.profileImgLocal = downloadedFiles[0];
        thisStory.file.storyImgLocal   = downloadedFiles[1];

        //i want the profile image sized down, let's do it now.
        FileUtils.resizeImage(30, thisStory.user.profileImgLocal, userPicLocalSized+fileType, function(e, _profileImgSized){
          if(e) log.error("resize error: "+e);
          thisStory.user.profileImgSized = _profileImgSized;
          callback(e, thisStory)
        });
      });
    }, function(e, theseStories){
      if(e) return cb(e);
      debug("download of all story + user images complete".green);
      debug("theseStories.length: ".cyan+theseStories.length);
      // debug("theseStories: ".yellow+JSON.stringify(theseStories));

      //*** we have all files downloaded. go go go !
      ProcessMoment(theseStories);
    });
  }// end beginDownloads()


  /*** OK LET'S ACTUALLY MAKE SOMETHING NOW ***/
  function ProcessMoment(stories){

    //go through every story individually
    async.eachSeries(stories, function(story, _processCb){
      //process each (i'm doing overlays on every image)
      processIndividualStory(story, function(e){
        if(e)log.error(e);
        _processCb();
      }) 
    }, function(e){
      if(e) log.error('error processing a frame: '+e);

      //*** DONE processing every frame. concat our frames into final gif ***//
      processGif(function(_e, gifPath){
        if(_e) return cb('processGif error: '+_e); // don't save anything, module failed
        else {
          //*** make our final output object to pass back to the app ***//
          // NOTE: the app upload this file to S3 afterward.
          var momentOutputObj = module_info;
          momentOutputObj.moment = obj.moment._id;
          momentOutputObj.file_local = gifPath; 
          debug('   OUTPUT MODULE: '.green.inverse+' '+module_info.name.green.bold+' '+' COMPLETED   '.green.inverse);
          cb(null, momentOutputObj); // DONE. OUTPUT MODULE SUCCESS. 
        }
      });
    });
  }

  /***** PROCESS A SINGLE STORY 
  /* - This module makes 1 frame per story
  /* - crops story image
  /* overlays profileImg + comment + author
  */
  var frameNumber = 0;
  function processIndividualStory(story, cb) { //fileName, user, 
    var user = story.user;
    var rawFilePath = story.file.storyImgLocal;
    var storyAuthor = user.twitter ? '@'+user.twitter.username : user.local.name;
    var comment = story.comment;

    debug("processIndividualStory :: ".yellow.bold);
    debug("storyAuthor: ".cyan+ storyAuthor);
    // debug("profileImgSized : " +user.profileImgSized);
    debug("story comment: ".cyan+story.comment);
    debug("about to process rawFile: ".cyan+ rawFilePath);

    //* right now ALL outputs are 500x500px *//
    var output_size = 500;
    var authorTextX = user.profileImgSized ? 70 : 25; //should always be true.
    var thisFileOutPath = path.join(localModuleProcessFolder,'process_frame_'+frameNumber+'_'+path.basename(rawFilePath));

    //* "clever" font sizing and line breaking based on comment length *//
    var commentSize = 34; //anything between 15 and 28 chars will be font size
    if (comment.length < 15) commentSize = 36;

    if (comment.length > 28){
      var indexToLineBreak;
      for(var i=0; i<comment.length;i++) {
        if (comment[i] === " "){
          if ( i > 22){
            indexToLineBreak = i;
            break;
          }
        }
      }
      commentSize = 26;
      if(indexToLineBreak > 22)
        comment = comment.slice(0, indexToLineBreak) + "\n" + comment.slice(indexToLineBreak+1, comment.length);
      //debug("finished comment: "+comment);
    }

    //*** start up the graphicsmagick module ***//
    gm(rawFilePath)

    // gm(rawFilePath)
    .background("#000000")
    .gravity("Center")
    .resize(output_size*1.4, output_size*1.4)
    .crop(output_size, output_size)
    .extent(output_size,output_size)

    //.fill('rgba(' + rand(255) + ',' + rand(255) + ',' + rand(255) + ',100)')
    .fill('rgba(0,0,0,100)')
    .drawRectangle(10, 365, output_size-10, output_size-10)
    .fill('white')

    .font('AvantGarde-Book', 20)
    .drawText(authorTextX, 143 , storyAuthor, 'West')

    .font('AvantGarde-Demi', commentSize)
    .drawText(25, 200, comment, 'West')
    .autoOrient()

    //***** turn this into a jpg buffer *****//
    .toBuffer('JPG', function(er, buf){
      gm(buf) //now composite the profileImg on top
      .composite(user.profileImgSized)
      .geometry(500,500,'+25+380')

      //***** SAVE THIS SINGLE PROCESSED IMAGE TO EC2 TEMP PATH *******//
      .write(thisFileOutPath, function(err) { //local file saving
        if(err) debug("err on write file: ".red+err);
        debug('finished writing file'.green + thisFileOutPath);
        frameNumber++;
        cb(err);
      });
    });
  }//END processOverlayImage


  //*** concatenate all frames into a single GIF ***//
  function processGif(cb){
    debug("hit processGif".yellow.bold);
    var now_unix = new Date().getTime();
    var gifFName = now_unix.toString() +'_'+ module_info.name +'_final.gif';
    var tempModuleOutputFilePath = localModuleProcessFolder +"/"+gifFName;

    //**** GRAPHICSMAGICK ARGUMENT ARRAY ****//
    /* this call grabs all .jpgs who's name starts with 'process_'
    /* concatenates with a delay of 150*100 ms
    /* convert ref: http://www.graphicsmagick.org/convert.html 
    */
    var gmArgs = ['convert', '-delay', '150', localModuleProcessFolder+'/process_*.jpg', tempModuleOutputFilePath];
    // var cmd = 'gm convert -delay 150 '+localModuleProcessFolder+'/*.jpg  '+tempModuleOutputFilePath;
    debug("spinning off magickChild now, with args: ".cyan + JSON.stringify(gmArgs, null, '\t'));
    // process child that will execute the gm command
    var magickChild  = spawn('gm', gmArgs);

    magickChild.stdout.on('data', function (data) {
      //debug('stdout: '.cyan + data);
    });

    magickChild.stderr.on('data', function (data) {
      //log.error('child process error: '.red + data);
      cb("gm convert stderr error: ".red.bold+data, null);
    });

    magickChild.on('close', function (code) {
      debug('child process exited with code ' + code);
      if(code == 0){
        debug('completed gif'.green);
        cb(null, tempModuleOutputFilePath);
      }
    });
  }
};

module.exports = basic_v3;




//===========================================================//
//***** just for future reference ******//

//***** SAVE THIS SINGLE PROCESSED IMAGE TO S3 (upload directly) *******//
//gm(file).toBuffer('JPG',function (err, buffer) { //toBuffer for immediate upload
  //if (err) return debug("toBufferErr: ".red, err);
  //S3.uploadFile(obj.moment._id.toString()+"/m01_process/"+fileName, buffer, function(err, FileInfo){
  //  console.log('uploaded processed file: '.cyan+JSON.stringify(FileInfo.path)); cb(); }); });


//****** check to make sure we have >= 1 story objects w/cb error obj ******//
  // if(obj.moment.stories.length < 1){
  //   debug("Aborting Output Process, no STORIES found");
  //   return cb({"err":'No Stories', "code":1});
  // }

//**** OLD OUTPUT AND UPLOAD ****//
//   processGif(obj.moment.path.s3.momentPath, obj.moment, function(_e, _gifPath){
//     if(_e) return cb(_e, null);

//     gm(_gifPath) //using gm() just to encode to Buffer for upload
//     .toBuffer('GIF',function (err, buffer) { //toBuffer for immediate upload
//       if (err) return debug("toBufferErr: ".red, err);

//       //***** UPLOAD FINAL GIF FILE to S3.moment/output/ ******//
//       // S3.uploadFile(obj.moment._id.toString()+"/output/"+path.basename(_gifPath), buffer, module_info.output_type, function(err, FileInfo){
//         debug('uploaded processed file: '+JSON.stringify(FileInfo.path));
//         debug("gif path: ".cyan+_gifPath);
//         debug("path parse: ".cyan+path.dirname(_gifPath));

//         //***** DELETE ANY LOCALLY CREATED FILES (FILES ON EC2) ****//
//         //rimraf(path.dirname(_gifPath), function(e){

//           debug("FILEINFO.PATH .TOSTRING(): ".cyan+ FileInfo.path.toString());

//           var newOutput = new Output(module_info);
//           newOutput.moment = obj.moment._id;
//           newOutput.file_url = FileInfo.path.toString();

//           newOutput.save(function(e, _newOutput, numAffected){

//             ThisMoment.addOutputFileById(obj.moment._id, newOutput._id, function(__e){
//               if(__e) return debug("error updating moment with output file in Moments: ".red + __e);
//               // debug("outputFile: ".green+FileInfo.path+" saved to moment: ".green+obj.moment._id);
//               debug(" completed output Mod_01! ".green.inverse+" object id: ".green+newOutput._id+"  // output file: "+newOutput.file_url+"  // saved to moment: ".green+obj.moment._id);
//               cb(null, FileInfo.path);
//             });
//           });
//         //});
//       //});
//     });
//   }); //end processGif()

//***** A bunch of really dumb logic about their user profile image
// var userPic = thisUser.twitter ? thisUser.twitter.profileImg : null;
// var fileType = '.png'; //twitter
// if(!userPic){ //we're going fb
//   fileType = '.JPG';
//   userPic = thisUser.facebook ? thisUser.facebook.profileImg : backupProfilePic;
// }
// if(!userPic) userPic = thisUser.facebook.profileImg ? thisUser.facebook.profileImg : backupProfilePic;
