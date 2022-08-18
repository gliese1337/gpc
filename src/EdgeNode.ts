import { PolygonNode } from "./PolygonNode";
import { BundleState, Vertex } from "./util";

export class EdgeNode {
    public vertex: Vertex;                                     /* Piggy-backed contour vertex data  */
    public bot: Vertex = { x: NaN, y: NaN };                   /* Edge lower (x, y) coordinate      */
    public top: Vertex = { x: NaN, y: NaN };                   /* Edge upper (x, y) coordinate      */
    public xb: number = NaN;                                   /* Scanbeam bottom x coordinate      */
    public xt: number = NaN;                                   /* Scanbeam top x coordinate         */
    public dx: number = NaN;                                   /* Change in x for a unit y increase */
    public type: 0 | 1 = 0;                                    /* Clip / subject edge flag          */
    public bside: { clip: 0 | 1, subj: 0 | 1 };                /* Bundle left / right indicators    */
    public bundle: { above: number[], below: number[] };       /* Bundle edge flags                 */
    public bstate: { above: BundleState | null, below: BundleState | null }; /* Edge bundle state                 */
    public outp: { above: PolygonNode | null, below: PolygonNode | null };   /* Output polygon / tristrip pointer */
    public prev: EdgeNode | null = null;        /* Previous edge in the AET          */
    public next: EdgeNode | null = null;        /* Next edge in the AET              */
    public pred: EdgeNode | null = null;        /* Edge connected at the lower end   */
    public succ: EdgeNode | null = null;        /* Edge connected at the upper end   */
    public nextBound: EdgeNode | null = null;   /* Pointer to next bound in LMT      */

    constructor(x: number, y: number) {
        this.vertex = { x, y };
        this.bside = { clip: 0, subj: 0 };
        this.bundle = { above: [0, 0], below: [0, 0] };
        this.bstate = { above: null, below: null };
        this.outp = { above: null, below: null };
    }
}