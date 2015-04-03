/***
 *  momentus.io
 *
 *  folder structure
 *  navigate, create, delete, update files within server folder structure
 *
 *  MODULE EXPORTS are declared after all functions
 */

var fs 			= require('fs'),
		debug 	= function(msg){ log.info("/storage/folders:: ".gray.bold+msg); },
		rimraf  = require('rimraf'),
		path 		= require('path');

var root 		= APPDIR,
	publicDir = APPDIR+'/public',
	tempDir 	= APPDIR+'/public/temp';


/***
// FolderStructure setup
//
*/
var setup = function(dir) {

	// root = dir;
	// publicDir = dir + '/public';
	// tempDir = publicDir + '/temp'; //in the publc/ dir for now
	checkDir(tempDir, function(){});
};


/***
// DELETE a Moment's TEMP folder
// -- we just finished processing and saving everything necessary.
*/
var cleanTempFolders = function(moment_id){

	rimraf(path.join(tempDir.toString(),moment_id.toString()), function(e){	
		if(e) return log.error("error rimraf local moment folder: "+e);
		debug("finished cleaning temp moment process folders".green);
	});
}



/***
// Check if a directory exists
// -- if it does not, create it
*/
var checkDir = function(dir, callback) {

	var thisDir = dir;
	fs.exists(thisDir, function(exists) {
		if (exists) {
			debug("Dir Exists: ".yellow + thisDir);
			callback();
		} else {
			debug(" Dir Does Not Exist: ".red +" "+ thisDir);
			fs.mkdir(thisDir, function(e){
				if(e) return log.error('error on mkdir: '+e);
				debug("Created  Directory:  ".green +" "+ thisDir);
				callback();
			});
		}
	});
};


module.exports = {
	setup: setup,
	checkDir: checkDir,
	cleanTempFolders: cleanTempFolders,
	tempDir: function() {return tempDir;}
};
