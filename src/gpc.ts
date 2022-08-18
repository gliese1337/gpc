import { clip } from "./Clip";
import { forceWinding, isConvex, rotateBottomLeft } from "./Conditioning";
import { wn_poly, Position } from "./Contains";
import { convexHull } from "./hull";
import { IPolygon } from "./IPolygon";
import { 
    OperationType, setContributing, isContributing,
    Rectangle, Vertex, ExternalVertex, polygonArea, EPSILON,
} from "./util";

export abstract class Polygon implements IPolygon {

    public abstract get isEmpty(): boolean;
    public abstract get isHole(): boolean;
    public abstract get bounds(): Rectangle;

    // Return true if the given inner polygon is contributing to the set operation.
    // This method should NOT be used outside the Clip algorithm.
    public abstract [isContributing](index: number): boolean;
    public abstract [setContributing](index: number, value: boolean): void;

    public abstract getInnerPolies(): Polygon[];

    // Return the number points in the polygon.
    public abstract getNumPoints(): number;

    // Return the vertex at the given index.
    public abstract get(index: number): Vertex;

    public abstract iterVertices(): IterableIterator<Vertex>;

    public abstract getArea(): number;

    public abstract contains(p: ExternalVertex): -1|0|1;
    public abstract contains(p: Polygon): -1|0|1;

    public abstract explode(): Polygon[];

    public abstract equals(obj: Polygon): boolean;

    public abstract toVertices(): { bounds: Vertex[][], holes: Vertex[][] };

    public abstract getHull(): Polygon;

    public toJSON() {
        return this.toVertices();
    }

    private static n_ary(op: OperationType, ...polys: Polygon[]): Polygon {
        return polys.reduce((acc, p) => clip(op, acc, p, SimplePolygon, MultiPolygon));
    }

    public static intersection(...p: Polygon[]): Polygon {
        return Polygon.n_ary(OperationType.INT, ...p);
    }

    public intersection(...p: Polygon[]): Polygon {
        return Polygon.intersection(this, ...p);
    }

    public static union(...p: Polygon[]): Polygon {
        return Polygon.n_ary(OperationType.ADD, ...p);
    }

    public union(...p: Polygon[]): Polygon {
        return Polygon.union(this, ...p);
    }

    public static xor(...p: Polygon[]): Polygon {
        return Polygon.n_ary(OperationType.XOR, ...p);
    }

    public xor(...p: Polygon[]): Polygon {
        return Polygon.xor(this, ...p);
    }

    public static difference(first: Polygon, ...p: Polygon[]): Polygon {
        switch (p.length) {
            case 0: return first;
            case 1: return clip(OperationType.DIF, first, p[0], SimplePolygon, MultiPolygon);
            default: {
                const clipper = p.reduce((acc, n) => clip(OperationType.ADD, acc, n, SimplePolygon, MultiPolygon));
                return clip(OperationType.DIF, first, clipper, SimplePolygon, MultiPolygon);
            }
        }        
    }

    public difference(...p: Polygon[]): Polygon {
        return Polygon.difference(this, ...p);        
    }

    public static fromPoints(points: ExternalVertex[]): Polygon {
        points = points.map((p) => Array.isArray(p) ? { x: p[0]||0, y: p[1]||0 } : p);
        points = rotateBottomLeft(points as Vertex[]);
        const a = forceWinding(1, points as Vertex[]);
        const p = new SimplePolygon(points as Vertex[], false);
        (p as any).area = a;
        return p;
    }
    
    public static holeFromPoints(points: ExternalVertex[]): Polygon {
        points = points.map((p) => Array.isArray(p) ? { x: p[0]||0, y: p[1]||0 } : p);
        points = rotateBottomLeft(points as Vertex[]);
        const a = forceWinding(-1, points as Vertex[]);
        const p = new SimplePolygon(points as Vertex[], true);
        (p as any).area = a;
        return p;
    }

    public static fromVertices({ bounds, holes }: { bounds: ExternalVertex[][], holes: ExternalVertex[][] }): Polygon {
        return Polygon.n_ary(OperationType.ADD, ...bounds.map(Polygon.fromPoints), ...holes.map(Polygon.holeFromPoints));
    }
}

// A simple polygon, with only one inner polygon--itself.
class SimplePolygon extends Polygon {

    private hull: Polygon | null = null;
    private area = NaN;
    private json: { bounds: Vertex[][]; holes: Vertex[][] } | null = null;

    /** Flag used by the Clip algorithm */
    private contributes: boolean = true;

    constructor(private pointList: Vertex[], public readonly isHole: boolean) {
        super();
    }

    public equals(that: Polygon): boolean {
        if (that === this) { return true; }
        if (!(that instanceof SimplePolygon) || this.isHole !== that.isHole) {
            return false;
        }

        const { pointList: v } = this;
        const { pointList: u } = that;
        const n = v.length;
        if (n !== u.length) { return false; }

        return v.every(({ x: vx, y: vy }, i) => {
            const {x: ux, y: uy } = u[i];
            return Math.abs(vx - ux) < EPSILON && Math.abs(vy - uy) < EPSILON;
        });
    }

    public get isEmpty(): boolean {
        return this.pointList.length === 0;
    }

    private _bounds: Rectangle | null = null;
    public get bounds(): Rectangle {
        if (this._bounds === null) {
            let xmin = Number.MAX_VALUE;
            let ymin = Number.MAX_VALUE;
            let xmax = -Number.MAX_VALUE;
            let ymax = -Number.MAX_VALUE;

            for (const { x, y } of this.pointList) {
                if (x < xmin) { xmin = x; }
                if (x > xmax) { xmax = x; }
                if (y < ymin) { ymin = y; }
                if (y > ymax) { ymax = y; }
            }

            this._bounds = new Rectangle(xmin, ymin, xmax, ymax);
        }

        return this._bounds;
    }

    public getInnerPolies(): Polygon[] {
        return [this];
    }

    public getNumPoints(): number {
        return this.pointList.length;
    }

    public get(index: number): Vertex {
        return this.pointList[index];
    }

    public iterVertices(): IterableIterator<Vertex> {
        return this.pointList[Symbol.iterator]();
    }

    public getArea(): number {
        if (isNaN(this.area)) {
            this.area = polygonArea(this.pointList);
        }
        return this.area;
    }

    public contains(p: ExternalVertex): 0 | 1 | -1;
    public contains(p: Polygon): 0 | 1 | -1;
    public contains(p: unknown): 0 | 1 | -1 {
        if (p instanceof Polygon) {
            let inside = 0;
            let outside = 0;
            for (const v of p.iterVertices()) {
                const pos = wn_poly(v, this.pointList);
                if (pos === Position.INSIDE) { inside++; }
                else if(pos === Position.OUTSIDE) { outside++; }
            }
            if (inside > 0 && outside === 0) { return this.isHole ? Position.OUTSIDE : Position.INSIDE; }
            if (outside > 0 && inside === 0) { return this.isHole ? Position.INSIDE : Position.OUTSIDE; }
            return Position.BOUNDARY;
        }
        if (p instanceof Array) {
            p = { x: p[0], y: p[1] };
        }
        // TODO: Test with holes
        return wn_poly(p as Vertex, this.pointList);
    }

    public explode() {
        return [this];
    }

    public [isContributing](polyIndex: number): boolean {
        if (polyIndex !== 0) {
            throw new Error("SimplePolygon only has one poly");
        }

        return this.contributes;
    }

    public [setContributing](polyIndex: number, contributes: boolean): void {
        if (polyIndex !== 0) {
            throw new Error("SimplePolygon only has one poly");
        }

        this.contributes = contributes;
    }

    public toVertices(): { bounds: Vertex[][], holes: Vertex[][] } {
        if (!this.json) {
            this.json =  this.isHole ? 
                { bounds: [], holes: [this.pointList] }:
                { bounds: [this.pointList], holes: [] };
        }
        return this.json;
    }

    public getHull(): Polygon {
        if (this.hull) { return this.hull; }
        this.hull = isConvex(this.pointList) ? this : new SimplePolygon(convexHull([...this.iterVertices()]), false);
        return this.hull;
    }
}

// MultiPolygon provides support for complex (with multiple disjoint cycles) and simple polygons and holes.
class MultiPolygon extends Polygon {

    private numPoints: number;
    private hull: Polygon | null = null;
    private area = NaN;
    private explosion: Polygon[] | null = null;
    private json: { bounds: Vertex[][]; holes: Vertex[][] } | null = null;

    constructor(private polyList: SimplePolygon[]) {
        super();
        this.polyList.sort((a, b) => {
            const ap = a.get(0);
            const bp = b.get(0);
            const t = ap.y - bp.y;
            return t === 0 ? ap.x - bp.x : t;
        });
        this.numPoints = polyList.reduce((a, n) => a + n.getNumPoints(), 0);
    }

    public equals(that: Polygon): boolean {
        return (that === this) || (
            (that instanceof MultiPolygon) &&
            that.polyList.length === this.polyList.length &&
            this.polyList.every((p, i) => p.equals(that.polyList[i]))
        );
    }

    public get isHole(): boolean {
        return false;
    }

    public get isEmpty(): boolean {
        return this.polyList.length === 0;
    }

    private _bounds: Rectangle | null = null;
    public get bounds(): Rectangle {
        if (this._bounds === null) {
            const { polyList } = this;
            if (polyList.length === 0) {
                this._bounds = new Rectangle(NaN, NaN, NaN, NaN);
            } else if (polyList.length === 1) {
                this._bounds = this.polyList[0].bounds;
            } else {
                let xmin = Number.MAX_VALUE;
                let ymin = Number.MAX_VALUE;
                let xmax = -Number.MAX_VALUE;
                let ymax = -Number.MAX_VALUE;

                for (const p of this.polyList) {
                    const { maxx, maxy, minx, miny } = p.bounds;
                    if (minx < xmin) { xmin = minx; }
                    if (maxx > xmax) { xmax = maxx; }
                    if (miny < ymin) { ymin = miny; }
                    if (maxy > ymax) { ymax = maxy; }
                }

                this._bounds = new Rectangle(xmin, ymin, xmax, ymax);
            }
        }

        return this._bounds;
    }

    public getInnerPolies(): Polygon[] {
        return this.polyList;
    }

    public getNumPoints(): number {
        return this.numPoints;
    }

    public get(index: number): Vertex {
        for (const p of this.polyList) {
            const n = p.getNumPoints();
            if (index < n) { return p.get(index); }
            index -= n;
        }
        throw new Error("Index out of bounds");
    }

    public *iterVertices(): IterableIterator<Vertex> {
        for (const p of this.polyList) {
            yield * (p as any).pointList;
        }
    }

    public getArea(): number {
        if (isNaN(this.area)) {
            this.area = this.polyList.reduce((a, n) => a + n.getArea(), 0);
        }
        return this.area;
    }

    public contains(p: ExternalVertex): 0 | 1 | -1;
    public contains(p: Polygon): 0 | 1 | -1;
    public contains(p: unknown): 0 | 1 | -1 {
        if (p instanceof Polygon) {
            let inside = 0;
            let outside = 0;
            for (const v of p.iterVertices()) {
                const contained = this.polyList.some(ipoly => ipoly.contains(v) !== Position.OUTSIDE);
                if (contained) { inside++; }
                else { outside++; }
            }
            if (inside > 0 && outside === 0) { return Position.INSIDE; }
            if (outside > 0 && inside === 0) { return Position.OUTSIDE; }
            return Position.BOUNDARY;
        }
        if (p instanceof Array) {
            p = { x: p[0], y: p[1] };
        }
        let inside = 0;
        let boundary = 0;
        for (const ipoly of this.polyList) {
            const pos = ipoly.contains(p as Vertex);
            if (pos === Position.INSIDE) { inside++; }
            else if (pos === Position.BOUNDARY) { boundary++; }
        }
        if (inside > 0) { return Position.INSIDE; }
        if (boundary > 0) { return Position.BOUNDARY; }
        return Position.OUTSIDE;
    }

    public explode(): Polygon[] {
        if (this.explosion) { return this.explosion; }
        const bounds: SimplePolygon[] = [];
        const holes = new Set<SimplePolygon>();

        for (const poly of this.polyList) {
            if (poly.isHole) { holes.add(poly); }
            else { bounds.push(poly); }
        }

        if (bounds.length === 1) {
            this.explosion = [this];
        } else {
            const result: Polygon[] = [];
            for (const b of bounds) {
                const components = [b];
                for (const h of holes) {
                    if (wn_poly(h.get(0), (b as any).pointList) === Position.INSIDE) {
                        components.push(h);
                        holes.delete(h);
                    }
                }
                if (components.length === 1) {
                    result.push(b);
                } else {
                    result.push(new MultiPolygon(components));
                }
            }

            this.explosion = result;
        }
        return this.explosion;
    }

    public [isContributing](polyIndex: number): boolean {
        return this.polyList[polyIndex][isContributing](0);
    }

    public [setContributing](polyIndex: number, contributes: boolean): void {
        this.polyList[polyIndex][setContributing](0, contributes);
    }

    public toVertices(): { bounds: Vertex[][], holes: Vertex[][] } {
        if (!this.json) {
            const bounds: Vertex[][] = [];
            const holes: Vertex[][] = [];

            for (const poly of this.polyList) {
                const { bounds: nb, holes: nh } = poly.toVertices();
                bounds.push(...nb);
                holes.push(...nh);
            }

            this.json = { bounds, holes };
        }
        return this.json;
    }

    public getHull(): Polygon {
        if (this.hull) { return this.hull; }
        const e = this.explode();
        if (e[0] === this) {
            this.hull = this.polyList[0].getHull();
        } else {
            const candidates = [];
            for (const p of this.polyList) {
                if (p.isHole) { continue; }
                for (const v of p.getHull().iterVertices()) {
                    candidates.push(v);
                }
            }
            
            this.hull = new SimplePolygon(convexHull(candidates), false);
        }
        return this.hull;
    }
}
