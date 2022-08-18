export type Vertex = {
    x: number;
    y: number;
}

export type ExternalVertex = Vertex | [number, number];

export function vert_eql(a: Vertex, b: Vertex): boolean {
    return a.x === b.x && a.y === b.y;
}

export class VertexNode {
    constructor(public x: number, public y: number, public next: VertexNode | null = null) { }
}

export enum BundleState {
    UNBUNDLED,
    BUNDLE_HEAD,
    BUNDLE_TAIL,
}

export const EPSILON = 2.2204460492503131e-16;
export const LEFT = 0;
export const RIGHT = 1;
export const CLIP = 0;
export const SUBJ = 1;

export const isContributing: unique symbol = Symbol();
export const setContributing: unique symbol = Symbol();

export enum OperationType {
    DIF, INT, XOR, ADD,
}

export function EQ(a: number, b: number): boolean {
    return (Math.abs(a - b) <= EPSILON);
}

export function PREV_INDEX(i: number, n: number): number {
    return ((i - 1 + n) % n);
}

export function NEXT_INDEX(i: number, n: number): number {
    return ((i + 1) % n);
}

export enum VertexType {
    NUL = 0,  /* Empty non-intersection            */
    EMX = 1,  /* External maximum                  */
    ELI = 2,  /* External left intermediate        */
    TED = 3,  /* Top edge                          */
    ERI = 4,  /* External right intermediate       */
    RED = 5,  /* Right edge                        */
    IMM = 6,  /* Internal maximum and minimum      */
    IMN = 7,  /* Internal minimum                  */
    EMN = 8,  /* External minimum                  */
    EMM = 9,  /* External maximum and minimum      */
    LED = 10, /* Left edge                         */
    ILI = 11, /* Internal left intermediate        */
    BED = 12, /* Bottom edge                       */
    IRI = 13, /* Internal right intermediate       */
    IMX = 14, /* Internal maximum                  */
    FUL = 15, /* Full non-intersection             */
}

export function getVertexType(tr: number, tl: number, br: number, bl: number): VertexType {
    return tr + (tl << 1) + (br << 2) + (bl << 3);
}

export namespace HState {
    export const NH = 0; /* No horizontal edge                */
    export const BH = 1; /* Bottom horizontal edge            */
    export const TH = 2; /* Top horizontal edge               */

    /* Horizontal edge state transitions within scanbeam boundary */
    export const nextState =
        [
      /*        ABOVE     BELOW     CROSS */
      /*        L   R     L   R     L   R */
      /* NH */[BH, TH, TH, BH, NH, NH],
      /* BH */[NH, NH, NH, NH, TH, TH],
      /* TH */[NH, NH, NH, NH, BH, BH],
        ];
}

export type SimpleType<T> = new (pointList: Vertex[], isHole: boolean) => T;
export type CompoundType<T,U> = new (polyList: T[]) => U;

export class Rectangle {
    constructor(public minx: number, public miny: number, public maxx: number, public maxy: number) { }
}

export function polygonArea(points: Vertex[]) {
    const n = points.length;
    let a = 0;
    let { x: jx, y: jy } = points[n - 1];
    for (let i = 0; i < n; i++) {
        const {x: ix, y: iy } = points[i];
        a += (jx + ix) * (jy - iy); 
        jx = ix;
        jy = iy;
    }
    return a/2;
}