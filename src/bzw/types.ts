import * as math from "../math.ts";

const INDENT = "  ";

/** Contains all of the required information for the world mesh */
export interface IMesh{
  /** Vertices */
  vertices: number[];
  /** Indices */
  indices: number[];
  /** Vertex colors */
  colors: number[];
  /** Number of indices */
  indicesCount: number;
}

/** Smartly parse `string` into `number` */
export function parseNum(str: string, fallback: number = 0): number{
  const value = parseFloat(str);
  if(isNaN(value)){
    return fallback;
  }

  return value;
}

/** Base definition of a map object - should contain properties that are across **all** objects */
export abstract class MapObject{
  abstract HEADER: string;
  vertexCount: number = 0;

  name: string = "";

  constructor(line?: string){
  }

  /** Build the object's mesh and append it to `mesh` */
  abstract buildMesh(mesh: IMesh): void;

  toString(): string{
    let ret = `${this.HEADER}\n`;

    const properties = Object.keys(this);
    const values = Object.values(this);

    for(const i in properties){
      const property = properties[i];
      let value = values[i];

      // ignore helper properties
      if(["vertexCount", "HEADER"].includes(property)){
        continue;
      }

      // ignore empty values
      if(!value || (Array.isArray(value) && value.filter((val: any) => val).length === 0)){
        continue;
      }

      // ignore specific object properties
      if(
        this.HEADER === "zone" && property === "color" ||
        this.HEADER === "group" && property === "position"
      ){
        continue;
      }

      ret += `${INDENT}${property}`;

      if(typeof value === "number" || typeof value === "string"){
        // simple value
        ret += ` ${value}`;
      }else if(typeof value === "object" && Array.isArray(value) && typeof value[0] !== "object"){
        // array
        ret += ` ${value.join(" ")}`;
      }else if(typeof value === "object" && Array.isArray(value) && typeof value[0] === "object"){
        // complex value
        value = value.map((val: any) => val.toString().split("\n").map((line: string) => `${INDENT}${line}`).join("\n"));
        ret += `\n${value.join("\n\n")}`;
      }

      ret += "\n"
    }

    ret += "end";
    return ret;
  }

  /** Parse a line in the object's definition */
  parseLine(line: string): void{
    const parts = line.split(" ");

    if(parts[0] === "name"){
      this.name = parts.slice(1).join(" ");
    }
  }

  /** Add indices */
  protected pushIndices(mesh: IMesh): void{
    mesh.indices.push(mesh.indicesCount);
    mesh.indices.push(mesh.indicesCount + 1);
    mesh.indices.push(mesh.indicesCount + 2);
    mesh.indices.push(mesh.indicesCount + 2);
    mesh.indices.push(mesh.indicesCount + 3);
    mesh.indices.push(mesh.indicesCount);
    mesh.indicesCount += 4;
  }

  /** Add colors */
  protected pushColors(mesh: IMesh, count = 1, r = 0, g = 0, b = 0, a = 1): void{
    for(let i = 0; i < count; i++){
      mesh.colors.push(r, g, b, a);
    }
  }
}

/** Very basic definition of a map object - contains properties common to almost every object */
export abstract class VeryBasicMapObject extends MapObject{
  position: [number, number, number] = [0, 0, 0];
  /** Rotation (around Z axis) */
  rotation: number = 0;
  shift: [number, number, number] = [0, 0, 0];

  parseLine(line: string): void{
    super.parseLine(line);

    const parts = line.split(" ");

    if(parts[0] === "position"){
      this.position = [parseNum(parts[1]), parseNum(parts[2]), parseNum(parts[3])];
    }else if(parts[0] === "shift"){
      this.shift = [parseNum(parts[1]), parseNum(parts[2]), parseNum(parts[3])]
    }else if(parts[0] === "rotation"){
      this.rotation = parseNum(parts[1]);
    }
  }

  /** Apply this object's `rotation`, `position` and `shift` to `mesh` */
  protected applyRotPosShift(mesh: IMesh): void{
    if(this.vertexCount === 0){
      return;
    }

    this.applyRotation(mesh);

    // apply position + shift
    for(let i = mesh.vertices.length - this.vertexCount; i < mesh.vertices.length; i += 3){
      mesh.vertices[i] += this.position[0] + this.shift[0];
    }
    for(let i = mesh.vertices.length - (this.vertexCount - 1); i < mesh.vertices.length; i += 3){
      mesh.vertices[i] += this.position[2] + this.shift[2];
    }
    for(let i = mesh.vertices.length - (this.vertexCount - 2); i < mesh.vertices.length; i += 3){
      mesh.vertices[i] -= this.position[1] + this.shift[1];
    }
  }

  /** Apply this objects rotation */
  protected applyRotation(mesh: IMesh): void{
    if(this.vertexCount === 0){
      return;
    }

    const _rotation = this.rotation * Math.PI / 180;

    for(let i = mesh.vertices.length - this.vertexCount; i < mesh.vertices.length; i += 3){
      const rot = math.rotY([mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]], _rotation);
      mesh.vertices[i] = rot[0];
      mesh.vertices[i + 1] = rot[1];
      mesh.vertices[i + 2] = rot[2];
    }
  }
}

/** Basic definition of a map object - contains properties common to a lot of objects */
export abstract class BasicMapObject extends VeryBasicMapObject{
  size: [number, number, number] = [10, 10, 10];
  color?: [number, number, number, number] = undefined; // explicitly set to `undefined` so it always exists

  parseLine(line: string): void{
    super.parseLine(line);

    const parts = line.split(" ");

    if(parts[0] === "size"){
      this.size = [parseNum(parts[1], .5), parseNum(parts[2], .5), parseNum(parts[3], 1)];
      if(parseFloat(parts[3]) === 0){
        this.size[2] = .01;
      }
    }else if(parts[0] === "color"){
      this.color = [parseNum(parts[1], 1), parseNum(parts[2], 1), parseNum(parts[3], 1), parseNum(parts[4], 1)];
    }
  }
}

export abstract class BoxLike extends BasicMapObject{
  vertexCount = 72;

  buildMesh(mesh: IMesh): void{
    let {size, color} = this;

    let defaultColor = false;
    if(!color){
      defaultColor = true;
      color = [.61, .26, .12, 1];
    }

    // top
    mesh.vertices.push(-size[0], size[2], -size[1]);
    mesh.vertices.push(-size[0], size[2],  size[1]);
    mesh.vertices.push( size[0], size[2],  size[1]);
    mesh.vertices.push( size[0], size[2], -size[1]);
    this.pushIndices(mesh);

    // bottom
    mesh.vertices.push( size[0], 0, -size[1]);
    mesh.vertices.push( size[0], 0,  size[1]);
    mesh.vertices.push(-size[0], 0,  size[1]);
    mesh.vertices.push(-size[0], 0, -size[1]);
    this.pushIndices(mesh);

    // back
    mesh.vertices.push( size[0], 0,       -size[1]);
    mesh.vertices.push(-size[0], 0,       -size[1]);
    mesh.vertices.push(-size[0], size[2], -size[1]);
    mesh.vertices.push( size[0], size[2], -size[1]);
    this.pushIndices(mesh);

    // front
    mesh.vertices.push( size[0], size[2], size[1]);
    mesh.vertices.push(-size[0], size[2], size[1]);
    mesh.vertices.push(-size[0], 0,       size[1]);
    mesh.vertices.push( size[0], 0,       size[1]);
    this.pushIndices(mesh);

    // left
    mesh.vertices.push(-size[0], 0,       -size[1]);
    mesh.vertices.push(-size[0], 0,        size[1]);
    mesh.vertices.push(-size[0], size[2],  size[1]);
    mesh.vertices.push(-size[0], size[2], -size[1]);
    this.pushIndices(mesh);

    // right
    mesh.vertices.push(size[0], size[2], -size[1]);
    mesh.vertices.push(size[0], size[2],  size[1]);
    mesh.vertices.push(size[0], 0,        size[1]);
    mesh.vertices.push(size[0], 0,       -size[1]);
    this.pushIndices(mesh);

    this.applyRotPosShift(mesh);

    if(!defaultColor){
      this.pushColors(mesh, 8, color[0], color[1], color[2], color[3]); // top
    }else{
      this.pushColors(mesh, 8, .75, .75, .75, color[3]); // top-bottom
    }
    this.pushColors(mesh, 16, color[0], color[1], color[2], color[3]); // front-back
  }
}
