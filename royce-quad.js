import {defs, tiny} from './examples/common.js';
import {Shape_From_File} from './shape-from-file.js';
import {SceneNode} from './scene-graph.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

const {Textured_Phong} = defs

// NOTE: droplet refers to rain or snow

const NUM_DROPLETS = 200;
const MIN_VISIBLE_X_COORD = -19; 
const MAX_VISIBLE_X_COORD = 19; 
const MIN_VISIBLE_Z_COORD = -25; 
const MAX_VISIBLE_Z_COORD = 10;
const MIN_RAINDROP_SPEED = 30;
const MAX_RAINDROP_SPEED = 60; 
const MIN_DROPLET_SPAWN_HEIGHT = 25;
const MAX_DROPLET_SPAWN_HEIGHT = 30;
const GRAVITY = 10;

const MIN_CLOUD_X_COORD = -18;
const MAX_CLOUD_X_COORD = 18;
const MIN_CLOUD_Y_COORD = 25;
const MAX_CLOUD_Y_COORD = 30;
const MIN_CLOUD_Z_COORD = -15;
const MAX_CLOUD_Z_COORD = 18;
const MAX_NUM_CLOUDS = 50;
const LIGHT_INTENSITY_DECREASE_FACTOR = 0.87 // lower means light intensity decreases faster, vice versa

const MIN_FISH_SPEED = .007; // "speed" = distance per frame
const MAX_FISH_SPEED =  .03;


const SPRING = 1;
const SUMMER = 2;
const FALL   = 3;
const WINTER = 4;

const SPRING_LEAVES_RGB = [1, .4196, .749];
const SUMMER_LEAVES_RGB = [.5333, .9686, .2431];
const FALL_LEAVES_RGB   = [.9686, .4, .3098];
const WINTER_LEAVES_RGB = [.9020, .9490, .9608];

const SPRING_BRANCH_RGB = [.7216, .7068, .5608];
const SUMMER_BRANCH_RGB = [.4, .2275, .0431];
const FALL_BRANCH_RGB   = [.5490, .2196, .1647];
const WINTER_BRANCH_RGB = [.8118, .7882, .7843];

const SNOW_CIRCLE_CHANGE_RATE = 0.05;
const MAX_SNOW_CIRCLE_RADIUS = 22;

class Open_Cylinder extends Shape {
    // Combine a tube and a regular polygon to make an open cylinder.
    constructor(rows, columns, texture_range) {
        // Flat shade this to make a prism, where #columns = #sides.
        super("position", "normal", "texture_coord");
        defs.Cylindrical_Tube.insert_transformed_copy_into(this, [rows, columns, texture_range]);
        defs.Regular_2D_Polygon.insert_transformed_copy_into(this, [1, columns], Mat4.translation(0, 0, .5));
    }
}

class Fish_Shape extends Shape {
    // Combine a sphere and a cone to make a fish shape.
    constructor() {
        super("position", "normal", "texture_coord");
        defs.Subdivision_Sphere.insert_transformed_copy_into(this, [4], Mat4.scale(.5, 1, 1));
        defs.Closed_Cone.insert_transformed_copy_into(this, [4, 10, [[0, 2], [0, 1]]], Mat4.translation(0, 0, -1).times(Mat4.scale(0.1, 1, 1)));
    }
}

class Fish {
    constructor(dir, x_pos, z_pos, speed) {
        this.direction = dir;
        this.x_pos = x_pos;
        this.z_pos = z_pos;
        this.speed = speed;

        // create colliders
        let cosine = Math.cos(this.direction);
        let sine = Math.sin(this.direction);

        let collider1 = [this.x_pos+.2*cosine, this.z_pos-.2*sine]; // head collider
        let collider2 = [this.x_pos, this.z_pos];                   // center body collider
        let collider3 = [this.x_pos-.2*cosine, this.z_pos+.2*sine]; // lower body collider
        let collider4 = [this.x_pos-.7*cosine, this.z_pos+.7*sine]; // tail collider

        this.colliders = [collider1, collider2, collider3, collider4];

        // variable to indicate if fish is currently in "waiting" state
        // (collision detection pauses for a bit after 1 detection, to prevent spazzing)
        // if put in waiting state, this variable will be set to 0 and be incrementally increased to 1
        this.waiting = 1;
    }
}


export class Royce_Quad_Scene extends Scene {

    constructor() {
        super();
        this.hover = this.swarm = false;

        this.shapes = {
            'backdrop': new defs.Square(),
            'sun': new defs.Subdivision_Sphere(4),
            'moon': new defs.Subdivision_Sphere(4),
            'raindrop': new defs.Subdivision_Sphere(2),
            'snow': new defs.Subdivision_Sphere(2),
            'royce': new Shape_From_File("assets/royce.obj"),
            'cloud': new defs.Subdivision_Sphere(2),
            'fountain': new Open_Cylinder(4, 12, [[0, 2], [0, 1]]),
            'circle': new defs.Regular_2D_Polygon(4,20),
            'island': new Shape_From_File("assets/island.obj"),
            'fish': new Fish_Shape(),
            'branch': new Shape_From_File("assets/tree.obj"),
            'leaf': new Shape_From_File("assets/leaves.obj"),
            'falling_leaf': new Shape_From_File("assets/leaf.obj"),
            'walkway': new Shape_From_File("assets/walkway.obj"),
            'bricks': new Shape_From_File("assets/bricks.obj"),
            'grass': new Shape_From_File("assets/grass.obj"),
            'lamp': new Shape_From_File("assets/lamp.obj"),
            'light': new Shape_From_File("assets/light.obj"),
            'letters': new Shape_From_File("assets/letters.obj"),
        };

        this.materials = {
            backdrop_day: new Material(new defs.Phong_Shader(),
                {ambient: 0.6, diffusivity: 0.5, specularity: 0, color: hex_color("#82aef5")}),
            backdrop_night: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 0, color: hex_color("#0c2245")}),
            island: new Material(new defs.Phong_Shader(),
                {ambient: 0.5, diffusivity: 1, specularity: .2, color: hex_color("#bfa584")}),    
            sun: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#fff98f")}),
            moon: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#9caeb8")}),
            raindrop: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#4179e8")}),
            snow: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#ffffff")}),
            cloud: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: color(1,1,1,.2)}),
            royce: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: 1, color: hex_color("#f7b2b2")}),
            fountain: new Material(new Texture_Scroll_X(), {
                color: hex_color("#000000"),
                ambient: 1, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/stone.jpeg")
                }),
            water: new Material(new Texture_Scroll_X(), {
                color: hex_color("#000000"),
                ambient: 1, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/water.jpg")
                }),
            ice: new Material(new Texture_Scroll_X(), {
                color: hex_color("#000000"),
                ambient: 1, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/ice.jpg")
                }),
            fish: new Material(new Texture_Scroll_X(), {
                color: hex_color("#000000"),
                ambient: 1, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/fishscales.jpg")
                }),
            fish_dead: new Material(new Texture_Scroll_X(), {
                color: hex_color("#000000"),
                ambient: 1, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/grayfishscales.jpg")
                }),
            branch: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: 1, color: hex_color("#663a0b")}),
            leaf: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: 1, color: hex_color("#88f73e")}),
            ground: new Material(new defs.Phong_Shader(),
                {ambient: 0.7, diffusivity: 1, specularity: .2, color: hex_color("#549c5b")}),
            concrete: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#999999")}),
            bricks: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#ad6751")}),
            grass: new Material(new defs.Phong_Shader(),
                {ambient: 0.5, diffusivity: 1, color: hex_color("#7ccf1f")}),
            lamp: new Material(new defs.Phong_Shader(),
                {ambient: 0.5, diffusivity: 1, color: hex_color("#000000")}),
            letters: new Material(new defs.Phong_Shader(),
                {ambient: 0.8, diffusivity: 1, color: hex_color("#FFFFFF")}),
        };

        this.music = new Audio();
        this.song_path = "assets/mistletoe.mp3";

        // set initial season to summer
        this.SEASON = SUMMER;
        this.PREV_SEASON = SUMMER;
        this.tree_branch_material = this.materials.branch;
        this.tree_leaves_material = this.materials.leaf;
        this.tree_current_branch_rgb = SUMMER_BRANCH_RGB;
        this.tree_current_leaves_rgb = SUMMER_LEAVES_RGB;

        this.starting_point_branch_rgb = SUMMER_BRANCH_RGB;
        this.starting_point_leaves_rgb = SUMMER_LEAVES_RGB;
        this.tree_target_branch_rgb = SUMMER_BRANCH_RGB;
        this.tree_target_leaves_rgb = SUMMER_LEAVES_RGB;

        this.season_transition_time = 0;

        // arrays for special objects that we need to keep track of
        this.trees_arr = [];
        this.falling_leaves_info = [];
        this.falling_leaf_nodes = [];
        this.streetlight_nodes = [];

        // initalize scene graph
        // NOTE: This is a dummy root node using sun shape and material. Root should be snow globe in the future...
        this.scene_graph_arr = [];
        this.initialize_scene_graph();

        // get the coordinates that the droplets will spawn at, and their speeds
        // each spawn_info is a list: [x_pos, z_pos, speed]
        this.get_droplet_spawn_info();

        // snow circle variables
        this.snow_circle_scale = 0;
        this.target_snow_circle_scale = 0;
        
        this.pre_island = Mat4.identity();

        this.rgb_array = [hex_color("#fc3030"), hex_color("#5757ff"), hex_color("#21db43")];
    }

    make_control_panel() {
        this.key_triggered_button("Day/Night time", ["n"], () => {
            this.NIGHT_TIME ^= true;
            if (!this.NIGHT_TIME)
                this.CHRISTMAS = false;
        });
        this.key_triggered_button("Rain", ["q"], () => {
            this.RAIN ^= true;
        });
        this.key_triggered_button("Snow", ["e"], () => {
            this.SNOW ^= true;
        });
        this.key_triggered_button("Add cloud", ["c"], () => {
            this.add_cloud();
        });
        this.key_triggered_button("Clear clouds", ["l"], () => {
            this.reset_clouds();
        });
        this.key_triggered_button("Fountain view", ["v"], () => {
            this.FOUNTAIN_VIEW ^= true;
        });

        this.key_triggered_button("Rotate", ["r"], () => {
            this.ROTATE_SCENE ^= true;
        });
        this.key_triggered_button("Reset Island", ["Shift", "R"], () => {
            this.ROTATE_SCENE = false;
            this.pre_island = Mat4.identity();
        });

        // Buttons for seasons
        this.new_line();
        this.key_triggered_button("Spring", ["1"], () => {
            this.PREV_SEASON = this.SEASON;
            this.SEASON = SPRING;
            this.set_starting_and_target_tree_rgb(SPRING_BRANCH_RGB, SPRING_LEAVES_RGB);
            this.set_draw_falling_leaves(false);

            this.RAIN = false;
            this.SNOW = false;
          
            this.update_fish_on_season_change(this.materials.water, this.materials.fish);

            this.set_target_clouds(5);

            this.target_snow_circle_scale = 0;
        });
        this.key_triggered_button("Summer", ["2"], () => {
            this.PREV_SEASON = this.SEASON;
            this.SEASON = SUMMER;
            this.set_starting_and_target_tree_rgb(SUMMER_BRANCH_RGB, SUMMER_LEAVES_RGB);
            this.set_draw_falling_leaves(false);

            this.RAIN = false;
            this.SNOW = false;
          
            this.update_fish_on_season_change(this.materials.water, this.materials.fish);

            this.set_target_clouds(0);

            this.target_snow_circle_scale = 0;
        });
        this.key_triggered_button("Fall", ["3"], () => {
            this.PREV_SEASON = this.SEASON;
            this.SEASON = FALL;
            this.set_starting_and_target_tree_rgb(FALL_BRANCH_RGB, FALL_LEAVES_RGB);
            this.set_draw_falling_leaves(true);

            this.RAIN = true;
            this.SNOW = false;

            this.update_fish_on_season_change(this.materials.water, this.materials.fish);

            this.set_target_clouds(15);

            this.target_snow_circle_scale = 0;
        });
        this.key_triggered_button("Winter", ["4"], () => {
            this.PREV_SEASON = this.SEASON;
            this.SEASON = WINTER;
            this.set_starting_and_target_tree_rgb(WINTER_BRANCH_RGB, WINTER_LEAVES_RGB);
            this.set_draw_falling_leaves(false);

            this.RAIN = false;
            this.SNOW = true;
            // dont need to set leaf material since we just set leaf.draw to false in update_trees_on_season()

            this.update_fish_on_season_change(this.materials.ice, this.materials.fish_dead);

            this.set_target_clouds(35);

            this.target_snow_circle_scale = MAX_SNOW_CIRCLE_RADIUS;
        });
        this.new_line();
        this.key_triggered_button("Happy Holidays!", ["x"], () => {
            if (this.NIGHT_TIME) {
                this.CHRISTMAS ^= true;
                this.play_music();
            }  
        });
        this.key_triggered_button("Stop music", ["Enter"], () => {
            this.music.pause();
        });
  
    }

    play_music() {
        if (this.CHRISTMAS) {
            this.music.src = this.song_path;
            this.music.play();
        }
        else
            this.music.pause();
    }

    set_starting_and_target_tree_rgb(target_branch_rgb, target_leaves_rgb) {
        if (this.PREV_SEASON == SPRING) {
            this.starting_point_branch_rgb = SPRING_BRANCH_RGB;
            this.starting_point_leaves_rgb = SPRING_LEAVES_RGB;
        } else if (this.PREV_SEASON == SUMMER) {
            this.starting_point_branch_rgb = SUMMER_BRANCH_RGB;
            this.starting_point_leaves_rgb = SUMMER_LEAVES_RGB;
        } else if (this.PREV_SEASON == FALL) {
            this.starting_point_branch_rgb = FALL_BRANCH_RGB;
            this.starting_point_leaves_rgb = FALL_LEAVES_RGB;
        } else if (this.PREV_SEASON == WINTER) {
            this.starting_point_branch_rgb = WINTER_BRANCH_RGB;
            this.starting_point_leaves_rgb = WINTER_LEAVES_RGB;
        }   

        this.tree_target_branch_rgb = target_branch_rgb;
        this.tree_target_leaves_rgb = target_leaves_rgb;
    }

    get_random_val_in_range(low, high) {
        return Math.random() * (high - low) + low;
    }

    get_droplet_spawn_info() {
        this.droplet_spawn_info = [];
        for (let i = 0; i < NUM_DROPLETS; i++) {
            let curr_coord = [
                this.get_random_val_in_range(MIN_VISIBLE_X_COORD, MAX_VISIBLE_X_COORD),
                this.get_random_val_in_range(MIN_DROPLET_SPAWN_HEIGHT, MAX_DROPLET_SPAWN_HEIGHT),
                this.get_random_val_in_range(MIN_VISIBLE_Z_COORD, MAX_VISIBLE_Z_COORD),
                this.get_random_val_in_range(MIN_RAINDROP_SPEED, MAX_RAINDROP_SPEED)
            ];
            this.droplet_spawn_info.push(curr_coord);
        }
    }

    draw_droplet(context, program_state, model_transform, t, x_pos, z_pos, init_height, velocity, droplet_type) {

        let bound_t = t % (init_height/40);

        // snow falls slower - at a constant rate
        if (droplet_type == "snow") {
            velocity = .1;
            bound_t = t % (init_height/10);
        }
        
        let droplet_curr_height = init_height - (velocity * bound_t + (5*bound_t*bound_t));

        if (droplet_type == "rain") {
            let raindrop_transform = model_transform
                .times(Mat4.translation(x_pos, droplet_curr_height, z_pos))
                .times(Mat4.scale(0.1, 0.2, 0.1));
            
            this.shapes.raindrop.draw(context, program_state, raindrop_transform, this.materials.raindrop); 
        }
        else if (droplet_type == "snow") {
            let snow_transform = model_transform
                .times(Mat4.translation(x_pos, droplet_curr_height, z_pos))
                .times(Mat4.scale(0.3, 0.3, 0.3));
            
            this.shapes.snow.draw(context, program_state, snow_transform, this.materials.snow); 
        }
    }

    draw_all_droplets(context, program_state, model_transform, t, droplet_type) {
        this.droplet_spawn_info.forEach(spawn_info => {
            let x_pos = spawn_info[0];
            let y_pos = spawn_info[1];
            let z_pos = spawn_info[2];
            let speed = spawn_info[3];

            this.draw_droplet(context, program_state, model_transform, t, x_pos, z_pos, y_pos, speed, droplet_type);
        });
    }

    reset_clouds() {
        // reset cloud variables to initial state (no clouds)
        for (let i = 0; i < this.cloud_nodes.length; i++)
            this.cloud_nodes[i].setDraw(false);

        this.num_clouds = 0;
        this.day_light_intensity = 10000;
        this.night_light_intensity = 100;

        this.target_num_clouds = this.num_clouds;
        this.target_day_light_intensity = this.day_light_intensity;
        this.target_night_light_intensity = this.night_light_intensity;
    }

    add_cloud() {
        // add one cloud instantaneously
        this.num_clouds = Math.min(this.num_clouds + 1, MAX_NUM_CLOUDS);
        this.day_light_intensity *= LIGHT_INTENSITY_DECREASE_FACTOR;
        this.night_light_intensity *= LIGHT_INTENSITY_DECREASE_FACTOR;

        this.target_num_clouds = this.num_clouds;
        this.target_day_light_intensity = this.day_light_intensity;
        this.target_night_light_intensity = this.night_light_intensity;
    }

    set_target_clouds(num_clouds) {
        // set target cloud variables, so that clouds can gradually grow or shrink during season transitions, and
        // light intensity can gradually shift
        this.target_num_clouds = num_clouds;
        this.target_day_light_intensity = 10000 * (LIGHT_INTENSITY_DECREASE_FACTOR**num_clouds);
        this.target_night_light_intensity = 100 * (LIGHT_INTENSITY_DECREASE_FACTOR**num_clouds);
        this.cloud_scale_factor = 0;
    }

    update_clouds() {
        let diff = this.target_num_clouds - this.num_clouds;
        const cloud_scale_factor_increment = 0.005;

        // if diff is positive, add more clouds by gradually growing them
        // if diff is zero, do nothing except draw already existing clouds
        if (diff >= 0) {
            let finished = true;
            for (let i = 0; i < this.num_clouds; i++) {
                let cloud_info = this.clouds_info[i];

                let x_pos = cloud_info[0];
                let y_pos = cloud_info[1];
                let z_pos = cloud_info[2];
                let x_scale = cloud_info[3];
                let y_scale = cloud_info[4];
                let z_scale = cloud_info[5];

                let cloud_transform = Mat4.identity()
                                    .times(Mat4.translation(x_pos,y_pos,z_pos))
                                    .times(Mat4.scale(x_scale,y_scale,z_scale));

                this.cloud_nodes[i].setLocalTransform(cloud_transform);
                this.cloud_nodes[i].setDraw(true);
            }
            for (let i = this.num_clouds; i < this.target_num_clouds; i++) {
                let cloud_info = this.clouds_info[i];

                let x_pos = cloud_info[0];
                let y_pos = cloud_info[1];
                let z_pos = cloud_info[2];
                this.cloud_scale_factor += cloud_scale_factor_increment;
                let x_scale = Math.min(this.cloud_scale_factor, cloud_info[3]);
                let y_scale = Math.min(this.cloud_scale_factor, cloud_info[4]);
                let z_scale = Math.min(this.cloud_scale_factor, cloud_info[5]);
                if (x_scale != cloud_info[3] || y_scale != cloud_info[4] || z_scale != cloud_info[5])
                    finished = false;

                let cloud_transform = Mat4.identity()
                                    .times(Mat4.translation(x_pos,y_pos,z_pos))
                                    .times(Mat4.scale(x_scale,y_scale,z_scale));

                this.cloud_nodes[i].setLocalTransform(cloud_transform);
                this.cloud_nodes[i].setDraw(true);
            }
            if (finished)
                this.num_clouds = this.target_num_clouds;
        }

        // if diff is negative, get rid of clouds by shrinking them
        if (diff < 0) {
            let finished = true;
            for (let i = 0; i < this.target_num_clouds; i++) {
                let cloud_info = this.clouds_info[i];

                let x_pos = cloud_info[0];
                let y_pos = cloud_info[1];
                let z_pos = cloud_info[2];
                let x_scale = cloud_info[3];
                let y_scale = cloud_info[4];
                let z_scale = cloud_info[5];

                let cloud_transform = Mat4.identity()
                                    .times(Mat4.translation(x_pos,y_pos,z_pos))
                                    .times(Mat4.scale(x_scale,y_scale,z_scale));

                this.cloud_nodes[i].setLocalTransform(cloud_transform);
                this.cloud_nodes[i].setDraw(true);
            }
            for (let i = this.target_num_clouds; i < this.num_clouds; i++) {
                let cloud_info = this.clouds_info[i];

                let x_pos = cloud_info[0];
                let y_pos = cloud_info[1];
                let z_pos = cloud_info[2];
                this.cloud_scale_factor += cloud_scale_factor_increment;
                let x_scale = Math.max(0, cloud_info[3]-this.cloud_scale_factor);
                let y_scale = Math.max(0, cloud_info[4]-this.cloud_scale_factor);
                let z_scale = Math.max(0, cloud_info[5]-this.cloud_scale_factor);
                if (x_scale != 0 || y_scale != 0 || z_scale != 0)
                    finished = false;

                let cloud_transform = Mat4.identity()
                                    .times(Mat4.translation(x_pos,y_pos,z_pos))
                                    .times(Mat4.scale(x_scale,y_scale,z_scale));

                this.cloud_nodes[i].setLocalTransform(cloud_transform);
                this.cloud_nodes[i].setDraw(true);
            }
            if (finished)
                this.num_clouds = this.target_num_clouds;
        }
            
    }

    update_light_intensity() {
        // day 
        let day_diff = this.target_day_light_intensity - this.day_light_intensity;
        let day_step = day_diff/50;
        this.day_light_intensity += day_step;

        // night
        let night_diff = this.target_night_light_intensity - this.night_light_intensity;
        let night_step = night_diff/50;
        this.night_light_intensity += night_step;
    }
    
    // function to generate random points within a sphere with given radius using spherical coordinates
    get_point_in_sphere(r) {
        let u = Math.random();
        let v = Math.random();
        let theta = u * 2.0 * Math.PI;
        let phi = Math.acos(2.0 * v - 1.0);

        let sinTheta = Math.sin(theta);
        let cosTheta = Math.cos(theta);
        let sinPhi = Math.sin(phi);
        let cosPhi = Math.cos(phi);
        let x = r * sinPhi * cosTheta;
        let y = r * sinPhi * sinTheta;
        let z = r * cosPhi;

        return [x, y, z];
    }

    initialize_ground(parent_node) {
        let island_node = new SceneNode(this.shapes.island, this.materials.island);
        let island_transform = Mat4.identity()
                                    .times(Mat4.translation(0,-12.5,0))
                                    .times(Mat4.scale(15,15,15));
        island_node.setLocalTransform(island_transform);
        
        let ground_node = new SceneNode(this.shapes.circle, this.materials.ground);
        ground_node.setParent(island_node);
        let ground_transform = Mat4.identity()
                                    .times(Mat4.translation(0,0.635,0))
                                    .times(Mat4.rotation(Math.PI/2,1,0,0))
                                    .times(Mat4.scale(1.435,1.435,1.435));
        ground_node.setLocalTransform(ground_transform);
                                    
        let walkway_node = new SceneNode(this.shapes.walkway, this.materials.concrete);
        walkway_node.setParent(island_node);
        let walkway_transform = Mat4.identity()
                                    .times(Mat4.translation(0,0.635,0.465))
                                    .times(Mat4.scale(0.92,0.92,0.92));
        walkway_node.setLocalTransform(walkway_transform);

        let bricks_node = new SceneNode(this.shapes.bricks, this.materials.bricks);
        bricks_node.setParent(island_node);
        let bricks_transform = Mat4.identity()
                                    .times(Mat4.translation(0,0.635,0.17))
                                    .times(Mat4.scale(0.82,0.82,0.82));
        bricks_node.setLocalTransform(bricks_transform);

        let letters_node = new SceneNode(this.shapes.letters, this.materials.letters);
        letters_node.setParent(island_node);
        let letters_transform = Mat4.identity()
                                    .times(Mat4.translation(0,0.35,1.38))
                                    .times(Mat4.scale(0.4,0.4,0.4));
                                    
        letters_node.setLocalTransform(letters_transform);
        
        this.grass_info = [[0.52,0.8], [-0.52,0.8], [0.72,1.1], [-0.72,1.1], [0.85, 0.7], [-0.85, 0.7], [1,0.9], [-1,0.9],
                           [0.7,-0.65], [0.9,-0.9], [1.1,-0.7], [-0.7,-0.65], [-0.9,-0.9], [-1.1,-0.7]];
        this.grass_info.forEach(grass_info => {
            let grass_node = new SceneNode(this.shapes.grass, this.materials.grass);
            const x_pos = grass_info[0];
            const z_pos = grass_info[1];
            const angle = this.get_random_val_in_range(0,360);
            let grass_transform = Mat4.identity()
                                    .times(Mat4.translation(x_pos,0.65,z_pos))
                                    .times(Mat4.rotation(angle,0,1,0))
                                    .times(Mat4.scale(0.052,0.052,0.052));

            grass_node.setParent(island_node);
            grass_node.setLocalTransform(grass_transform);
        });

        this.lamp_info = [[0.35,1.3], [0.35,0.37], [1.32,0.37], [1.32,-0.45], [-0.35,1.3], [-0.35,0.37], [-1.32,0.37], [-1.32,-0.45]];
        this.lamp_info.forEach(lamp_info => {
            let lamp_node = new SceneNode(this.shapes.lamp, this.materials.lamp);
            lamp_node.setParent(island_node);
            const x_pos = lamp_info[0];
            const z_pos = lamp_info[1];
            let lamp_transform = Mat4.identity()
                                    .times(Mat4.translation(x_pos,1,z_pos))
                                    .times(Mat4.scale(0.2,0.2,0.2));
            lamp_node.setLocalTransform(lamp_transform);

            let light_node = new SceneNode(this.shapes.light, this.materials.moon);
            light_node.setParent(lamp_node);
            let light_transform = Mat4.identity()
                                    .times(Mat4.translation(0,0.70,0))
                                    .times(Mat4.scale(0.35,0.35,0.35));
            light_node.setLocalTransform(light_transform);

            // add to global lights array
            this.streetlight_nodes.push(light_node);
        });
        
        if (parent_node)
            island_node.setParent(parent_node);
    }
    
    initialize_clouds(parent_node) {
        this.clouds_info = [];
        this.cloud_nodes = [];
        for (let i = 0; i < MAX_NUM_CLOUDS; i++) {
            // determine random location and random shape for each cloud, push to clouds_info
            // determine random location within top half of a spherical zone with radius
            const RADIUS = 18;
            const x_pos = this.get_random_val_in_range(MIN_CLOUD_X_COORD, MAX_CLOUD_X_COORD);

            const z_range = Math.sqrt((RADIUS**2) - (x_pos**2));
            const z_pos = this.get_random_val_in_range(-z_range, z_range);

            const COMPRESSION = 0.6; // used to compress the range of heights for clouds so they don't spawn too high
            const y_range = Math.sqrt((RADIUS**2) - (x_pos**2) - (z_pos**2)) * COMPRESSION;
            const y_pos = this.get_random_val_in_range(MIN_CLOUD_Y_COORD, MIN_CLOUD_Y_COORD + y_range);

            const x_scale = this.get_random_val_in_range(5,8);
            const y_scale = this.get_random_val_in_range(0.5,3);
            const z_scale = this.get_random_val_in_range(5,8);
            this.clouds_info.push([x_pos,y_pos,z_pos,x_scale,y_scale,z_scale]);

            let cloud_transform = Mat4.identity()
                    .times(Mat4.translation(x_pos,y_pos,z_pos))
                    .times(Mat4.scale(x_scale,y_scale,z_scale));
            let cloud = new SceneNode(this.shapes.cloud, this.materials.cloud);
            cloud.setLocalTransform(cloud_transform);
            cloud.setParent(parent_node);
            cloud.setDraw(false);

            this.cloud_nodes.push(cloud);
        }

        this.num_clouds = 0;
        this.day_light_intensity = 10000;
        this.night_light_intensity = 100;
        this.target_num_clouds = this.num_clouds;
        this.target_day_light_intensity = this.day_light_intensity;
        this.target_night_light_intensity = this.night_light_intensity;
        this.cloud_scale_factor;
    }

    initialize_royce(parent_node) {
        let royce_transform = Mat4.identity()
            .times(Mat4.translation(0,4,-12))
            .times(Mat4.scale(5,5,5));
        
        let royce_node = new SceneNode(this.shapes.royce, this.materials.royce);
        royce_node.setLocalTransform(royce_transform);
        if (parent_node)
            royce_node.setParent(parent_node);
    }

    create_tree(tree_local_transform, parent_node) {
        let tree_node = new SceneNode(this.shapes.branch, this.materials.branch);
        
        // coordinates to translate spherical cluster of leaves to be placed on the 3 branches
        const branch_coords = [ [0,0.5,0.7], [-0.45,0.5,-0.1], [0.45, 0.5,-0.1]];
        
        let leaf_cluster = new SceneNode(this.shapes.leaf, this.materials.leaf);
        leaf_cluster.setParent(tree_node);
        leaf_cluster.setLocalTransform(Mat4.identity()
                                .times(Mat4.translation(0,0.8,0))
                                .times(Mat4.scale(1.3,1.3,1.3)));

        // Create leaves that will fall during FALL season
        // Loop once for each spherical cluster around each branch of the tree (there are 3 branches in each tree)
        for (let i = 0; i < 3; i++) {
            const NUM_LEAVES_PER_CLUSTER = 10;

            for (let j = 0; j < NUM_LEAVES_PER_CLUSTER; j++) {
                const RADIUS = 1;
                let coord = this.get_point_in_sphere(RADIUS);
                // Adjust coordinates relative to branch position
                coord[0] += branch_coords[i][0];
                coord[1] += branch_coords[i][1];
                coord[2] += branch_coords[i][2];
                const angle_x = this.get_random_val_in_range(0,360);
                const angle_y = this.get_random_val_in_range(0,360);
                const angle_z = this.get_random_val_in_range(0,360);
                coord.push(...[angle_x, angle_y, angle_z]);
                coord.push(this.get_random_val_in_range(0.01, 0.001)); 
                this.falling_leaves_info.push(coord);

                let leaf = new SceneNode(this.shapes.falling_leaf, this.materials.leaf);
                const x_pos = coord[0];
                const y_pos = coord[1];
                const z_pos = coord[2];
                leaf.setParent(tree_node);
                leaf.setLocalTransform(Mat4.identity()
                                    .times(Mat4.translation(x_pos, y_pos, z_pos))
                                    .times(Mat4.scale(0.08,0.08,0.08)));
                leaf.setDraw(false);
                this.falling_leaf_nodes.push(leaf);
            }
        }

        if (tree_local_transform)
            tree_node.setLocalTransform(tree_local_transform);
        if (parent_node)
            tree_node.setParent(parent_node);

        return tree_node;
    }

    initialize_trees(parent_node) {
        // initialize tree variables from left to right
        // each tree_info is a list: [x_pos, z_pos]; y is constant at the ground
        this.trees_info = [[-12, -9], [12, -9], [-9, 15], [9, 15], [-15, 9], [15, 9]];
        this.trees_info.forEach(tree_info => {
            const x_pos = tree_info[0];
            const z_pos = tree_info[1];
            const angle = this.get_random_val_in_range(0,360);
            let tree_transform = Mat4.identity()
                            .times(Mat4.translation(x_pos, 2, z_pos))
                            .times(Mat4.rotation(angle,0,1,0))
                            .times(Mat4.scale(2,2,2));

            let tree = this.create_tree(tree_transform, parent_node);

            // push tree into the trees array
            this.trees_arr.push(tree);
        });
    }

    initialize_fountain(parent_node) {
        // draw fountain
        let fountain_transform = Mat4.identity()
                                .times(Mat4.translation(0,-2.5,5))
                                .times(Mat4.scale(4.5,1,4.5))
                                .times(Mat4.rotation(Math.PI/2,1,0,0));

        // This node is the abstract transform node for all the fountain components
        let fountain_transform_node = new SceneNode();
        fountain_transform_node.setDraw(false);
        fountain_transform_node.setLocalTransform(fountain_transform);
        fountain_transform_node.setParent(parent_node);

        let fountain_node = new SceneNode(this.shapes.fountain, this.materials.fountain);
        fountain_node.setParent(fountain_transform_node);

        this.water_circle_node = new SceneNode(this.shapes.circle, this.materials.water);
        this.water_circle_node.setParent(fountain_transform_node);

        return fountain_transform_node;
    }

    initialize_fish(parent_node) {
        this.fishes = [];
        this.fish_nodes = [];
        const fish_x_positions = [1.25, -1.25, -1.25, 1.25];
        const fish_z_positions = [1.75, 1.75, -1.75, -1.75];

        let fish_transform = Mat4.identity().times(Mat4.scale(0.5, 0.5, 0.5));
        for (let i = 0; i < 4; i++) {
            let curr_fish_direction = this.get_random_val_in_range(0, 2 * Math.PI);
            let curr_fish_x_pos = fish_x_positions[i];
            let curr_fish_z_pos = fish_z_positions[i];
            let curr_fish_speed = this.get_random_val_in_range(MIN_FISH_SPEED, MAX_FISH_SPEED);
            this.fishes.push(new Fish(curr_fish_direction, curr_fish_x_pos, curr_fish_z_pos, curr_fish_speed));

            let fish_node = new SceneNode(this.shapes.fish, this.materials.fish);
            fish_node.setParent(parent_node);
            fish_node.setLocalTransform(fish_transform);
            this.fish_nodes.push(fish_node);
        }
    }

    initialize_snow_circle(parent_node) {
        this.snow_circle_node = new SceneNode(this.shapes.circle, this.materials.snow);
        this.snow_circle_node.setParent(parent_node);
        this.snow_circle_node.setDraw(false);
    }

    initialize_scene_graph() {
        // NOTE: This is a dummy root node. Root should be snow globe in the future...
        this.scene_graph_root = new SceneNode();
        this.scene_graph_root.setDraw(false);

        // initialize ground
        this.initialize_ground(this.scene_graph_root);

        // initialize clouds
        this.initialize_clouds(this.scene_graph_root);

        // initialize Royce Hall
        this.initialize_royce(this.scene_graph_root);

        // initialize trees 
        this.initialize_trees(this.scene_graph_root);

        // initialize fountain
        this.initialize_fountain(this.scene_graph_root);

        // initialize fish
        this.initialize_fish(this.scene_graph_root);

        // initialize white snow circles
        this.initialize_snow_circle(this.scene_graph_root);

        // Traverse scene graph and add all nodes to the scene graph array
        this.initialize_scene_graph_array(this.scene_graph_root);
    }

    initialize_scene_graph_array(scene_graph_node) {
        this.scene_graph_arr.push(scene_graph_node);
        
        scene_graph_node.children.forEach(child => {
            this.initialize_scene_graph_array(child);
        });
    }

    compare_rgb(rgb1, rgb2) {
        const EPSILON = 0.0001;
        if (rgb1 === rgb2) return true;
        if (rgb1 == null || rgb2 == null) return false;
        if (rgb1.length !== rgb2.length) return false;

        for (let i = 0; i < rgb2.length; ++i) {
            if (Math.abs(rgb1[i] - rgb2[i]) >= EPSILON) return false;
        }
        return true;
    }

    update_trees_on_season_change() { // t should be between [0,1]
        if (this.compare_rgb(this.tree_current_branch_rgb, this.tree_target_branch_rgb) && this.compare_rgb(this.tree_current_leaves_rgb, this.tree_target_leaves_rgb)) {
            this.season_transition_time = 0; // this.season_transition_time should be between [0,1]
            return;
        }

        let t = this.season_transition_time;
        let branch_direction_x = this.tree_target_branch_rgb[0] - this.starting_point_branch_rgb[0];
        let branch_direction_y = this.tree_target_branch_rgb[1] - this.starting_point_branch_rgb[1];
        let branch_direction_z = this.tree_target_branch_rgb[2] - this.starting_point_branch_rgb[2];

        let leaves_direction_x = this.tree_target_leaves_rgb[0] - this.starting_point_leaves_rgb[0];
        let leaves_direction_y = this.tree_target_leaves_rgb[1] - this.starting_point_leaves_rgb[1];
        let leaves_direction_z = this.tree_target_leaves_rgb[2] - this.starting_point_leaves_rgb[2];

        // Parametrize line between current rgb coordinate to target rgb coordinate
        this.tree_current_branch_rgb = [this.starting_point_branch_rgb[0] + t*branch_direction_x,
                                        this.starting_point_branch_rgb[1] + t*branch_direction_y,
                                        this.starting_point_branch_rgb[2] + t*branch_direction_z];
        this.tree_current_leaves_rgb = [this.starting_point_leaves_rgb[0] + t*leaves_direction_x,
                                        this.starting_point_leaves_rgb[1] + t*leaves_direction_y,
                                        this.starting_point_leaves_rgb[2] + t*leaves_direction_z];                              

    }

    update_trees_on_season() {
        let branch_r = this.tree_current_branch_rgb[0];
        let branch_g = this.tree_current_branch_rgb[1];
        let branch_b = this.tree_current_branch_rgb[2];

        let leaves_r = this.tree_current_leaves_rgb[0];
        let leaves_g = this.tree_current_leaves_rgb[1];
        let leaves_b = this.tree_current_leaves_rgb[2];
        this.trees_arr.forEach(tree => {
            tree.setMaterial(this.materials.branch.override({color: color(branch_r, branch_g, branch_b,1)}));
            tree.children.forEach(leaf => {
                leaf.setMaterial(this.materials.leaf.override({color: color(leaves_r, leaves_g, leaves_b,1)}));
            });
        });
    }

    set_draw_falling_leaves(drawFlag) {
        this.falling_leaf_nodes.forEach(leaf => {
            leaf.setDraw(drawFlag);
        });
    }

    update_falling_leaves(t) {
        for (let i = 0; i < this.falling_leaves_info.length; i++) {
            const x_pos = this.falling_leaves_info[i][0];
            const y_pos = this.falling_leaves_info[i][1];
            const z_pos = this.falling_leaves_info[i][2];

            const angle_x = this.falling_leaves_info[i][3];
            const angle_y = this.falling_leaves_info[i][4];
            const angle_z = this.falling_leaves_info[i][5];
            
            let velocity = this.falling_leaves_info[i][6];
            let falling_factor = 1; // falling factor = gravity / 2
            let bound = (velocity + Math.sqrt(velocity**2 + (4*falling_factor)*y_pos))/(2*falling_factor) + 0.7;
            let bound_t = t % bound;
            let leaf_curr_height = y_pos - (velocity * bound_t + (falling_factor*bound_t*bound_t));
            
            let leaf = this.falling_leaf_nodes[i];
            let falling_leaves_transform = Mat4.identity()
                                            .times(Mat4.translation(x_pos, leaf_curr_height, z_pos))
                                            .times(Mat4.rotation(angle_x,1,0,0))
                                            .times(Mat4.rotation(angle_y,0,1,0))
                                            .times(Mat4.rotation(angle_z,0,0,1))
                                            .times(Mat4.scale(0.08,0.08,0.08));

            this.falling_leaf_nodes[i].setLocalTransform(falling_leaves_transform);

        }
    }

    // gets the euclidean distance between 2 points on the x-z plane
    // p1 and p2 are each a list [x,z]
    get_dist(p1, p2) {
        return Math.sqrt( ( (p1[0] - p2[0]) ** 2) + ( (p1[1] - p2[1]) ** 2) );
    }

    // check if fish1's head is colliding with fish2 by checking fish1's head collider against all colliders of fish2
    check_fish_collision(fish1, fish2) {
        const FISH_COLLISION_DIST = 0.8;

        for (let i = 0; i < 4; i++) {
            if (this.get_dist(fish1.colliders[0], fish2.colliders[i]) < FISH_COLLISION_DIST)
                return true;
        }

        return false;
    }

    update_fish() {
        // draw 4 fishes
          
        const FOUNTAIN_RADIUS = 3.2;
        const FOUNTAIN_X_POS = 0;
        const FOUNTAIN_Z_POS = 5;

        for (let i = 0; i < 4; i++) {

            // collision detection with wall
            // turn fish around to a random angle in the opposite direction when its head hits the fountain wall
            const fish_distance_from_center = this.get_dist(this.fishes[i].colliders[0], [0,0]);
            if (fish_distance_from_center >= FOUNTAIN_RADIUS) {
                this.fishes[i].direction += this.get_random_val_in_range(Math.PI/2, 3*(Math.PI/2));
            }

            // collision detection with other fishes
            // turn fish around to a random angle in the opposite direction when its head hits anywhere on another fish, then wait
            for (let j = 0; j < 4; j++) {
                // fish can't collide with itself
                if (i==j)
                    continue;
                // if fish is waiting (just turned around), don't check for collision
                if (this.fishes[i].waiting < 1) {
                    this.fishes[i].waiting += .01;
                    continue;
                }
                if (this.check_fish_collision(this.fishes[i], this.fishes[j])) {
                    this.fishes[i].direction += this.get_random_val_in_range(Math.PI/2, 3*(Math.PI/2));
                    this.fishes[i].waiting = 0;
                }
            }
            
            // update fish position
            this.fishes[i].x_pos += this.fishes[i].speed * Math.cos(this.fishes[i].direction);
            this.fishes[i].z_pos += -this.fishes[i].speed * Math.sin(this.fishes[i].direction); // negative because +z points down

            // update fish colliders
            let cosine = Math.cos(this.fishes[i].direction);
            let sine = Math.sin(this.fishes[i].direction);
            this.fishes[i].colliders[0] = [this.fishes[i].x_pos+.2*cosine, this.fishes[i].z_pos-.2*sine]; // head collider
            this.fishes[i].colliders[1] = [this.fishes[i].x_pos, this.fishes[i].z_pos];                   // center body collider
            this.fishes[i].colliders[2] = [this.fishes[i].x_pos-.2*cosine, this.fishes[i].z_pos+.2*sine]; // lower body collider
            this.fishes[i].colliders[3] = [this.fishes[i].x_pos-.7*cosine, this.fishes[i].z_pos+.7*sine]; // tail collider

            // draw fish
            let fish_transform = Mat4.identity()
                .times(Mat4.translation(FOUNTAIN_X_POS + this.fishes[i].x_pos, -2.4, FOUNTAIN_Z_POS + this.fishes[i].z_pos))
                .times(Mat4.rotation(Math.PI/2,0,1,0)) // make its head face +x direction first
                .times(Mat4.rotation(this.fishes[i].direction, 0, 1, 0))
                .times(Mat4.scale(0.5, 0.5, 0.5));

            this.fish_nodes[i].setLocalTransform(fish_transform);
        }
    }

    update_fish_on_season_change(water_material, fish_material) {
        this.water_circle_node.setMaterial(water_material);
        for (let i = 0; i < this.fish_nodes.length; i++) {
            this.fish_nodes[i].setMaterial(fish_material);
        }
    }

    update_streetlights(streetlight_material) {
        this.streetlight_nodes.forEach(streetlight => {
            streetlight.setMaterial(streetlight_material);
        });
    }

    update_snow_circle() {
        let diff = this.target_snow_circle_scale - this.snow_circle_scale;

        if (diff < 0) {
            this.snow_circle_scale -= SNOW_CIRCLE_CHANGE_RATE; // our target is lower than our current
        }
        else if (diff > 0) {
            this.snow_circle_scale += SNOW_CIRCLE_CHANGE_RATE; // our target is higher than our current
        }

        if (this.snow_circle_scale < 4) {
            this.snow_circle_node.setDraw(false);
        }
        else {
            let snow_circle_transform = Mat4.identity()
                .times(Mat4.translation(0,-2.5,0))
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))
                .times(Mat4.scale(this.snow_circle_scale, this.snow_circle_scale, this.snow_circle_scale));

            this.snow_circle_node.setLocalTransform(snow_circle_transform);   
            this.snow_circle_node.setDraw(true);    
        }
    }

    display(context, program_state) {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            //program_state.set_camera(Mat4.translation(5, -10, -30)); original camera
            program_state.set_camera(Mat4.translation(0, -10, -100));
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        const t = program_state.animation_time / 1000; // time in seconds
        const dt = program_state.animation_delta_time / 1000;
        let model_transform = Mat4.identity(); // start at the origin                  

        // place light source where the sun/moon will be
        // place sun/moon
        let light_source_transform = model_transform
                                    .times(Mat4.translation(-16, 16, 30));   
        const light_position = light_source_transform.times(vec4(0,0,0,1));
        let light_color;

        /* SCENE GRAPH UPDATES - START */
        // This section is not actually drawing scene graph yet
        // Update clouds
        this.update_clouds();
        this.update_light_intensity();

        // Set tree colors based on season
        const SEASON_TRANSITION_TIME_DELTA = .01; 
        this.update_trees_on_season_change();
        this.season_transition_time += SEASON_TRANSITION_TIME_DELTA;
        this.update_trees_on_season();

        // Set leaves to fall during FALL season 
        if (this.SEASON == FALL)
            this.update_falling_leaves(t);

        // Update fish positions
        if (this.SEASON != WINTER)
            this.update_fish();

        // Update snow circle radius
        this.update_snow_circle();

        // SCENE GRAPH
        const angle = 15*Math.PI/60
        let island_transform = this.pre_island;
        if (this.ROTATE_SCENE)
            island_transform = island_transform.times(Mat4.rotation(angle*dt, 0, 1, 0));
        this.pre_island = island_transform;
        
        // Traverse scene graph and update world transforms for all nodes
        this.scene_graph_root.updateWorldMatrix(island_transform, context, program_state);
        /* SCENE GRAPH UPDATES - END*/

        if (this.NIGHT_TIME) {
            light_color = hex_color("#dadfed");
            program_state.lights = [new Light(light_position, light_color, this.night_light_intensity)];

            let streetlight_intensity = 50;
            let streetlight_color = hex_color("#fffc9c");

            // Add lights for streetlights
            for (let i = 0; i < this.streetlight_nodes.length; i++) {
                if (this.SEASON == WINTER && this.CHRISTMAS) {
                    streetlight_intensity = 100;
                    let j = (i + Math.floor(t)) % 3;
                    streetlight_color = this.rgb_array[j];
                }

                let light = new Light(this.streetlight_nodes[i].world_transform.times(vec4(0,0,0,1)), streetlight_color, streetlight_intensity);
                program_state.lights.push(light);
                // Set streetlight color
                this.streetlight_nodes[i].setMaterial(this.materials.sun.override({color: streetlight_color}));
            }
                          
        }
        else {
            light_color = hex_color("#ffe375");
            program_state.lights = [new Light(light_position, light_color, this.day_light_intensity)];
            for (let i = 1; i < 9; i++) {
                program_state.lights.push(new Light(light_position, light_color, 0))
            }
            this.streetlight_nodes.forEach(streetlight => {
                streetlight.setMaterial(this.materials.moon);
            });
        }

        // draw sun/moon and backdrop
        // place backdrop
        let backdrop_transform = model_transform
                                    .times(Mat4.translation(0,0,-19))
                                    .times(Mat4.scale(1000,1000,1));

        if (this.NIGHT_TIME) {
           this.shapes.moon.draw(context, program_state, light_source_transform, this.materials.moon);
           this.shapes.backdrop.draw(context, program_state, backdrop_transform, this.materials.backdrop_night);
        }
        else {
            this.shapes.sun.draw(context, program_state, light_source_transform.times(Mat4.scale(1.5,1.5,1.5)), this.materials.sun);
            this.shapes.backdrop.draw(context, program_state, backdrop_transform, this.materials.backdrop_day);
        }
        
        // draw rain and/or snow
        if (this.RAIN)
            this.draw_all_droplets(context, program_state, model_transform, t, "rain");  
        if (this.SNOW)
            this.draw_all_droplets(context, program_state, model_transform, t, "snow");

        // Draw all drawable nodes in scene graph
        this.scene_graph_arr.forEach(function(node) {
            node.drawNode(context, program_state);
        });

        // set camera
        if (this.FOUNTAIN_VIEW)
            program_state.set_camera(Mat4.inverse(island_transform.times(Mat4.translation(0,10,5).times(Mat4.rotation(-Math.PI/2,1,0,0)))));
        else
            program_state.set_camera(Mat4.translation(0, -5, -80));
    }
}

class Texture_Scroll_X extends Textured_Phong {
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            
            void main(){
                // Sample the texture image in the correct place:
                vec2 current_coord = f_tex_coord + vec2(2.0*(mod(animation_time, 128.0)), 0.0);
                vec4 tex_color = texture2D( texture, current_coord);
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}