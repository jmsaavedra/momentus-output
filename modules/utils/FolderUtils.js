/***
 *  momentus.io
 *
 *  folder structure
 *  navigate, create, delete, update files within server folder structure
 *
 *  MODULE EXPORTS are declared after all functions
 */

var fs = require('fs');
var request = require('request');
// var debug = require('debug')('Momentus:Folders');
var debug = function(msg){ log.info("/utils/Folders:: ".gray.bold+msg); };

var path = require('path');
var _ = require('lodash');


var root,
	incomingDir,
	incomingTempDir,
	publicDir,
	outputDir;


/***
// FolderStructure setup
//
*/
var setup = function(dir) {

	root = dir;
	publicDir = dir + '/public';
	incomingDir = publicDir + '/incoming'; //in the publc/ dir for now
	incomingTempDir = incomingDir + '/temp';

	checkDir(incomingDir, function(){
		checkDir(incomingTempDir, function(){});
	});
};



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
			debug(" Dir Does Not Exist: ".red.inverse + " " + thisDir);
			fs.mkdirSync(thisDir);
			debug("Created  Directory:  ".green + " " + thisDir);
			callback();
		}
	});
};

module.exports = {

	setup: setup,
	checkDir: checkDir,

	root: function() {
		return root;
	},

	incomingDir: function() {return incomingDir;},
	incomingTempDir: function() {return incomingTempDir;},
	tempDir: function() {return incomingTempDir;},

};
