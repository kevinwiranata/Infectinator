import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

const MOVEMENT_DIRECTION = {
    UP: 0,
    LEFT: 1,
    RIGHT: 2,
    DOWN: 3
}

export class Shape_From_File extends Shape {
	// **Shape_From_File** is a versatile standalone Shape that imports
	// all its arrays' data from an .obj 3D model file.
	constructor(filename) {
		super("position", "normal", "texture_coord");
		// Begin downloading the mesh. Once that completes, return
		// control to our parse_into_mesh function.
		this.load_file(filename);
	}

	load_file(filename) {
		// Request the external file and wait for it to load.
		// Failure mode:  Loads an empty shape.
		return fetch(filename)
			.then((response) => {
				if (response.ok) return Promise.resolve(response.text());
				else return Promise.reject(response.status);
			})
			.then((obj_file_contents) => this.parse_into_mesh(obj_file_contents))
			.catch((error) => {
				this.copy_onto_graphics_card(this.gl);
			});
	}

	parse_into_mesh(data) {
		// Adapted from the "webgl-obj-loader.js" library found online:
		var verts = [],
			vertNormals = [],
			textures = [],
			unpacked = {};

		unpacked.verts = [];
		unpacked.norms = [];
		unpacked.textures = [];
		unpacked.hashindices = {};
		unpacked.indices = [];
		unpacked.index = 0;

		var lines = data.split("\n");

		var VERTEX_RE = /^v\s/;
		var NORMAL_RE = /^vn\s/;
		var TEXTURE_RE = /^vt\s/;
		var FACE_RE = /^f\s/;
		var WHITESPACE_RE = /\s+/;

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			var elements = line.split(WHITESPACE_RE);
			elements.shift();

			if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
			else if (NORMAL_RE.test(line))
				vertNormals.push.apply(vertNormals, elements);
			else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
			else if (FACE_RE.test(line)) {
				var quad = false;
				for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
					if (j === 3 && !quad) {
						j = 2;
						quad = true;
					}
					if (elements[j] in unpacked.hashindices)
						unpacked.indices.push(unpacked.hashindices[elements[j]]);
					else {
						var vertex = elements[j].split("/");

						unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
						unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
						unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

						if (textures.length) {
							unpacked.textures.push(
								+textures[(vertex[1] - 1 || vertex[0]) * 2 + 0]
							);
							unpacked.textures.push(
								+textures[(vertex[1] - 1 || vertex[0]) * 2 + 1]
							);
						}

						unpacked.norms.push(
							+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 0]
						);
						unpacked.norms.push(
							+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 1]
						);
						unpacked.norms.push(
							+vertNormals[(vertex[2] - 1 || vertex[0]) * 3 + 2]
						);

						unpacked.hashindices[elements[j]] = unpacked.index;
						unpacked.indices.push(unpacked.index);
						unpacked.index += 1;
					}
					if (j === 3 && quad)
						unpacked.indices.push(unpacked.hashindices[elements[0]]);
				}
			}
		}
		{
			const { verts, norms, textures } = unpacked;
			for (var j = 0; j < verts.length / 3; j++) {
				this.arrays.position.push(
					vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2])
				);
				this.arrays.normal.push(
					vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2])
				);
				this.arrays.texture_coord.push(
					vec(textures[2 * j], textures[2 * j + 1])
				);
			}
			this.indices = unpacked.indices;
		}
		this.normalize_positions(false);
		this.ready = true;
	}

	draw(context, program_state, model_transform, material) {
		// draw(): Same as always for shapes, but cancel all
		// attempts to draw the shape before it loads:
		if (this.ready)
			super.draw(context, program_state, model_transform, material);
	}
}

export class Text_Line extends Shape {
	// **Text_Line** embeds text in the 3D world, using a crude texture
	// method.  This Shape is made of a horizontal arrangement of quads.
	// Each is textured over with images of ASCII characters, spelling
	// out a string.  Usage:  Instantiate the Shape with the desired
	// character line width.  Then assign it a single-line string by calling
	// set_string("your string") on it. Draw the shape on a material
	// with full ambient weight, and text.png assigned as its texture
	// file.  For multi-line strings, repeat this process and draw with
	// a different matrix.
	constructor(max_size) {
		super("position", "normal", "texture_coord");
		this.max_size = max_size;
		var object_transform = Mat4.identity();
		for (var i = 0; i < max_size; i++) {
			// Each quad is a separate Square instance:
			defs.Square.insert_transformed_copy_into(this, [], object_transform);
			object_transform.post_multiply(Mat4.translation(1.5, 0, 0));
		}
	}

	set_string(line, context) {
		// set_string():  Call this to overwrite the texture coordinates buffer with new
		// values per quad, which enclose each of the string's characters.
		this.arrays.texture_coord = [];
		for (var i = 0; i < this.max_size; i++) {
			var row = Math.floor(
					(i < line.length ? line.charCodeAt(i) : " ".charCodeAt()) / 16
				),
				col = Math.floor(
					(i < line.length ? line.charCodeAt(i) : " ".charCodeAt()) % 16
				);

			var skip = 3,
				size = 32,
				sizefloor = size - skip;
			var dim = size * 16,
				left = (col * size + skip) / dim,
				top = (row * size + skip) / dim,
				right = (col * size + sizefloor) / dim,
				bottom = (row * size + sizefloor + 5) / dim;

			this.arrays.texture_coord.push(
				...Vector.cast(
					[left, 1 - bottom],
					[right, 1 - bottom],
					[left, 1 - top],
					[right, 1 - top]
				)
			);
		}
		if (!this.existing) {
			this.copy_onto_graphics_card(context);
			this.existing = true;
		} else this.copy_onto_graphics_card(context, ["texture_coord"], false);
	}
}

class Antibody {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.model_transform = Mat4.identity();
        this.angle = Math.floor(Math.random() * 360);
    }
}

class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = Math.floor(Math.random() * 360);
    }
}
export class Virus extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        this.torusLocation = {
            x: 0,
            y: 0,
            angle: 0,
        }
        this.xpositions = [];
        this.ypositions = [];

        this.antibodies = [];
        this.numAntibodies = 5;

        this.foods = [];
        this.ateTime = -6;
        this.currTime = 0;

        this.numCells = 2;

        this.cell_transform = Array(this.numCells).fill(0).map(x => Mat4.identity());
        this.cell_angle = Array(this.numCells).fill(0);
        this.infected = Array(this.numCells).fill(0).map(x => false);
        this.eaten = Array(this.numCells).fill(0).map(x => false);

        // need to start from i = 1 so that in set_cell, we won't be accessing index -1
        for(let i = 1; i <= this.numCells; i++) {
            this.set_cell_xpositions(i-1);
            this.set_cell_ypositions(i-1);
            this.cell_angle[i-1] = Math.floor(Math.random() * 360);
        }

        // Initialize antibodies
        for (let i = 1; i <= this.numAntibodies; i++) {
            this.set_antibody_positions(i-1);
        }

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            bullet: new Shape_From_File("assets/virus.obj"),
            torus: new defs.Torus(15, 15),
            torus2: new defs.Torus(3, 15),
            sphere: new defs.Subdivision_Sphere(4),
            square: new defs.Square(),
            test: new defs.Square(),
            circle: new defs.Regular_2D_Polygon(65, 65),
            cell: new Shape_From_File("assets/cell.obj"),
            covid: new Shape_From_File("assets/corona.obj"),
            petri_dish: new Shape_From_File("assets/wall.obj"),
            text: new Text_Line(35)
            // microscope: new Shape_From_File("assets/microscope.obj")
        };
        this.shapes.circle.arrays.texture_coord.forEach(v=> v.scale_by(10));

        // *** Materials
        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
            test_shadow: new Material(new defs.Phong_Shader(),
                {ambient: 0, diffusivity: 0, specularity: 0, color: hex_color("#000000")}),
            test2: new Material(new Gouraud_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#89cff0")}),
            shadow: new Material(new Shadow_Shader()),
            ring: new Material(new Ring_Shader()),
            bullet:  new Material(new defs.Phong_Shader(), {
                color: color(0, 0, 1, 1),
                ambient: .3,
                diffusivity: 1,
                specularity: .5
            }),
            petriDish: new Material(new defs.Fake_Bump_Map(1), {
                color: color(0, 0, 0, 0.8),
                ambient: 1,
                texture: new Texture("./assets/chromosome.jpg")
            }),
            covid: new Material(new defs.Textured_Phong(1), {
                diffusivity: 1.0, specularity: 1.0, ambient: 1.0,
                texture: new Texture("./assets/corona.png")
            }),
            wall: new Material(new Gouraud_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#89cff0")}),
            antibody: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#009dff")}),
            antibody_shadow: new Material(new defs.Phong_Shader(),
                {ambient: 0, diffusivity: 0, specularity: 0, color: hex_color("#000000")}),
            cell: new Material(new defs.Textured_Phong(1), {
                color: color(1, 0, 0, 1),
                diffusivity: 1.0, specularity: 0.5, ambient: 0.1,
                texture: new Texture("./assets/cell.png")}),
            welcome: new Material(new defs.Textured_Phong(1), {
                    color: color(0, 0, 0, 1),
                    ambient: 1,
                    texture: new Texture("./assets/welcome.png")
                }),
            end_screen_time: new Material(new defs.Textured_Phong(1), {
                color: color(0, 0, 0, 1),
                ambient: 1,
                texture: new Texture("./assets/End_Screen_Time.png")
            }),
            end_screen_antibody: new Material(new defs.Textured_Phong(1), {
                color: color(0, 0, 0, 1),
                ambient: 1,
                texture: new Texture("./assets/End_Screen_Antibody.png")
            }),
            end_screen_win: new Material(new defs.Textured_Phong(1), {
                color: color(0, 0, 0, 1),
                ambient: 1,
                texture: new Texture("./assets/End_Screen_Win.png")
            }),
            text_image: new Material(new defs.Textured_Phong(1), {
                    ambient: 1, diffusivity: 0, specularity: 0,
                    texture: new Texture("assets/text.png")
                }),
            },

        // sounds
        this.sounds = {
            minor_circuit: new Audio("assets/minor_circuit.mp3"),
            guile_theme: new Audio("assets/guile_theme.mp3"),
            blaster: new Audio("assets/blaster.mp3"),
        }

        this.score = 0;
        this.timer = 180;

        this.center = Mat4.identity();
        this.bullets = [];
        this.removebullet = false;
        this.bulletPositions = [];
        this.bulletsOgY = [];
        this.bulletDirections = []; // angle in radians
        this.virus = Mat4.identity();
        this.start = false;
        this.won = false;
        this.gameOver = false;
        this.timeElapsed = 0;
        this.timeLost = 0;
        this.mouse_enabled_canvases = new Set();
        this.cells_left = this.numCells;

        this.torusColor = color(1,1,1,1);
        this.radiusOfTorus = 1.25;
        this.camera_matrix = Mat4.look_at(
            vec3(0, -10, 6),
            vec3(0, 0, 0),
            vec3(0, 0, 1)
        );
    }

    // ALREADY FIXED THE PROBLEM OF CAN ONLY CHECK DIST < 0.1
    // If want them father, multiply the Math.random() by a larger number
    set_cell_xpositions(i) {
        if(i < this.numCells/2) {
            this.xpositions[i] = 10*Math.random();
        }
        else {
            this.xpositions[i] = -10*Math.random();
        }
        // check other cells' x-coord to decrease chance of overlap
        for(let j = i-1; j >= 0; j--) {
            let dist = Math.abs((this.xpositions[i]) - (this.xpositions[j]));
            if(dist < 0.6)
                this.set_cell_xpositions(i);
        }
    }

    set_cell_ypositions(i) {
        if(i < this.numCells/2) {
            this.ypositions[i] = 10*Math.random();
        }
        else {
            this.ypositions[i] = -10*Math.random();
        }
        // check other cells' y-coord to decrease chance of overlap
        for(let j = i-1; j >= 0; j--) {
            let dist = Math.abs((this.ypositions[i]) - (this.ypositions[j]));
            if (dist < 0.6)
                this.set_cell_ypositions(i);
        }
    }

    set_antibody_positions(i) {
        this.antibodies[i] = new Antibody(0, 0);
        if(i < this.numAntibodies/2) {
            this.antibodies[i].x = 15*Math.random();
        }
        else {
            this.antibodies[i].y = -15*Math.random();
        }

        for(let j = i-1; j >= 0; j--) {
            let dist = Math.abs(this.distanceBetweenTwoPoints(this.antibodies[i].x, this.antibodies[i].y, this.antibodies[j].x, this.antibodies[j].y));
            if (dist < 0.6)
            {
                this.set_antibody_positions(i);
                break;
            }
        }
    }

    calclulate_radius(x, y) {
        return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Up", ["w"], () => {
            if(this.calclulate_radius(this.torusLocation.x, this.torusLocation.y + 0.5) < 63) {
                if(this.currTime - this.ateTime > 5) {
                    this.torusLocation.x += -0.5*Math.sin(this.torusLocation.angle);
                    this.torusLocation.y += 0.5*Math.cos(this.torusLocation.angle);
                    this.camera_matrix = this.camera_matrix
                    .times(Mat4.translation(0.5*Math.sin(this.torusLocation.angle), -0.5*Math.cos(this.torusLocation.angle),0));
                }
                else {
                    this.torusLocation.x += -0.75*Math.sin(this.torusLocation.angle);
                    this.torusLocation.y += 0.75*Math.cos(this.torusLocation.angle);
                    this.camera_matrix = this.camera_matrix
                    .times(Mat4.translation(0.75*Math.sin(this.torusLocation.angle), -0.75*Math.cos(this.torusLocation.angle),0));
                }
            }
        });
        this.key_triggered_button("Left", ["a"], () => {
            if(this.calclulate_radius(this.torusLocation.x - 0.5, this.torusLocation.y) < 63) {
                if(this.currTime - this.ateTime > 5) {
                    this.torusLocation.x += -0.5*Math.cos(this.torusLocation.angle);
                    this.torusLocation.y += -0.5*Math.sin(this.torusLocation.angle);
                    this.camera_matrix = this.camera_matrix
                    .times(Mat4.translation(0.5*Math.cos(this.torusLocation.angle), 0.5*Math.sin(this.torusLocation.angle),0));
                }
                else {
                    this.torusLocation.x += -0.75*Math.cos(this.torusLocation.angle);
                    this.torusLocation.y += -0.75*Math.sin(this.torusLocation.angle);
                    this.camera_matrix = this.camera_matrix
                    .times(Mat4.translation(0.75*Math.cos(this.torusLocation.angle), 0.75*Math.sin(this.torusLocation.angle),0));
                }
            }
        });
        this.key_triggered_button("Down", ["s"], () => {
            if(this.calclulate_radius(this.torusLocation.x, this.torusLocation.y - 0.5) < 63) {
                if(this.currTime - this.ateTime > 5) {
                    this.torusLocation.x += 0.5*Math.sin(this.torusLocation.angle);
                    this.torusLocation.y += -0.5*Math.cos(this.torusLocation.angle);
                    this.camera_matrix = this.camera_matrix
                    .times(Mat4.translation(-0.5*Math.sin(this.torusLocation.angle), +0.5*Math.cos(this.torusLocation.angle),0));
                }
                else {
                    this.torusLocation.x += 0.75*Math.sin(this.torusLocation.angle);
                    this.torusLocation.y += -0.75*Math.cos(this.torusLocation.angle);
                    this.camera_matrix = this.camera_matrix
                    .times(Mat4.translation(-0.75*Math.sin(this.torusLocation.angle), +0.75*Math.cos(this.torusLocation.angle),0));
                }
            }
        });
        this.key_triggered_button("Right", ["d"], () => {
            if(this.calclulate_radius(this.torusLocation.x + 0.5, this.torusLocation.y) < 63) {
                if(this.currTime - this.ateTime > 5) {
                    this.torusLocation.x += 0.5*Math.cos(this.torusLocation.angle);
                    this.torusLocation.y += 0.5*Math.sin(this.torusLocation.angle);
                    this.camera_matrix = this.camera_matrix
                    .times(Mat4.translation(-0.5*Math.cos(this.torusLocation.angle), -0.5*Math.sin(this.torusLocation.angle),0));
                }
                else {
                    this.torusLocation.x += 0.75*Math.sin(this.torusLocation.angle);
                    this.torusLocation.y += -0.75*Math.cos(this.torusLocation.angle);
                    this.camera_matrix = this.camera_matrix
                    .times(Mat4.translation(-0.75*Math.sin(this.torusLocation.angle), +0.5*Math.cos(this.torusLocation.angle),0));
                }
            }
        });
        this.key_triggered_button("Start", ['Enter'], () => this.start = true)
        this.key_triggered_button("Rotate Left", ["b"], () => {
            this.torusLocation.angle += 0.1;
            this.camera_matrix =  this.camera_matrix
            .times(Mat4.translation(this.torusLocation.x, this.torusLocation.y + 6, 0))
            .times(Mat4.rotation(-0.1, 0, 0, 1))
            .times(Mat4.translation(-this.torusLocation.x, -this.torusLocation.y -6, 0))
        });
        this.key_triggered_button("Rotate Right", ["m"], () =>  {
            this.torusLocation.angle -= 0.1;
            this.camera_matrix =  this.camera_matrix
            .times(Mat4.translation(this.torusLocation.x, this.torusLocation.y + 6, 0))
            .times(Mat4.rotation(0.1, 0, 0, 1))
            .times(Mat4.translation(-this.torusLocation.x, -this.torusLocation.y -6, 0))
        });
        this.key_triggered_button("Shoot", ["h"], () => this.firebullet())

    }

    add_mouse_controls(canvas) {
        // add_mouse_controls():  Attach HTML mouse events to the drawing canvas.
        // First, measure mouse steering, for rotating the flyaround camera:
        const mouse_position = (e, rect = canvas.getBoundingClientRect()) => vec(e.clientX - (rect.right + rect.left) / 2);

        canvas.addEventListener("mousemove", e => {
            e.preventDefault();
           if(this.start) {
            let mouseRotation = mouse_position(e)*0.00009;
            this.camera_matrix =  this.camera_matrix
            .times(Mat4.translation(this.torusLocation.x, this.torusLocation.y + 6, 0))
            .times(Mat4.rotation(mouseRotation, 0, 0, 1))
            .times(Mat4.translation(-this.torusLocation.x, -this.torusLocation.y -6, 0))
            this.torusLocation.angle -= mouseRotation;
           }
        });
        canvas.addEventListener("click", () => {this.firebullet()});
    }

    firebullet() {
        this.sounds.blaster.pause();
        this.sounds.blaster.currentTime = 0;
        this.sounds.blaster.volume = 0.2;
        this.sounds.blaster.play();

        this.bullets.push(this.materials.bullet);
        this.bulletDirections.push(this.torusLocation.angle);
        this.bulletPositions.push(Mat4.identity()
        .times(Mat4.translation(this.torusLocation.x,this.torusLocation.y,0)
        .times(Mat4.scale(0.33, 0.33, 0.33))));
        this.bulletsOgY[this.bullets.length-2] = this.torusLocation.y;
    }

    play_music(title) {
        this.sounds[title].volume = 0.2;
        this.sounds[title].loop = true;
        this.sounds[title].play();
    }

    stop_music(title) {
        this.sounds[title].pause();
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:

        // CAMERA SETUP
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
        }

        if (!this.mouse_enabled_canvases.has(context.canvas)) {
            this.add_mouse_controls(context.canvas);
            this.mouse_enabled_canvases.add(context.canvas)
        }

        program_state.set_camera(Mat4.translation(0, -6, 10).times(Mat4.inverse(this.camera_matrix))
        .map((x, i) => Vector.from(program_state.camera_transform[i]).mix(x, .035)));


        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

         // LIGHTING SETUP
        const light_position = vec4(0, 0, 0, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 5000)];

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        this.timeElapsed = t;
        let model_transform = Mat4.identity();

        // let microscope_transform = Mat4.identity();
        // this.shapes.microscope.draw(context, program_state, microscope_transform, this.materials.test);

        // BACKGROUND SETUP
        let background_m = Mat4.identity().times(Mat4.scale(65, 65, 1).times(Mat4.translation(0, 0, -0.6)));
        this.shapes.circle.draw(context, program_state, background_m, this.materials.petriDish);

        // let wall_transform = Mat4.identity().times(Mat4.scale(58.8, 58.8, 50).times(Mat4.translation(0,0,0.05)));
        let wall_transform = Mat4.identity().times(Mat4.scale(58.8, 58.8, 50));
        this.shapes.petri_dish.draw(context, program_state, wall_transform, this.materials.wall);

        this.won = this.isGameWon(t);

        let welcome_transform = model_transform
        .times(Mat4.scale(7, 7, 7)
        .times(Mat4.rotation(Math.PI / 2.8, 1, 0, 0)
        .times(Mat4.translation(0, 0.84, 0.8))))

        let score_transform = welcome_transform
        .times(Mat4.scale(0.06, 0.06, 0.06))
        .times(Mat4.translation(17.4, 4.3, 0));

        let time_transform = welcome_transform
        .times(Mat4.scale(0.06, 0.06, 0.06))
        .times(Mat4.translation(17.4, 2.1, 0));

        if(!this.start) {
            program_state.animation_time = 0;
            this.play_music("minor_circuit");
            this.score = 0;
            this.shapes.square.draw(context, program_state, welcome_transform, this.materials.welcome);    
        }

        // GAME WON
        else if (this.won) {
            this.displayScore(this.score);
            this.displayCellsLeft(this.cells_left);
            this.camera_matrix = Mat4.look_at(
                vec3(0, -10, 6),
                vec3(0, 0, 0),
                vec3(0, 0, 1)
            );
            this.shapes.square.draw(context, program_state, welcome_transform, this.materials.end_screen_win);
            let time = Math.floor((this.timeLost/ 60).toString()) + ":" + ((this.timeLost)%60).toFixed(0).toString();
            this.shapes.square.draw(context, program_state, welcome_transform, this.materials.end_screen_time);
            this.shapes.text.set_string(this.score.toString(), context.context);
            this.shapes.text.draw(context, program_state, score_transform, this.materials.text_image);

            this.shapes.text.set_string(time, context.context);
            this.shapes.text.draw(context, program_state, time_transform, this.materials.text_image);
        }

        // GAME OVER
        else if (this.gameOver) {
            this.displayScore(this.score);
            this.camera_matrix = Mat4.look_at(
                vec3(0, -10, 6),
                vec3(0, 0, 0),
                vec3(0, 0, 1)
            );
            let time = Math.floor((this.timeLost/ 60).toString()) + ":" + ((this.timeLost)%60).toFixed(0).toString();

            // ran out of time
            if(this.timer - t <= 0.0) { 
                this.shapes.square.draw(context, program_state, welcome_transform, this.materials.end_screen_time);
                this.shapes.text.set_string(this.score.toString(), context.context);
                this.shapes.text.draw(context, program_state, score_transform, this.materials.text_image);

                this.shapes.text.set_string("0:0", context.context);
                this.shapes.text.draw(context, program_state, time_transform, this.materials.text_image);
            } 
            else {   // hit by antibody
                this.shapes.square.draw(context, program_state, welcome_transform, this.materials.end_screen_antibody);
                this.shapes.text.set_string(this.score.toString(), context.context);
                this.shapes.text.draw(context, program_state, score_transform, this.materials.text_image);
    
                this.shapes.text.set_string(time, context.context);
                this.shapes.text.draw(context, program_state, time_transform, this.materials.text_image);
            }


        }

        // GAME IN PROGRESS
        else {
            this.displayScore(this.score);
            this.displayTime(Math.floor((this.timer - t)/ 60), ((this.timer - t)%60).toFixed(2));
            this.displayCellsLeft(this.cells_left);
            this.stop_music("minor_circuit");
            this.play_music("guile_theme");

            // CHECK FOR TIMER
            if((this.timer - t) <= 0.01) {
                this.gameOver = true;
            }

            // DRAW VIRUS CHARACTER
            this.virus= model_transform
            .times(Mat4.translation(this.torusLocation.x, this.torusLocation.y, 0.5))
            .times(Mat4.rotation(this.torusLocation.angle, 0, 0, 1))
            this.shapes.covid.draw(context, program_state, this.virus, this.materials.covid);
            let torus_reflection = model_transform.times(Mat4.translation(this.torusLocation.x,this.torusLocation.y, -0.5)).times(Mat4.scale(1.1, 1.1, 0.1))
            this.shapes.covid.draw(context, program_state, torus_reflection, this.materials.test_shadow);

            // CELLS
            for (let i = 0; i < this.numCells; i++) {
                if (this.infected[i] === false) {
                    // Move cells
                    this.moveCells(i);
                    this.cell_transform[i] = Mat4.identity()
                        .times(Mat4.translation(this.xpositions[i], this.ypositions[i], 0))
                        .times(Mat4.rotation(90, 1, 0, 0))
                        .times(Mat4.scale(0.5,0.5,0.5))
                    // .times(Mat4.scale(0.3, 0.3, 0.3))
                    this.shapes.cell.draw(context, program_state, this.cell_transform[i], this.materials.cell);
                    let sphere_reflection =  Mat4.identity()
                        .times(Mat4.translation(this.xpositions[i], this.ypositions[i], -0.4))
                        .times(Mat4.scale(1.1, 1.1, 0.1))
                        .times(Mat4.rotation(90, 1, 0, 0))
                        .times(Mat4.scale(0.5,0.5,0.5))
                    this.shapes.cell.draw(context, program_state, sphere_reflection, this.materials.test_shadow);
                }
                else if (this.infected[i] === true && this.eaten[i] === false) {
                    this.shapes.torus.draw(context, program_state, this.cell_transform[i], this.materials.test);
                    let torus_reflection =  Mat4.identity()
                        .times(Mat4.translation(this.xpositions[i], this.ypositions[i], -0.4))
                        .times(Mat4.scale(1.1, 1.1, 0.1))
                        .times(Mat4.rotation(90, 1, 0, 0))
                        .times(Mat4.scale(0.5,0.5,0.5))
                    this.shapes.torus.draw(context, program_state, torus_reflection, this.materials.test_shadow);
                }
            }

            // PROTEIN BULELTS
            for (let i = 0; i < this.bullets.length; i++) {
                this.removebullet = false;
                let r = 1.5;
                this.bulletPositions[i] = this.bulletPositions[i]
                .times(Mat4.translation(-r*Math.sin(this.bulletDirections[i]), r*Math.cos(this.bulletDirections[i]), 0));

                // check if the bullet hits a cell
                for (let j = 0; j < this.numCells; j++) {
                    if ((this.bulletPositions[i][0][3] >= this.xpositions[j] - 0.5) && (this.bulletPositions[i][0][3] <= this.xpositions[j] + 0.5)) {
                        if ((this.bulletPositions[i][1][3] >= this.ypositions[j] - 0.5) && (this.bulletPositions[i][1][3] <= this.ypositions[j] + 0.5)) {
                            if (this.infected[j] != true)
                                this.score++;

                            this.infected[j] = true;
                            this.removebullet = true;
                            this.cells_left--;
                        }
                    }
                }
                let radius = Math.sqrt(Math.pow(this.bulletPositions[i][0][3], 2) + Math.pow(this.bulletPositions[i][1][3], 2));
                if (radius > 64) {
                    this.removebullet = true;
                }

                // if not out of bounds and doesn't hit a cell
                if (this.removebullet === false) {
                    this.shapes.bullet.draw(context, program_state, this.bulletPositions[i], this.bullets[i]);
                } else { // else we remove it from the array
                    this.bulletPositions.splice(i, 1);
                    this.bullets.splice(i, 1);
                    this.bulletsOgY.splice(i, 1);
                    this.bulletDirections.splice(i, 1);
                }
            }

            // ANTIBODIES
            for (let i = 0; i < this.numAntibodies; i++) {
                // move antibody
                this.moveAntibody(i);

                let currentAntibody = this.antibodies[i];
                let xPos = currentAntibody.x;
                let yPos = currentAntibody.y;

                this.antibodies[i].model_transform = Mat4.identity()
                    .times(Mat4.translation(xPos, yPos, 0))
                    .times(Mat4.scale(0.5, 0.5, 0.5));
                let antibodies_reflection = Mat4.identity()
                    .times(Mat4.translation(xPos, yPos, -0.5))
                    .times(Mat4.scale(0.5, 0.5, 0.5))
                    .times(Mat4.scale(1.1, 1.1, 0.1));


                this.shapes.sphere.draw(context, program_state, this.antibodies[i].model_transform, this.materials.antibody);
                this.shapes.sphere.draw(context, program_state, antibodies_reflection, this.materials.antibody_shadow);
            }
            this.currTime = program_state.animation_time / 1000;
            this.handleVirusCollision(program_state, t);
        }
    }

    displayScore(score) {
        let scoreElement = document.getElementById("score");
        scoreElement.innerHTML = `<span>Score: ${score}</span>`;
    }

    displayTime(minutes, seconds) {
        let timerElement = document.getElementById("timer");
        timerElement.innerHTML = `<span>Time left: ${minutes}:${seconds}</span>`; 
    }

    displayCellsLeft(cells) {
        console.log(cells);
        let cellsElement = document.getElementById("cells");
        cellsElement.innerHTML = `<span>Cells left: ${cells}</span>`; 
    }

    isGameWon(t) {
        if(this.infected.every(infect => infect === true)) {
            this.timeLost = this.timer - t;
            return true;
        }
    }

    moveCells(cellIndex) {
        const moveLength = 0.1;
        let nextX = this.xpositions[cellIndex]+ moveLength*Math.cos(this.cell_angle[cellIndex]);
        let nextY = this.ypositions[cellIndex]+ moveLength*Math.sin(this.cell_angle[cellIndex]);

        // if collides with circumference of petri dish
        if(this.calclulate_radius(nextX, nextY) >= 63) {
            this.cell_angle[cellIndex] += 180;
        }

        this.xpositions[cellIndex] += moveLength*Math.cos(this.cell_angle[cellIndex]);
        this.ypositions[cellIndex] += moveLength*Math.sin(this.cell_angle[cellIndex]);
    }

    moveAntibody(antibodyIndex) {
        const moveLength = 0.1;
        let nextX = this.antibodies[antibodyIndex].x + moveLength*Math.cos(this.antibodies[antibodyIndex].angle);
        let nextY = this.antibodies[antibodyIndex].y + moveLength*Math.sin(this.antibodies[antibodyIndex].angle);

        // if collides with circumference of petri dish
        if(this.calclulate_radius(nextX, nextY) >= 63) {
            this.antibodies[antibodyIndex].angle = (this.antibodies[antibodyIndex].angle + 180);
        }

        this.antibodies[antibodyIndex].x += moveLength*Math.cos(this.antibodies[antibodyIndex].angle);
        this.antibodies[antibodyIndex].y += moveLength*Math.sin(this.antibodies[antibodyIndex].angle);
    }

    distanceBetweenTwoPoints(x1, y1, x2, y2) {
        let xDiff = x1 - x2;
        let yDiff = y1 - y2;
        return (Math.sqrt(xDiff**2 + yDiff**2));
    }

    handleVirusCollision(program_state, t) {
        for (let i = 0; i < this.xpositions.length; i++) {
            if(this.infected[i] === true && this.eaten[i] === false) {
                if (this.distanceBetweenTwoPoints(this.torusLocation.x, this.torusLocation.y, this.xpositions[i], this.ypositions[i]) <= this.radiusOfTorus) {
                    this.eaten[i] = true;
                    this.ateTime = program_state.animation_time / 1000
                }
            }
        }
        for (let i = 0; i < this.numAntibodies; i++) {
            if (this.distanceBetweenTwoPoints(this.torusLocation.x, this.torusLocation.y, this.antibodies[i].x, this.antibodies[i].y) <= this.radiusOfTorus)
            {
                // TODO: Need to show game over screen. right now only turns virus color to blue
                if (this.timeElapsed > 3)
                    this.gameOver = true;
                    this.timeLost = this.timer - t;
                break;
            }
        }
    }
}

class Gouraud_Shader extends Shader {
    // This is a Shader using Phong_Shader as template
    // TODO: Modify the glsl coder here to create a Gouraud Shader (Planet 2)

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        // ***** PHONG SHADING HAPPENS HERE: *****
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the
                // light will appear directional (uniform direction from all points), and we
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to
                // the point light's location from the current surface point.  In either case,
                // fade (attenuate) the light as the vector needed to reach it gets longer.
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz -
                                               light_positions_or_vectors[i].w * vertex_worldspace;
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );

                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;
            // Position is expressed in object coordinates.

            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;

            void main(){
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){
                // Compute an initial (ambient) color:
                gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
                // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            } `;
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        // TODO:  Complete the main function of the vertex shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main(){

        }`;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        void main(){

        }`;
    }
}

class Shadow_Phong_Shader extends Shader          // THE DEFAULT SHADER: This uses the Phong Reflection Model, with optional Gouraud shading.
                                               // Wikipedia has good defintions for these concepts.  Subclasses of class Shader each store
                                               // and manage a complete GPU program.  This particular one is a big "master shader" meant to
                                               // handle all sorts of lighting situations in a configurable way.
                                               // Phong Shading is the act of determining brightness of pixels via vector math.  It compares
                                               // the normal vector at that pixel to the vectors toward the camera and light sources.
        // *** How Shaders Work:
        // The "vertex_glsl_code" string below is code that is sent to the graphics card at runtime,
        // where on each run it gets compiled and linked there.  Thereafter, all of your calls to draw
        // shapes will launch the vertex shader program once per vertex in the shape (three times per
        // triangle), sending results on to the next phase.  The purpose of this vertex shader program
        // is to calculate the final resting place of vertices in screen coordinates; each vertex
        // starts out in local object coordinates and then undergoes a matrix transform to get there.
        //
        // Likewise, the "fragment_glsl_code" string is used as the Fragment Shader program, which gets
        // sent to the graphics card at runtime.  The fragment shader runs once all the vertices in a
        // triangle / element finish their vertex shader programs, and thus have finished finding out
        // where they land on the screen.  The fragment shader fills in (shades) every pixel (fragment)
        // overlapping where the triangle landed.  It retrieves different values (such as vectors) that
        // are stored at three extreme points of the triangle, and then interpolates the values weighted
        // by the pixel's proximity to each extreme point, using them in formulas to determine color.
        // The fragment colors may or may not become final pixel colors; there could already be other
        // triangles' fragments occupying the same pixels.  The Z-Buffer test is applied to see if the
        // new triangle is closer to the camera, and even if so, blending settings may interpolate some
        // of the old color into the result.  Finally, an image is displayed onscreen.
    {
        shared_glsl_code()            // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        {
            return `precision mediump float;
        const int N_LIGHTS = 1;             // We're limited to only so many inputs in hardware.  Lights are costly (lots of sub-values).
        uniform float ambient, diffusivity, specularity, smoothness, animation_time, attenuation_factor;
        uniform bool GOURAUD, COLOR_NORMALS, USE_TEXTURE;               // Flags for alternate shading methods
        uniform vec4 lightPosition, lightColor, shapeColor;
        varying vec3 N, E;                    // Specifier "varying" means a variable's final value will be passed from the vertex shader 
        varying vec2 f_tex_coord;             // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the 
        varying vec4 VERTEX_COLOR;            // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 L, H;
        varying float dist;
        varying vec4 positionFromLight;
        
        vec3 phong_model_lights( vec3 N, bool shadowed )
          { vec3 result = vec3(0.0);

                float s = 1.0;
                if (shadowed) { s = 0.5; }
                float attenuation_multiplier = 1.0 / (1.0 + attenuation_factor * (dist * dist));
                float diffuse  =      max( dot(N, L), 0.0 );
                float specular = pow( max( dot(N, H), 0.0 ), smoothness );

                result += s * attenuation_multiplier * ( shapeColor.xyz * diffusivity * diffuse + lightColor.xyz * specularity * specular );
              
            return result;
          }
        `;
        }

        vertex_glsl_code()           // ********* VERTEX SHADER *********
        {
            return this.shared_glsl_code() +  `
        attribute vec3 object_space_pos, normal;
        attribute vec2 tex_coord;

        uniform mat4 camera_transform, camera_model_transform, projection_camera_model_transform, projection_transform, model_transform, light_transform;
        uniform mat3 inverse_transpose_modelview;

        void main()
        { gl_Position = projection_camera_model_transform * vec4(object_space_pos, 1.0);     // The vertex's final resting place (in NDCS).
          N = normalize( inverse_transpose_modelview * normal );                             // The final normal vector in screen space.
          f_tex_coord = tex_coord;                                         // Directly use original texture coords and interpolate between.
            
          vec4 world_position = (model_transform * vec4(object_space_pos, 1.0));
          positionFromLight = projection_transform * light_transform * world_position;


          if( COLOR_NORMALS )                                     // Bypass all lighting code if we're lighting up vertices some other way.
          { VERTEX_COLOR = vec4( N[0] > 0.0 ? N[0] : sin( animation_time * 3.0   ) * -N[0],             // In "normals" mode, 
                                 N[1] > 0.0 ? N[1] : sin( animation_time * 15.0  ) * -N[1],             // rgb color = xyz quantity.
                                 N[2] > 0.0 ? N[2] : sin( animation_time * 45.0  ) * -N[2] , 1.0 );     // Flash if it's negative.
            return;
          }
                                                  // The rest of this shader calculates some quantities that the Fragment shader will need:
          vec3 screen_space_pos = ( camera_model_transform * vec4(object_space_pos, 1.0) ).xyz;
          E = normalize( -screen_space_pos );


         // Light positions use homogeneous coords.  Use w = 0 for a directional light source -- a vector instead of a point.
            L = normalize( ( camera_transform * lightPosition ).xyz - lightPosition.w * screen_space_pos );
            H = normalize( L + E );
            
            // Is it a point light source?  Calculate the distance to it from the object.  Otherwise use some arbitrary distance.
            dist  = lightPosition.w > 0.0 ? distance((camera_transform * lightPosition).xyz, screen_space_pos)
                                               : distance( attenuation_factor * -lightPosition.xyz, object_space_pos.xyz );
          

          if( GOURAUD )                   // Gouraud shading mode?  If so, finalize the whole color calculation here in the vertex shader, 
          {                               // one per vertex, before we even break it down to pixels in the fragment shader.   As opposed 
                                          // to Smooth "Phong" Shading, where we *do* wait to calculate final color until the next shader.
            VERTEX_COLOR      = vec4( shapeColor.xyz * ambient, shapeColor.w);
            VERTEX_COLOR.xyz += phong_model_lights( N, false );
          }
        }`;
        }

        fragment_glsl_code()           // ********* FRAGMENT SHADER *********
        {                            // A fragment is a pixel that's overlapped by the current triangle.
            // Fragments affect the final image or get discarded due to depth.
            return this.shared_glsl_code() +  `
            uniform sampler2D shadowmap;
        uniform sampler2D texture;
        
        void main()
        { 
          vec3 vertex_relative_to_light = positionFromLight.xyz / positionFromLight.w;
          vertex_relative_to_light = vertex_relative_to_light * 0.5 + 0.5;
          float shadowmap_dist = texture2D(shadowmap, vertex_relative_to_light.xy).r;
          bool shadowed = vertex_relative_to_light.z > shadowmap_dist + 0.000001;
          
          if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec4 tex_color = texture2D( texture, f_tex_coord );                    // Sample the texture image in the correct place.
          float s = 1.0;
          if (shadowed) {s = 0.5;}                                                                            // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( s * ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N, shadowed );                   // Compute the final color with contributions from lights.
        }`;
        }

        // Define how to synchronize our JavaScript's variables to the GPU's:
        update_GPU(gl, gpu, g_state, model_transform, material) {                              // First, send the matrices to the GPU, additionally cache-ing some products of them we know we'll need:
            this.update_matrices(g_state, model_transform, gpu, gl);
            gl.uniform1f(gpu.animation_time_loc, g_state.animation_time / 1000);

            if (g_state.gouraud === undefined) {
                g_state.gouraud = g_state.color_normals = false;
            }    // Keep the flags seen by the shader
            gl.uniform1i(gpu.GOURAUD_loc, g_state.gouraud || material.gouraud);                // program up-to-date and make sure
            gl.uniform1i(gpu.COLOR_NORMALS_loc, g_state.color_normals);                              // they are declared.

            gl.uniform4fv(gpu.shapeColor_loc, material.color);    // Send the desired shape-wide material qualities
            gl.uniform1f(gpu.ambient_loc, material.ambient);    // to the graphics card, where they will tweak the
            gl.uniform1f(gpu.diffusivity_loc, material.diffusivity);    // Phong lighting formula.
            gl.uniform1f(gpu.specularity_loc, material.specularity);
            gl.uniform1f(gpu.smoothness_loc, material.smoothness);

            if (material.texture)                           // NOTE: To signal not to draw a texture, omit the texture parameter from Materials.
            {
                gpu.shader_attributes["tex_coord"].enabled = true;
                gl.uniform1f(gpu.USE_TEXTURE_loc, 1);
                gl.activeTexture(gl.TEXTURE1)
                gl.bindTexture(gl.TEXTURE_2D, material.texture.id);
                gl.activeTexture(gl.TEXTURE0)
            }
            else {
                gl.uniform1f(gpu.USE_TEXTURE_loc, 0);
                gpu.shader_attributes["tex_coord"].enabled = false;
            }

            if (!g_state.light) return;
            var lightPositions_flattened = [], lightColors_flattened = [], lightAttenuations_flattened = [];
            for (var i = 0; i < 4; i++) {
                lightPositions_flattened.push(g_state.light.position[i % 4]);
                lightColors_flattened.push(g_state.light.color[i % 4]);
                lightAttenuations_flattened[0] = g_state.light.attenuation;
            }
            
            var lightTransforms_flattened = Mat.flatten_2D_to_1D(g_state.light.transform.transposed())
            

            gl.uniformMatrix4fv(gpu.light_transform_loc, false, lightTransforms_flattened);
            gl.uniform4fv(gpu.lightPosition_loc, lightPositions_flattened);
            gl.uniform4fv(gpu.lightColor_loc, lightColors_flattened);
            gl.uniform1fv(gpu.attenuation_factor_loc, lightAttenuations_flattened);
            
            let shadowmap_loc = gl.getUniformLocation(this.program, "shadowmap")
            gl.uniform1i(shadowmap_loc, 0);
            let texture_loc = gl.getUniformLocation(this.program, "texture")
            gl.uniform1i(texture_loc, 1);
            
        }



        update_matrices(g_state, model_transform, gpu, gl)                                    // Helper function for sending matrices to GPU.
        {                                                   // (PCM will mean Projection * Camera * Model)
            let [P, C, M] = [g_state.projection_transform, g_state.camera_transform, model_transform],
                CM = C.times(M),
                PCM = P.times(CM),
                inv_CM = Mat4.inverse(CM).sub_block([0, 0], [3, 3]);
            // Send the current matrices to the shader.  Go ahead and pre-compute
            // the products we'll need of the of the three special matrices and just
            // cache and send those.  They will be the same throughout this draw
            // call, and thus across each instance of the vertex shader.
            // Transpose them since the GPU expects matrices as column-major arrays.
            gl.uniformMatrix4fv(gpu.model_transform_loc, false, Mat4.flatten_2D_to_1D(M.transposed()));
            gl.uniformMatrix4fv(gpu.projection_transform_loc, false, Mat4.flatten_2D_to_1D(P.transposed()));
            gl.uniformMatrix4fv(gpu.camera_transform_loc, false, Mat4.flatten_2D_to_1D(C.transposed()));
            gl.uniformMatrix4fv(gpu.camera_model_transform_loc, false, Mat4.flatten_2D_to_1D(CM.transposed()));
            gl.uniformMatrix4fv(gpu.projection_camera_model_transform_loc, false, Mat4.flatten_2D_to_1D(PCM.transposed()));
            gl.uniformMatrix3fv(gpu.inverse_transpose_modelview_loc, false, Mat4.flatten_2D_to_1D(inv_CM));
        }
    }

class Tiling_Shadow_Shader extends Shadow_Phong_Shader {
         fragment_glsl_code()           // ********* FRAGMENT SHADER *********
        {                            // A fragment is a pixel that's overlapped by the current triangle.
            // Fragments affect the final image or get discarded due to depth.
            return this.shared_glsl_code() + `
            uniform sampler2D shadowmap;
        uniform sampler2D texture;
        
        void main()
        { 
          vec3 vertex_relative_to_light = positionFromLight.xyz / positionFromLight.w;
          vertex_relative_to_light = vertex_relative_to_light * 0.5 + 0.5;
          float shadowmap_dist = texture2D(shadowmap, vertex_relative_to_light.xy).r;
          bool shadowed = vertex_relative_to_light.z > shadowmap_dist + 0.000001;
          
          if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec4 tex_color = texture2D( texture, f_tex_coord * 20.0 );                    // Sample the texture image in the correct place.
          float s = 1.0;
          if (shadowed) {s = 0.5;}                                                                            // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( s * ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N, shadowed );                   // Compute the final color with contributions from lights.
        }`;
        }
}


class Shadow_Shader extends Shader {
  update_GPU(gl, gpu, g_state, model_transform, material) {
    const [P, C, M] = [g_state.projection_transform, g_state.camera_transform, model_transform],
      PCM = P.times(C).times(M), CM = C.times(M);
    gl.uniformMatrix4fv(gpu.model_transform_loc, false, Mat.flatten_2D_to_1D(M.transposed()));
    gl.uniformMatrix4fv(gpu.camera_transform_loc, false, Mat.flatten_2D_to_1D(C.transposed()));
    gl.uniformMatrix4fv(gpu.projection_transform_loc, false, Mat.flatten_2D_to_1D(P.transposed()));
    gl.uniformMatrix4fv(gpu.projection_camera_model_transform_loc, false, Mat.flatten_2D_to_1D(PCM.transposed()));
    var lightTransforms_flattened = []
    for (var i = 0 ; i < g_state.lights.length; i++) {
      lightTransforms_flattened = Mat.flatten_2D_to_1D(g_state.lights[i].transform.transposed())
    }
    let lightColors_flattened = []
    for (var i = 0; i < 4 * g_state.lights.length; i++) {
      lightColors_flattened.push(g_state.lights[Math.floor(i / 4)].color[i % 4]);
    }
    gl.uniformMatrix4fv(gpu.light_transform_loc, false, lightTransforms_flattened);
    gl.uniform4fv(gpu.light_color_loc, lightColors_flattened);
  }

  shared_glsl_code() {
    return `
      precision mediump float;

      uniform float red;
      const int N_LIGHTS = 1;
      uniform vec4 lightPosition[N_LIGHTS], lightColor[N_LIGHTS];
      varying vec4 positionFromLight;
      varying vec4 world_position;
    `
  }
    
  vertex_glsl_code() {
    return this.shared_glsl_code() + `
      attribute vec3 object_space_pos;
      uniform mat4 projection_camera_model_transform;
      uniform mat4 projection_transform;
      uniform mat4 model_transform;
      uniform mat4 camera_transform;
      uniform mat4 light_transform[N_LIGHTS];

      void main() {
        gl_Position = projection_camera_model_transform * vec4(object_space_pos, 1.0);
        world_position = (model_transform * vec4(object_space_pos, 1.0));
        for (int i = 0; i < N_LIGHTS; i++) {
          positionFromLight = projection_transform * light_transform[i] * world_position;
        }

      }
    `
  }
    
  fragment_glsl_code() {
    return this.shared_glsl_code() + `
      uniform sampler2D shadowmap;
      bool in_shadow(vec4 vert) {
        vec3 vertex_relative_to_light = vert.xyz / vert.w;
        vertex_relative_to_light = vertex_relative_to_light * 0.5 + 0.5;
        float shadowmap_dist = texture2D(shadowmap, vertex_relative_to_light.xy).r;
        return vertex_relative_to_light.z > shadowmap_dist + 0.00001;
      }

      void main() {
        vec3 vertex_relative_to_light = positionFromLight.xyz / positionFromLight.w;
        vertex_relative_to_light = vertex_relative_to_light * 0.5 + 0.5;
        vec4 shadowmap_dist = texture2D(shadowmap, vertex_relative_to_light.xy);
        gl_FragColor = shadowmap_dist;
        
        if (in_shadow(positionFromLight)) {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
        else {
          gl_FragColor = vec4(0.0,1.0,0.0,1.0);
        }

        //gl_FragColor = texture2D(shadowmap, vertex_relative_to_light.xy);
      }
    `
  }
}