Momentus IO 
================
##Output Development App
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

  # or just run it yourself
  $ nodemon output.js
  ```
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
* [node-canvas](https://github.com/Automattic/node-canvas)
