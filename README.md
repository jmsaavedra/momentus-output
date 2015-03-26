#momentus.io
###Output Module Development App
#####version 0.0.1

##Setup Instructions:
1. Install dependencies, clone repo:
  ```
  # OSX dependencies:
  # node-canvas (cairo, pixman): https://github.com/Automattic/node-canvas/wiki/_pages
  $ brew install graphicsmagick
  $ brew install ghostscript
  $ brew install ffmpeg

  # Linux dependencies:
  $ sudo apt-get update
  $ sudo apt-get install libcairo2-dev libjpeg8-dev libpango1.0-dev libgif-dev build-essential g++
  $ sudo apt-get install graphicsmagick
  $ sudo apt-get install ghostscript
  # install ffmpeg (compile src, gist link below)

  # Clone repo and install node modules:
  $ git clone https://github.com/jmsaavedra/momentus-output.git
  $ cd momentus-output/
  $ npm install nodemon -g
  $ npm install
  ```

2. Run app

  ```
  # run with npm (uses nodemon)
  $ npm run start

  # or just run it reg-sauce
  $ node output.js
  ```

___
##How does it work

* check out the `test_moment.json` file in /moments folder
  * this is an example of exactly what the momentus app feeds to every output module when it's time for processing
  * more explanation about this object in the [momentus.io wiki](https://github.com/jmsaavedra/momentus.io/wiki/Output-Module-API)
* immediately on running the app, whichever output module you're testing (`var myTestModule` in output.js) will process this moment object
* output modules are found in the `/modules/output` folder. currently only `basic_v3` works with this app
* after your module has processed successfully, you will see a `/temp` folder created inside of `/moments`
* this temp folder contains another folder named with object._id of the moment you just processed (from the .json file)
* inside of this you will see `/basic_v3` (module name) and `/source_downloads`
  * `/basic_v3` contains all files that were processed specifically for this module, including the final output file (.gif for now)
    * includes any processed frames, or resized images (basic_v3 resizes profile pictures, and 1 processed frame per Story)
  * `/source_downloads` contains any file downloaded for this Moment
    * includes raw profile images and raw story images downloaded.
  * reason for this folder separation: so that multiple output modules don't re-download the same source images over and over
  * in the live-server context, both of these folders will get deleted (after output file is uploaded to S3)
* after successful processing, you'll see an Output Object get printed. this what you will return to the momentus web app server, and it will do all the final housekeeping (upload your local file to S3, update database, delete temp folder contents, etc)


___
##Requirements

_App_
* node v0.10.35

_Output Module "basic"_
* ffmpeg
* graphicsmagick
* ghostscript

_Output Module "canvas"_
* cairo (node-canvas)

___
##References / Credits:


* [Install FFMpeg on Linux](https://gist.github.com/jmsaavedra/62bbcd20d40bcddf27ac)
* [graphicsmagick npm](https://github.com/aheckmann/gm)
* [node-canvas npm](https://github.com/Automattic/node-canvas)
