//**** NOT USING THIS FOR DEVELOPMENT APP... yet *//

var fs = require('fs'),
    rimraf = require('rimraf'),
    async = require('async'),
    path = require('path'),
    // debug = require('debug')('Momentus:Output'),
    debug = function(msg){ log.info("/output/index:: ".gray.bold+msg); },
    Folders = require('../storage/FolderUtils'),
    S3 = require('../storage/S3Utils'),
    Sms = require('../api/TwilioUtils'),
    Moment = require('./../../models/moment');

var concurrency = 5;

// TODO: we're not using _db or db anywhere here, it's confusing should be removed.
var Output = function(moment, _db, cb){

  var self = this;
  //debug(moment);
  this.cb = cb;

  /* Simple Error Catch */
  /* TODO Must Be Documented Still */
  this.Error = null;

  this.single_iterator = function(obj,cb){
    //debug('obj in single_iterator: '.cyan+JSON.stringify(obj));

    var tempModPath = path.join(obj.moment.path.local.toString(), obj.module.toString());
    debug('tempModPath: '.yellow+tempModPath);

    Folders.checkDir(tempModPath, function() {
      //execute this Output
      var mod_output =  new require('./'+obj.module.toString())(obj,function(err,path){
        if(err) {
          debug('[ OUTPUT MODULE FAILED ]'.red.inverse+obj.module.toString().red)
          if (!self.Error) self.Error = [err];
          else self.Error.push(err);
          cb(err);
        }
        else cb(null,path);
      });
    });
  };

  /* Init Queue */
  this.queue = async.queue(this.single_iterator, concurrency);
  this.queue.drain = function(){
    debug('drain.');
    self.cb(self.Error);
  };


  var tempLocalMomentPath = path.join(Folders.incomingTempDir().toString(), moment._id.toString());

  debug('[Output] [Recieved Moment] total_mods '.cyan+moment.output_modules.lengt);

  var pr1 = function(cb){
    var completeMoment = {};
    Moment.findOne({url:moment.url}).populate('stories')// .populate('participants')//({$or:[{invitees:{$in:[req.user._id]}}, {creator:req.user._id }]})
    .exec(function (err, _completeMoment) {
      if(err) debug("err: ".red+err);//cb(err);
      completeMoment = JSON.parse(JSON.stringify(_completeMoment));
      completeMoment.path = {s3: S3.momentPath(moment._id), local: tempLocalMomentPath };
      // completeMoment.path.s3 = { momentPath : S3.momentPath(obj.moment._id)};

      Story.find({moment:moment._id}).populate('user')
      .exec(function (_err, _completeStories){
        completeStories = JSON.parse(JSON.stringify(_completeStories));
        completeMoment.stories = completeStories;

        cb(_err, completeMoment);
      });
    });
  };

  var pr2 = function(cb){

    Folders.checkDir(tempLocalMomentPath, function() {
      S3.getFileList(moment._id+"/raw", function(e, files){

        if(e){
          if (!this.Error) this.Error = [e];
          else this.Error.push(e);
          return cb(this.Error);
        }
        if(!files){
          var _e = 'No Files';
          if (!this.Error) this.Error = [_e];
          else this.Error.push(_e);
          return cb(this.Error);
        }
        return cb(this.Error,files);
      });
    });
  };
  /* init parallel*/
  async.parallel([pr1,pr2],function(err,results){
    //sort results
    if(err)debug("[async.parallel] err: ".red+err);

    moment.output_modules.forEach(function(mod){
      debug('[Output Module Found]'.green+' [ Queue ] '+self.queue.length()+' [ Moment ID ] '+moment._id+' [ Module ]  '+mod);
       var obj = {
         module : mod,
         files  : results[1],
         moment : results[0]
       };
       self.queue.push(obj);
    });
  }); //end parallel
};

module.exports = Output;
