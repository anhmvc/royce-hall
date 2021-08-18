import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class SceneNode {
    constructor(shape, material) {
        this.local_transform = Mat4.identity();
        this.world_transform = Mat4.identity();
        this.children = []; 
        this.shape = shape;
        this.material = material;
        this.draw = true;
    }

    setShape(shape) {
        this.shape = shape;
    }

    setMaterial(material) {
        this.material = material;
    }
    
    setDraw(draw_bool) {
        this.draw = draw_bool;
    }

    setLocalTransform(local_transform) {
        this.local_transform = local_transform;
    }
    
    setParent(parent) {
        // remove us from our parent
        if (this.parent) {
            let idx = this.parent.children.indexOf(this);
            if (idx >= 0) {
                this.parent.children.splice(idx, 1);
            }
        }

        if (parent) {
            parent.children.push(this);
        }

        this.parent = parent;
    }

    updateWorldMatrix(parentWorldTransform) {
        if (parentWorldTransform) {
            this.world_transform = parentWorldTransform.times(this.local_transform);
        } else {
            this.world_transform = this.local_transform;
        }

        let l_world_transform = this.world_transform;
        this.children.forEach(function(child) {
            child.updateWorldMatrix(l_world_transform);
        })
    }

    drawNode(context, program_state) {
        if (this.draw)
            this.shape.draw(context, program_state, this.world_transform, this.material); 
    }
}