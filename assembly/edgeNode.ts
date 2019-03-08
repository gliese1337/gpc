import { PolygonNode } from './polygonNode';
import { Vertex } from './vertex';

export const BUNDLE_NULL = 0;
export const UNBUNDLED = 1;
export const BUNDLE_HEAD = 2;
export const BUNDLE_TAIL = 3;

export class BundleSide {
    public clip: u32;
    public subj: u32;
}

class BundleEdgeFlags {
    above: u32[];
    below: u32[];
}

class BundleStates {
    above: u32;
    below: u32;
}

class EdgeOutput {
    above: PolygonNode | null;
    below: PolygonNode | null;
}

export class EdgeNode {
    public vertex: Vertex;                      /* Piggy-backed contour vertex data  */
    public bot: Vertex = new Vertex(NaN, NaN);  /* Edge lower (x, y) coordinate      */
    public top: Vertex = new Vertex(NaN, NaN);  /* Edge upper (x, y) coordinate      */
    public xb: f64 = NaN;                       /* Scanbeam bottom x coordinate      */
    public xt: f64 = NaN;                       /* Scanbeam top x coordinate         */
    public dx: f64 = NaN;                       /* Change in x for a unit y increase */
    public type: u32 = 0;                     /* Clip / subject edge flag          */
    public bside: BundleSide;                   /* Bundle left / right indicators    */
    public bundle: BundleEdgeFlags;             /* Bundle edge flags                 */
    public bstate: BundleStates;                /* Edge bundle state     */
    public outp: EdgeOutput;                    /* Output polygon pointer */
    public prev: EdgeNode | null = null;        /* Previous edge in the AET        */
    public next: EdgeNode | null = null;        /* Next edge in the AET            */
    public pred: EdgeNode | null = null;        /* Edge connected at the lower end */
    public succ: EdgeNode | null = null;        /* Edge connected at the upper end */
    public nextBound: EdgeNode | null = null;   /* Pointer to next bound in LMT    */

    constructor(x: f64, y: f64) {
        this.vertex = new Vertex(x, y);
        this.bside = { clip: 0, subj: 0 };
        this.bundle = { above: [0, 0], below: [0, 0] };
        this.bstate = { above: BUNDLE_NULL, below: BUNDLE_NULL };
        this.outp = { above: null, below: null };
    }
}