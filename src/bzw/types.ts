import * as math from "../math.ts";

/** Contains all of the required information for the world mesh */
export interface IMesh{
  /** Vertices */
  vertices: number[];
  /** Indices */
  indices: number[];
  /** Colors */
  colors: number[];
  /** Number of indices */
  indicesCount: number;
}

/** Smartly parse `string` into `number` */
function parseNum(str: string, fallback: number = 0): number{
  const value = parseFloat(str);
  if(isNaN(value)){
    return fallback;
  }

  return value;
}

/** Basic definition of a map object - should contain properties that are across "all" objects */
export abstract class MapObject{
  /** Position */
  position: number[] = [0, 0, 0];
  /** Shift from position */
  shift: number[] = [0, 0 , 0];
  /** Size */
  size: number[] = [0, 0, 0];
  /** Rotation (Z axis) */
  rotation: number = 0;
  /** Color */
  color?: number[];

  /** Number of vertices */
  readonly VERTEX_COUNT: number = 0;

  /** Build the object's mesh and append it to `mesh` */
  abstract buildMesh(mesh: IMesh): void;

  /** Parse a line in the object's definition */
  parseLine(line: string): void{
    const parts = line.split(" ");

    if(parts[0] === "size"){
      this.size = [parseNum(parts[1], .5), parseNum(parts[2], .5), parseNum(parts[3], 1)];
      if(parseFloat(parts[3]) === 0){
        this.size[2] = .01;
      }
    }else if(parts[0] === "position"){
      this.position = [parseNum(parts[1]), parseNum(parts[2]), parseNum(parts[3])];
    }else if(parts[0] === "shift"){
      this.shift = [parseNum(parts[1]), parseNum(parts[2]), parseNum(parts[3])]
    }else if(parts[0] === "rotation"){
      this.rotation = parseNum(parts[1]);
    }else if(parts[0] === "color"){
      this.color = [parseNum(parts[1], 1), parseNum(parts[2], 1), parseNum(parts[3], 1), parseNum(parts[4], 1)];
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

  /**
   * Add indices 2
   * FIXME: this should be part of `pushIndices` with a dynamic number
   */
  protected pushIndices2(mesh: IMesh): void{
    mesh.indices.push(mesh.indicesCount);
    mesh.indices.push(mesh.indicesCount + 1);
    mesh.indices.push(mesh.indicesCount + 2);
    mesh.indicesCount += 3;
  }

  /** Add colors */
  protected pushColors(mesh: IMesh, count = 1, r = 0, g = 0, b = 0, a = 1): void{
    for(let i = 0; i < count; i++){
      mesh.colors.push(r, g, b, a);
    }
  }

  /** Apply this object's `rotation`, `position` and `shift` to `mesh` */
  protected applyRotPosShift(mesh: IMesh): void{
    if(this.VERTEX_COUNT === 0){
      console.error("this should not happen");
      return;
    }

    const _rotation = this.rotation * Math.PI / 180;

    // apply rotation
    for(let i = mesh.vertices.length - this.VERTEX_COUNT; i < mesh.vertices.length; i += 3){
      const rot = math.rotY([mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]], _rotation);
      mesh.vertices[i] = rot[0];
      mesh.vertices[i + 1] = rot[1];
      mesh.vertices[i + 2] = rot[2];
    }

    // apply position + shift
    for(let i = mesh.vertices.length - this.VERTEX_COUNT; i < mesh.vertices.length; i += 3){
      mesh.vertices[i] -= this.position[0] + this.shift[0];
    }
    for(let i = mesh.vertices.length - (this.VERTEX_COUNT - 1); i < mesh.vertices.length; i += 3){
      mesh.vertices[i] += this.position[2] + this.shift[2];
    }
    for(let i = mesh.vertices.length - (this.VERTEX_COUNT - 2); i < mesh.vertices.length; i += 3){
      mesh.vertices[i] += this.position[1] + this.shift[1];
    }
  };
}