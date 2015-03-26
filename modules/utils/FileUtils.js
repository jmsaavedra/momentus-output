/***
 *  momentus.io
 *
 *  File Utilities
 *
 */

var fs 		= require('fs'),
	request = require('request'),
	path 	= require('path'),
	gm      = require('gm'),
	debug 	= function(msg){ log.info("/utils/Files:: ".blue.bold+msg); };


module.exports.downloadImage = function(imgUrl, saveAs, cb){
  //first check to make sure it doesn't exist already (no need to re-download)
  fs.exists(saveAs, function (exists){
    if(!exists){
      debug("about to download imgUrl: ".yellow+imgUrl);
      //execute GET request
      request({ method: 'GET',
               url: imgUrl,
               dest: saveAs
      },function(err, response, body){
        if(err) debug("err downloading image: ".red.inverse + err);
        //debug('server encoded the data as: '.magenta.bold + (response.headers['content-type'] || 'identity'))
        if(response.statusCode == 200){
          debug("img downloaded to: ".gray+saveAs);
          // TODO: get file type / mimetype from the response!
          cb(null, saveAs);
        } else cb(response.body);
      }).pipe(fs.createWriteStream(saveAs));
    } else {
      debug("file already downloaded.".gray);
      cb(null, saveAs);
    }
  });
}


module.exports.resizeImage = function(size, file, saveAs, cb){
  //creates square resized image (with width and height of 'size')
  debug("resizing File: ".gray+file);
  gm(file).resize(size).write(saveAs, function (err) {
    if (err){
      console.log('err dl + resize profile pic: '.red.inverse+err);
      cb(err);
    } else {
      cb(null,saveAs);
    }
  });
}