import { AetTree } from "./AetTree";
import { EdgeNode } from "./EdgeNode";
import { IPolygon } from "./IPolygon";
import { LmtTable, buildLmt, LmtNode } from "./LmtTable";
import { TopPolygonNode, PolygonNode } from "./PolygonNode";
import { ScanBeamTreeEntries } from "./SBTree";
import { ItNodeTable } from "./StNode";
import { 
    OperationType, SUBJ, CLIP, RIGHT, LEFT,
    setContributing, EQ, BundleState, HState,
    getVertexType, VertexType, SimpleType, CompoundType,
} from "./util";

function miniMaxTest(subject: IPolygon, clipper: IPolygon, op: OperationType): void {
    const sBBoxes = subject.getInnerPolies().map((ip) => ip.bounds);
    const cBBoxes = clipper.getInnerPolies().map((ip) => ip.bounds);

    /* Check all subject contour bounding boxes against clip boxes */
    const oTable = cBBoxes.map((c) =>
        sBBoxes.map((s) =>
            !((s.maxx < c.minx) || (s.minx > c.maxx)) &&
            !((s.maxy < c.miny) || (s.miny > c.maxy)),
        ),
    );

    /* For each clip contour, search for any subject contour overlaps */
    const clipNumPoly = cBBoxes.length;
    for (let c = 0; c < clipNumPoly; c++) {
        const overlap = oTable[c].every((s) => s);
        if (!overlap) {
            clipper[setContributing](c, false); // Flag non contributing status
        }
    }

    if (op === OperationType.INT) {
        /* For each subject contour, search for any clip contour overlaps */
        const subjNumPoly = sBBoxes.length;
        for (let s = 0; s < subjNumPoly; s++) {
            const overlap = oTable.every((c) => c[s]);
            if (!overlap) {
                subject[setContributing](s, false); // Flag non contributing status
            }
        }
    }
}

export function clip<T,U>(op: OperationType, subject: IPolygon, clipper: IPolygon, Simple: SimpleType<T>, Compound: CompoundType<T,U>): T|U {
    const sEmpty = subject.isEmpty;
    const cEmpty = clipper.isEmpty;

    /* Test for trivial NULL result cases */
    if ((cEmpty && op === OperationType.INT) ||
        (sEmpty && (cEmpty || op === OperationType.INT || op === OperationType.DIF))
    ) {
        return new Simple([], false);
    }

    /* Identify potentialy contributing contours */
    if ((op === OperationType.INT || op === OperationType.DIF) && !(sEmpty || cEmpty)) {
        miniMaxTest(subject, clipper, op);
    }

    /* Build LMT */
    const lmtTable = new LmtTable();
    const sbte = new ScanBeamTreeEntries();

    if (!sEmpty) {
        buildLmt(lmtTable, sbte, subject, SUBJ, op);
    }

    if (!cEmpty) {
        buildLmt(lmtTable, sbte, clipper, CLIP, op);
    }

    /* Return a NULL result if no contours contribute */
    if (lmtTable.top === null) {
        return new Simple([], false);
    }

    const parity: { clip: 0 | 1, subj: 0 | 1 } = {
        /* Invert clip polygon for difference operation */
        clip: op === OperationType.DIF ? RIGHT : LEFT,
        subj: LEFT,
    };

    /* Build scanbeam table from scanbeam tree */
    const sbt = sbte.buildSBT();

    /* Used to create resulting Polygon */
    const outPoly = new TopPolygonNode(Simple, Compound);

    const aet = new AetTree();

    let scanbeam = 0;
    let localMin: LmtNode | null = lmtTable.top;

    /* Process each scanbeam */
    while (scanbeam < sbt.length) {
        /* Set yb and yt to the bottom and top of the scanbeam */
        const yb = sbt[scanbeam++];
        let yt = 0;
        let dy = 0;
        if (scanbeam < sbt.length) {
            yt = sbt[scanbeam];
            dy = yt - yb;
        }

        /* === SCANBEAM BOUNDARY PROCESSING ================================ */

        /* If LMT node corresponding to yb exists */
        if (localMin !== null) {
            if (localMin.y === yb) {
                /* Add edges starting at this local minimum to the AET */
                for (let edge = localMin.firstBound; edge !== null; edge = edge.nextBound) {
                    aet.addEdge(edge);
                }

                localMin = localMin.next;
            }
        }

        if (aet.top === null) throw new Error("Encountered Unexpected Null Edge");

        /* Create bundles within AET */
        let e0 = aet.top;
        let e1 = aet.top;

        /* Set up bundle fields of first edge */
        aet.top.bundle.above[aet.top.type] = (aet.top.top.y !== yb) ? 1 : 0;
        aet.top.bundle.above[1 - aet.top.type] = 0;
        aet.top.bstate.above = BundleState.UNBUNDLED;

        for (let nextEdge = aet.top.next; nextEdge !== null; nextEdge = nextEdge.next) {
            const nextType = nextEdge.type;
            const nextTypeOpposite = 1 - nextType;

            /* Set up bundle fields of next edge */
            nextEdge.bundle.above[nextType] = (nextEdge.top.y !== yb) ? 1 : 0;
            nextEdge.bundle.above[nextTypeOpposite] = 0;
            nextEdge.bstate.above = BundleState.UNBUNDLED;

            /* Bundle edges above the scanbeam boundary if they coincide */
            if (nextEdge.bundle.above[nextType] === 1) {
                if (EQ(e0.xb, nextEdge.xb) && EQ(e0.dx, nextEdge.dx) && (e0.top.y !== yb)) {
                    nextEdge.bundle.above[nextType] ^= e0.bundle.above[nextType];
                    nextEdge.bundle.above[nextTypeOpposite] = e0.bundle.above[nextTypeOpposite];
                    nextEdge.bstate.above = BundleState.BUNDLE_HEAD;
                    e0.bundle.above[CLIP] = 0;
                    e0.bundle.above[SUBJ] = 0;
                    e0.bstate.above = BundleState.BUNDLE_TAIL;
                }

                e0 = nextEdge;
            }
        }

        const horiz = { clip: HState.NH, subj: HState.NH };
        const exists = { clip: 0, subj: 0 };

        /* Set dummy previous x value */
        let px = -Number.MAX_VALUE;
        let cf: PolygonNode | null = null;

        /* Process each edge at this scanbeam boundary */
        for (let edge: EdgeNode | null = aet.top; edge !== null; edge = edge.next) {
            exists.clip = edge.bundle.above[CLIP] + (edge.bundle.below[CLIP] << 1);
            exists.subj = edge.bundle.above[SUBJ] + (edge.bundle.below[SUBJ] << 1);

            if ((exists.clip | exists.subj) === 0) {
                continue;
            }

            /* Set bundle side */
            edge.bside.clip = parity.clip;
            edge.bside.subj = parity.subj;

            let contributing = false;
            let br = 0;
            let bl = 0;
            let tr = 0;
            let tl = 0;

            /* Determine contributing status and quadrant occupancies */
            if ((op === OperationType.DIF) || (op === OperationType.INT)) {
                contributing = ((exists.clip !== 0) && ((parity.subj !== 0) || (horiz.subj !== 0))) ||
                    ((exists.subj !== 0) && ((parity.clip !== 0) || (horiz.clip !== 0))) ||
                    ((exists.clip !== 0) && (exists.subj !== 0) && (parity.clip === parity.subj));

                br = parity.clip & parity.subj;
                bl = (parity.clip ^ edge.bundle.above[CLIP]) & (parity.subj ^ edge.bundle.above[SUBJ]);
                tr = (parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0)) & (parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0));
                tl = (parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0) ^ edge.bundle.below[CLIP]) &
                    (parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0) ^ edge.bundle.below[SUBJ]);
            } else if (op === OperationType.XOR) {
                contributing = (exists.clip !== 0) || (exists.subj !== 0);

                br = parity.clip ^ parity.subj;
                bl = (parity.clip ^ edge.bundle.above[CLIP]) ^ (parity.subj ^ edge.bundle.above[SUBJ]);
                tr = parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0) ^ parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0);
                tl = parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0) ^ edge.bundle.below[CLIP]
                    ^ parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0) ^ edge.bundle.below[SUBJ];
            } else if (op === OperationType.ADD) {
                contributing = ((exists.clip !== 0) && (!(parity.subj !== 0) || (horiz.subj !== 0))) ||
                    ((exists.subj !== 0) && (!(parity.clip !== 0) || (horiz.clip !== 0))) ||
                    ((exists.clip !== 0) && (exists.subj !== 0) && (parity.clip === parity.subj));

                br = parity.clip | parity.subj;
                bl = (parity.clip ^ edge.bundle.above[CLIP]) | (parity.subj ^ edge.bundle.above[SUBJ]);
                tr = (parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0)) | (parity.subj ^ ((horiz.subj !== HState.NH) ? 1 : 0));
                tl = (parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0) ^ edge.bundle.below[CLIP]) |
                    (parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0) ^ edge.bundle.below[SUBJ]);
            }

            /* Update parity */
            parity.clip ^= edge.bundle.above[CLIP];
            parity.subj ^= edge.bundle.above[SUBJ];

            /* Update horizontal state */
            if (exists.clip !== 0) {
                horiz.clip = HState.nextState[horiz.clip][((exists.clip - 1) << 1) + parity.clip];
            }
            if (exists.subj !== 0) {
                horiz.subj = HState.nextState[horiz.subj][((exists.subj - 1) << 1) + parity.subj];
            }

            if (!contributing) {
                continue;
            }

            const { xb } = edge;

            switch (getVertexType(tr, tl, br, bl)) {
                case VertexType.EMN:
                case VertexType.IMN:
                    cf = outPoly.addLocalMin(xb, yb);
                    px = xb;
                    edge.outp.above = cf;
                    break;
                case VertexType.ERI:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    edge.outp.above = cf;
                    cf = null;
                    break;
                case VertexType.ELI:
                    cf = edge.outp.below;
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    cf.addLeft(xb, yb);
                    px = xb;
                    break;
                case VertexType.EMX:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeRight(cf, edge.outp.below);
                    cf = null;
                    break;
                case VertexType.ILI:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    edge.outp.above = cf;
                    cf = null;
                    break;
                case VertexType.IRI:
                    cf = edge.outp.below;
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    cf.addRight(xb, yb);
                    px = xb;
                    edge.outp.below = null;
                    break;
                case VertexType.IMX:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeLeft(cf, edge.outp.below);
                    cf = null;
                    edge.outp.below = null;
                    break;
                case VertexType.IMM:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeLeft(cf, edge.outp.below);
                    edge.outp.below = null;
                    cf = outPoly.addLocalMin(xb, yb);
                    edge.outp.above = cf;
                    break;
                case VertexType.EMM:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeRight(cf, edge.outp.below);
                    edge.outp.below = null;
                    cf = outPoly.addLocalMin(xb, yb);
                    edge.outp.above = cf;
                    break;
                case VertexType.LED:
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (edge.bot.y === yb) {
                        edge.outp.below.addLeft(xb, yb);
                    }
                    edge.outp.above = edge.outp.below;
                    px = xb;
                    break;
                case VertexType.RED:
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (edge.bot.y === yb) {
                        edge.outp.below.addRight(xb, yb);
                    }
                    edge.outp.above = edge.outp.below;
                    px = xb;
                    break;
                default:
            }
        }

        /* Delete terminating edges from the AET, otherwise compute xt */
        for (let edge: EdgeNode | null = aet.top; edge !== null; edge = edge.next) {
            if (edge.top.y === yb) {
                const { prev, next } = edge;

                if (prev === null) {
                    aet.top = next;
                } else {
                    prev.next = next;
                }

                if (next !== null) {
                    next.prev = prev;
                }

                /* Copy bundle head state to the adjacent tail edge if required */
                if ((edge.bstate.below === BundleState.BUNDLE_HEAD) && (prev !== null)) {
                    if (prev.bstate.below === BundleState.BUNDLE_TAIL) {
                        prev.outp.below = edge.outp.below;
                        prev.bstate.below = BundleState.UNBUNDLED;
                        if (prev.prev !== null) {
                            if (prev.prev.bstate.below === BundleState.BUNDLE_TAIL) {
                                prev.bstate.below = BundleState.BUNDLE_HEAD;
                            }
                        }
                    }
                }
            } else {
                edge.xt = edge.top.y === yt ?
                    edge.top.x : (edge.bot.x + edge.dx * (yt - edge.bot.y));
            }
        }

        if (scanbeam >= sbte.sbtEntries) {
            continue;
        }

        /* === SCANBEAM INTERIOR PROCESSING ============================== */

        /* Build intersection table for the current scanbeam */
        const itTable = new ItNodeTable();
        itTable.buildIntersectionTable(aet, dy);

        /* Process each node in the intersection table */
        for (let intersect = itTable.top; intersect !== null; intersect = intersect.next) {

            [e0, e1] = intersect.ie;

            /* Only generate output for contributing intersections */
            if (((e0.bundle.above[CLIP] !== 0) || (e0.bundle.above[SUBJ] !== 0)) &&
                ((e1.bundle.above[CLIP] !== 0) || (e1.bundle.above[SUBJ] !== 0))) {
                const p = e0.outp.above;
                const q = e1.outp.above;
                const ix = intersect.point.x;
                const iy = intersect.point.y + yb;

                const inClip = (((e0.bundle.above[CLIP] !== 0) && (e0.bside.clip === 0)) ||
                    ((e1.bundle.above[CLIP] !== 0) && (e1.bside.clip !== 0)) ||
                    ((e0.bundle.above[CLIP] === 0) && (e1.bundle.above[CLIP] === 0) &&
                    ((e0.bside.clip & e1.bside.clip) === 1))) ? 1 : 0;

                const inSubj = (((e0.bundle.above[SUBJ] !== 0) && (e0.bside.subj === 0)) ||
                    ((e1.bundle.above[SUBJ] !== 0) && (e1.bside.subj !== 0)) ||
                    ((e0.bundle.above[SUBJ] === 0) && (e1.bundle.above[SUBJ] === 0) &&
                    ((e0.bside.subj & e1.bside.subj) === 1))) ? 1 : 0;

                let tr = 0;
                let tl = 0;
                let br = 0;
                let bl = 0;

                /* Determine quadrant occupancies */
                if ((op === OperationType.DIF) || (op === OperationType.INT)) {
                    tr = inClip & inSubj;
                    tl = (inClip ^ e1.bundle.above[CLIP]) & (inSubj ^ e1.bundle.above[SUBJ]);
                    br = (inClip ^ e0.bundle.above[CLIP]) & (inSubj ^ e0.bundle.above[SUBJ]);
                    bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP]) & (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
                } else if (op === OperationType.XOR) {
                    tr = inClip ^ inSubj;
                    tl = (inClip ^ e1.bundle.above[CLIP]) ^ (inSubj ^ e1.bundle.above[SUBJ]);
                    br = (inClip ^ e0.bundle.above[CLIP]) ^ (inSubj ^ e0.bundle.above[SUBJ]);
                    bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP])
                        ^ (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
                } else if (op === OperationType.ADD) {
                    tr = inClip | inSubj;
                    tl = (inClip ^ e1.bundle.above[CLIP]) | (inSubj ^ e1.bundle.above[SUBJ]);
                    br = (inClip ^ e0.bundle.above[CLIP]) | (inSubj ^ e0.bundle.above[SUBJ]);
                    bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP]) | (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
                }

                switch (getVertexType(tr, tl, br, bl)) {
                    case VertexType.EMN:
                        e0.outp.above = outPoly.addLocalMin(ix, iy);
                        e1.outp.above = e0.outp.above;
                        break;
                    case VertexType.ERI:
                        if (p !== null) {
                            p.addRight(ix, iy);
                            e1.outp.above = p;
                            e0.outp.above = null;
                        }
                        break;
                    case VertexType.ELI:
                        if (q !== null) {
                            q.addLeft(ix, iy);
                            e0.outp.above = q;
                            e1.outp.above = null;
                        }
                        break;
                    case VertexType.EMX:
                        if ((p !== null) && (q !== null)) {
                            p.addLeft(ix, iy);
                            outPoly.mergeRight(p, q);
                            e0.outp.above = null;
                            e1.outp.above = null;
                        }
                        break;
                    case VertexType.IMN:
                        e0.outp.above = outPoly.addLocalMin(ix, iy);
                        e1.outp.above = e0.outp.above;
                        break;
                    case VertexType.ILI:
                        if (p !== null) {
                            p.addLeft(ix, iy);
                            e1.outp.above = p;
                            e0.outp.above = null;
                        }
                        break;
                    case VertexType.IRI:
                        if (q !== null) {
                            q.addRight(ix, iy);
                            e0.outp.above = q;
                            e1.outp.above = null;
                        }
                        break;
                    case VertexType.IMX:
                        if ((p !== null) && (q !== null)) {
                            p.addRight(ix, iy);
                            outPoly.mergeLeft(p, q);
                            e0.outp.above = null;
                            e1.outp.above = null;
                        }
                        break;
                    case VertexType.IMM:
                        if ((p !== null) && (q !== null)) {
                            p.addRight(ix, iy);
                            outPoly.mergeLeft(p, q);
                            e0.outp.above = outPoly.addLocalMin(ix, iy);
                            e1.outp.above = e0.outp.above;
                        }
                        break;
                    case VertexType.EMM:
                        if ((p !== null) && (q !== null)) {
                            p.addLeft(ix, iy);
                            outPoly.mergeRight(p, q);
                            e0.outp.above = outPoly.addLocalMin(ix, iy);
                            e1.outp.above = e0.outp.above;
                        }
                        break;
                    default:
                }
            }

            /* Swap bundle sides in response to edge crossing */
            if (e0.bundle.above[CLIP] !== 0) {
                e1.bside.clip = 1 - e1.bside.clip as 0 | 1;
            }
            if (e1.bundle.above[CLIP] !== 0) {
                e0.bside.clip = 1 - e0.bside.clip as 0 | 1;
            }
            if (e0.bundle.above[SUBJ] !== 0) {
                e1.bside.subj = 1 - e1.bside.subj as 0 | 1;
            }
            if (e1.bundle.above[SUBJ] !== 0) {
                e0.bside.subj = 1 - e0.bside.subj as 0 | 1;
            }

            /* Swap e0 and e1 bundles in the AET */
            let { prev } = e0;
            const { next } = e1;
            if (next !== null) {
                next.prev = e0;
            }

            if (e0.bstate.above === BundleState.BUNDLE_HEAD) {
                while (prev !== null && prev.bstate.above === BundleState.BUNDLE_TAIL) {
                    prev = prev.prev;
                }
            }

            if (aet.top === null) throw new Error("Encountered Unexpected Null Edge");

            if (prev === null) {
                aet.top.prev = e1;
                e1.next = aet.top;
                aet.top = e0.next;
            } else {
                if (prev.next === null) throw new Error("Encountered Unexpected Null Edge");
                prev.next.prev = e1;
                e1.next = prev.next;
                prev.next = e0.next;
            }

            
            if (e0.next === null) throw new Error("Encountered Unexpected Null Edge");
            e0.next.prev = prev;
            e1.next.prev = e1;
            e0.next = next;
        }

        /* Prepare for next scanbeam */
        for (let edge = aet.top; edge !== null; edge = edge.next) {
            const { next, succ } = edge;
            if ((edge.top.y === yt) && (succ !== null)) {
                /* Replace AET edge by its successor */
                succ.outp.below = edge.outp.above;
                succ.bstate.below = edge.bstate.above;
                succ.bundle.below[CLIP] = edge.bundle.above[CLIP];
                succ.bundle.below[SUBJ] = edge.bundle.above[SUBJ];

                const { prev } = edge;
                if (prev !== null) {
                    prev.next = succ;
                } else {
                    aet.top = succ;
                }

                if (next !== null) {
                    next.prev = succ;
                }

                succ.prev = prev;
                succ.next = next;

            } else {
                /* Update this edge */
                edge.outp.below = edge.outp.above;
                edge.bstate.below = edge.bstate.above;
                edge.bundle.below[CLIP] = edge.bundle.above[CLIP];
                edge.bundle.below[SUBJ] = edge.bundle.above[SUBJ];
                edge.xb = edge.xt;
            }

            edge.outp.above = null;
        }
    }

    return outPoly.getResult();
}
