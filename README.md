# Infectinator

Our game is inspired by the current COVID situation. We also incorporate scientifc facts of virus to make it educational for younger players as well.
Listed here are the characters you will find in the game:

* Virus
* Antibodies
* Cells
* Snacks

Our environment is a petri dish. The player takes on the role of a virus, and the objective is to infect all the cells by shooting bullets at them. Bullets here represent proteins that virus inject into their target cells. Based on the scientific fact that virus get their energy from cells they infect, our infected cells turn into snacks that the player can collect to increase the speed. Once you’ve infected all cells before the timer runs out, you win the game. Oh, and you must also dodge or jump over the antibodies. They're our there looking to kill you!

Controls:
* WASD - move up, down, left, right
* Space bar - jump
* Mouse/trackpad - look around the petri dish
* B - rotate left
* R - rotate right

Play the live game [Here!](https://kevinwiranata.github.io/Infectinator/)

Note: Assets may take up to 5+ seconds to load once the site is open.

# Advanced Features

## Collision Detection 

* *Character-boundary* : Characters should not go over the petri dish boundary  
* *Bullet-cell* : Bullet stops & Cell becomes snacks once hit with a bullet  
* *Bullet-antibody* : Bullet stops & Antibody changes speed and angle once hit  
* *Virus-antibody* : Game over when virus collides with an antibody  
* *Virus-snack* : Virus gets speed powerup from snack

## Physics

* *Momentum* : speed and angle of antibody after collision with a bullet is calculated based on the conservation of momentum principle
* *Friction/Acceleration* : virus slides to a stop if a WASD control key is released. Friction is also used to slow down antibody after the initial speedup from collision
* *Gravity* : if bullets are shot when the virus is in the air, they would drop in a projectile fashion based on kinematic equations. They are also used for the player's jumps.

[Here](https://www.youtube.com/watch?v=QKairndMdGU&s&ab_channel=KevinWiranata) is the link to a recording of the game!

# tiny-graphics.js

This is a small, single file JavaScript utility.  It organizes WebGL programs to be object-oriented and minimally cluttered.  

Writing code with raw JavaScript and WebGL can be repetitive and tedious.  Using frameworks like three.js can create an undesired separation between you and the raw JavaScript and WebGL and common graphics operations you want to learn.  Unlike other frameworks, tiny-graphics.js is purpose-built for education, has small source code, and teaches you how it is made.

This tiny library gives your WebGL program access to linear algebra routines, useful UI controls and readouts, and the drawing utilities needed by modern shader-based graphics.  It factors away the repetitive logic of GPU communication into re-usable objects.  The objects can be seamlessly shared between multiple WebGL contexts (drawing regions) on a web page.

The tiny-graphics.js software library has accompanied UCLA Computer Science's 174a course (Intro to Computer Graphics) since 2016, replacing Edward Angel's supplemental code from his textbook "Interactive Computer Graphics: A Top-Down Approach with WebGL".  Compared to Angel's library, tiny-graphics.js offers more organization and functionality.

This code library accompanies and supports a web project by the same author called "The Encyclopedia of Code", a crowd-sourced repository of WebGL demos and educational tutorials that uses an online editor.

To run a sample using tiny-graphics.js, visit its GitHub Pages link: https://encyclopedia-of-code.github.io/tiny-graphics-js/

To see all the demos and edit them:  Open the included "host.bat" or "host.command" file, then open localhost in your browser.  Open Developer Tools and create a workspace for your new folder.  Now you can edit the files, which is necessary to view the different demos.

To select a demo, open and edit main-scene.js.  Assign your choice to the Main_Scene variable.  Your choices for scenes are:

* Minimal_Webgl_Demo
* Transforms_Sandbox
* Axes_Viewer_Test_Scene
* Inertia_Demo
* Collision_Demo
* Many_Lights_Demo
* Obj_File_Demo
* Text_Demo
* Scene_To_Texture_Demo
* Surfaces_Demo

The code comments in each file should help, especially if you look at the definition of Transforms_Sandbox.  So should the explanations that the demos print on the page.  Enjoy!
