import { ScanBeamTreeEntries } from './sbt';
import { EdgeNode, UNBUNDLED } from './edgeNode';
import { PolygonNode, TopPolygonNode } from './polygonNode';
import { Polygon } from './polygon';
import { AetTree } from './aet';
import { EdgeTable } from './edgeTable';
import { ItNodeTable } from './itTable';
import * as VertexType from './vertexType';
import { LmtTable } from './lmtTable';
import { Rectangle } from './rectangle';
import { SUBJ, CLIP, RIGHT, LEFT, INT, DIF, ADD, XOR } from './constants';
import { NEXT_INDEX, PREV_INDEX } from './util';

const NH: u32 = 0; /* No horizontal edge                */
const BH: u32 = 1; /* Bottom horizontal edge            */
const TH: u32 = 2; /* Top horizontal edge               */

/* Horizontal edge state transitions within scanbeam boundary */
    /*      ABOVE   BELOW   CROSS  */
    /*     L   R    L   R   L   R  */
    /* NH [BH, TH, TH, BH, NH, NH] */
    /* BH [NH, NH, NH, NH, TH, TH] */
    /* TH [NH, NH, NH, NH, BH, BH] */

function transition(row: u32, col: u32): u32 {
    switch ((row << 3) | col) {
        // row = NH
        case 0: case 3: return BH;
        case 1: case 2: return TH;
        case 4: case 5: return NH;
        // row = BH
        case 8: case 9: case 10: case 11: return NH;
        case 12: case 13: return TH;
        // row = TH
        case 16: case 17: case 18: case 19: return NH;
        case 20: case 21: return BH;
    }

    return 0;
}

export function clip(op: u32, subject: Polygon, clipper: Polygon): Polygon {
    let sEmpty = subject.isEmpty;
    let cEmpty = clipper.isEmpty;

    /* Test for trivial cases */
    if (cEmpty) {
        return op === INT ? clipper : subject;
    }

    if (sEmpty) {
        switch(op) {
            case INT: case DIF: return subject;
            case ADD: case XOR: return clipper;
        }
    }

    /* Identify potentialy contributing contours */
    if (op === INT || op === DIF) {
        miniMaxTest(subject, clipper, op);
    }

    /* Build LMT */
    let lmtTable = new LmtTable();
    let sbte = new ScanBeamTreeEntries();

    if (!sEmpty) {
        buildLmt(lmtTable, sbte, subject, SUBJ, op);
    }

    if (!cEmpty) {
        buildLmt(lmtTable, sbte, clipper, CLIP, op);
    }

    /* Return a NULL result if no contours contribute */
    if (lmtTable.top === null) {
        return new Polygon(null, null);
    }

    return process_scanbeams(op, lmtTable, sbte).getResult();
}

function process_scanbeams(op: u32, lmtTable: LmtTable, sbte: ScanBeamTreeEntries): TopPolygonNode {
    let sbt = sbte.buildSBT();

    let outPoly = new TopPolygonNode();
    if (sbt.length === 0) return outPoly;

    let aet = new AetTree();

    /* Invert clip polygon for difference operation */
    let parity_clip = op === DIF ? RIGHT : LEFT;
    let parity_subj = LEFT;

    let scanbeam: u32 = 0;
    let localMin = lmtTable.top;

    /* Process each scanbeam */
    while (true) {
        /* Set yb and yt to the bottom and top of the scanbeam */
        let yb = sbt[scanbeam++];
        let yt: f64 = 0;
        let dy: f64 = 0;
        if (scanbeam < <u32>sbt.length) {
            yt = sbt[scanbeam];
            dy = yt - yb;
        }

        /* === SCANBEAM BOUNDARY PROCESSING ================================ */

        /* If LMT node corresponding to yb exists */
        if (localMin !== null) {
            if (localMin.y === yb) {
                /* Add edges starting at this local minimum to the AET */
                for (let edge = localMin.firstBound; edge !== null; edge = edge.nextBound) {
                    aet.addEdge(edge as EdgeNode);
                }

                localMin = localMin.next;
            }
        }

        /* Create bundles within AET */
        let e1 = aet.top;
        let e0 = aet.createBundles(yb);

        let horiz_clip = NH;
        let horiz_subj = NH;
        let exists_clip = 0;
        let exists_subj = 0;

        /* Set dummy previous x value */
        let px = -Infinity;
        let cf: PolygonNode | null = null;

        /* Process each edge at this scanbeam boundary */
        for (let edge: EdgeNode | null = aet.top; edge !== null; edge = edge.next) {
            exists_clip = edge.bundle.above[CLIP] + (edge.bundle.below[CLIP] << 1);
            exists_subj = edge.bundle.above[SUBJ] + (edge.bundle.below[SUBJ] << 1);

            if ((exists_clip | exists_subj) === 0) {
                continue;
            }

            /* Set bundle side */
            edge.bside_clip = parity_clip;
            edge.bside_subj = parity_subj;

            let contributing = false;
            let br = 0;
            let bl = 0;
            let tr = 0;
            let tl = 0;

            /* Determine contributing status and quadrant occupancies */
            if ((op === DIF) || (op === INT)) {
                contributing = ((exists_clip!== 0) && ((parity_subj !== 0) || (horiz_subj !== 0))) ||
                    ((exists_subj !== 0) && ((parity_clip !== 0) || (horiz_clip !== 0))) ||
                    ((exists_clip !== 0) && (exists_subj !== 0) && (parity_clip === parity_subj));

                br = parity_clip & parity_subj;
                bl = (parity_clip ^ edge.bundle.above[CLIP]) & (parity_subj ^ edge.bundle.above[SUBJ]);
                tr = (parity_clip ^ (horiz_clip !== NH ? 1 : 0)) & (parity_subj ^ (horiz_subj !== NH ? 1 : 0));
                tl = (parity_clip ^ (horiz_clip !== NH ? 1 : 0) ^ edge.bundle.below[CLIP]) &
                    (parity_subj ^ (horiz_subj !== NH ? 1 : 0) ^ edge.bundle.below[SUBJ]);
            } else if (op === XOR) {
                contributing = (exists_clip !== 0) || (exists_subj !== 0);

                br = parity_clip ^ parity_subj;
                bl = (parity_clip ^ edge.bundle.above[CLIP]) ^ (parity_subj ^ edge.bundle.above[SUBJ]);
                tr = parity_clip ^ (horiz_clip !== NH ? 1 : 0) ^ parity_subj ^ (horiz_subj !== NH ? 1 : 0);
                tl = parity_clip ^ (horiz_clip !== NH ? 1 : 0) ^ edge.bundle.below[CLIP]
                    ^ parity_subj ^ (horiz_subj !== NH ? 1 : 0) ^ edge.bundle.below[SUBJ];
            } else if (op === ADD) {
                contributing = ((exists_clip !== 0) && (!(parity_subj !== 0) || (horiz_subj !== 0))) ||
                    ((exists_subj !== 0) && (!(parity_clip !== 0) || (horiz_clip !== 0))) ||
                    ((exists_clip !== 0) && (exists_subj !== 0) && (parity_clip === parity_subj));

                br = parity_clip | parity_subj;
                bl = (parity_clip ^ edge.bundle.above[CLIP]) | (parity_subj ^ edge.bundle.above[SUBJ]);
                tr = (parity_clip ^ (horiz_clip !== NH ? 1 : 0)) | (parity_subj ^ ((horiz_subj !== NH) ? 1 : 0));
                tl = (parity_clip ^ (horiz_clip !== NH ? 1 : 0) ^ edge.bundle.below[CLIP]) |
                    (parity_subj ^ (horiz_subj !== NH ? 1 : 0) ^ edge.bundle.below[SUBJ]);
            }

            /* Update parity */
            parity_clip ^= edge.bundle.above[CLIP];
            parity_subj ^= edge.bundle.above[SUBJ];

            /* Update horizontal state */
            if (exists_clip !== 0) {
                horiz_clip = transition(horiz_clip, ((exists_clip - 1) << 1) + parity_clip);
            }
            if (exists_subj !== 0) {
                horiz_subj = transition(horiz_subj, ((exists_subj - 1) << 1) + parity_subj);
            }

            if (!contributing) {
                continue;
            }

            let xb = edge.xb;

            switch (VertexType.getVertexType(tr, tl, br, bl)) {
                case VertexType.EMN:
                case VertexType.IMN:
                    cf = outPoly.addLocalMin(xb, yb);
                    px = xb;
                    edge.outp_above = cf;
                    break;
                case VertexType.ERI:
                    //if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    edge.outp_above = cf;
                    cf = null;
                    break;
                case VertexType.ELI:
                    cf = edge.outp_below;
                    //if (cf === null) throw new Error("Unexpected Null Polygon");
                    cf.addLeft(xb, yb);
                    px = xb;
                    break;
                case VertexType.EMX:
                    //if (cf === null) throw new Error("Unexpected Null Polygon");
                    //if (edge.outp_below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeRight(cf as PolygonNode, edge.outp_below as PolygonNode);
                    cf = null;
                    break;
                case VertexType.ILI:
                    //if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    edge.outp_above = cf;
                    cf = null;
                    break;
                case VertexType.IRI:
                    cf = edge.outp_below;
                    //if (cf === null) throw new Error("Unexpected Null Polygon");
                    cf.addRight(xb, yb);
                    px = xb;
                    edge.outp_below = null;
                    break;
                case VertexType.IMX:
                    //if (cf === null) throw new Error("Unexpected Null Polygon");
                    //if (edge.outp_below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeLeft(cf as PolygonNode, edge.outp_below as PolygonNode);
                    cf = null;
                    edge.outp_below = null;
                    break;
                case VertexType.IMM:
                    //if (cf === null) throw new Error("Unexpected Null Polygon");
                    //if (edge.outp_below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeLeft(cf as PolygonNode, edge.outp_below as PolygonNode);
                    edge.outp_below = null;
                    cf = outPoly.addLocalMin(xb, yb);
                    edge.outp_above = cf;
                    break;
                case VertexType.EMM:
                    //if (cf === null) throw new Error("Unexpected Null Polygon");
                    //if (edge.outp_below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeRight(cf as PolygonNode, edge.outp_below as PolygonNode);
                    edge.outp_below = null;
                    cf = outPoly.addLocalMin(xb, yb);
                    edge.outp_above = cf;
                    break;
                case VertexType.LED:
                    //if (edge.outp_below === null) throw new Error("Unexpected Null Polygon");
                    if (edge.bot.y === yb) {
                        edge.outp_below.addLeft(xb, yb);
                    }
                    edge.outp_above = edge.outp_below;
                    px = xb;
                    break;
                case VertexType.RED:
                    //if (edge.outp_below === null) throw new Error("Unexpected Null Polygon");
                    if (edge.bot.y === yb) {
                        edge.outp_below.addRight(xb, yb);
                    }
                    edge.outp_above = edge.outp_below;
                    px = xb;
                    break;
                default:
            }
        }

        aet.prune(yt, yb);

        if (scanbeam >= sbte.sbtEntries) {
            continue;
        }

        /* === SCANBEAM INTERIOR PROCESSING ============================== */

        /* Build intersection table for the current scanbeam */
        let itTable = new ItNodeTable(aet, dy);

        /* Process each node in the intersection table */
        for (let intersect = itTable.top; intersect !== null; intersect = intersect.next) {

            e0 = intersect.ie[0];
            e1 = intersect.ie[1];

            /* Only generate output for contributing intersections */
            if (((e0.bundle.above[CLIP] !== 0) || (e0.bundle.above[SUBJ] !== 0)) &&
                ((e1.bundle.above[CLIP] !== 0) || (e1.bundle.above[SUBJ] !== 0))) {

                let p = e0.outp_above;
                let q = e1.outp_above;
                let ix = intersect.point.x;
                let iy = intersect.point.y + yb;

                switch (itTable.analyzeIntersection(op, e0, e1 as EdgeNode)) {
                    case VertexType.EMN:
                        e0.outp_above = outPoly.addLocalMin(ix, iy);
                        e1.outp_above = e0.outp_above;
                        break;
                    case VertexType.ERI:
                        if (p !== null) {
                            p.addRight(ix, iy);
                            e1.outp_above = p;
                            e0.outp_above = null;
                        }
                        break;
                    case VertexType.ELI:
                        if (q !== null) {
                            q.addLeft(ix, iy);
                            e0.outp_above = q;
                            e1.outp_above = null;
                        }
                        break;
                    case VertexType.EMX:
                        if ((p !== null) && (q !== null)) {
                            p.addLeft(ix, iy);
                            outPoly.mergeRight(p as PolygonNode, q as PolygonNode);
                            e0.outp_above = null;
                            e1.outp_above = null;
                        }
                        break;
                    case VertexType.IMN:
                        e0.outp_above = outPoly.addLocalMin(ix, iy);
                        e1.outp_above = e0.outp_above;
                        break;
                    case VertexType.ILI:
                        if (p !== null) {
                            p.addLeft(ix, iy);
                            e1.outp_above = p;
                            e0.outp_above = null;
                        }
                        break;
                    case VertexType.IRI:
                        if (q !== null) {
                            q.addRight(ix, iy);
                            e0.outp_above = q;
                            e1.outp_above = null;
                        }
                        break;
                    case VertexType.IMX:
                        if ((p !== null) && (q !== null)) {
                            p.addRight(ix, iy);
                            outPoly.mergeLeft(p as PolygonNode, q as PolygonNode);
                            e0.outp_above = null;
                            e1.outp_above = null;
                        }
                        break;
                    case VertexType.IMM:
                        if ((p !== null) && (q !== null)) {
                            p.addRight(ix, iy);
                            outPoly.mergeLeft(p as PolygonNode, q as PolygonNode);
                            e0.outp_above = outPoly.addLocalMin(ix, iy);
                            e1.outp_above = e0.outp_above;
                        }
                        break;
                    case VertexType.EMM:
                        if ((p !== null) && (q !== null)) {
                            p.addLeft(ix, iy);
                            outPoly.mergeRight(p as PolygonNode, q as PolygonNode);
                            e0.outp_above = outPoly.addLocalMin(ix, iy);
                            e1.outp_above = e0.outp_above;
                        }
                        break;
                    default:
                }
            }

            aet.swapBundles(e0, e1 as EdgeNode);
        }

        if (scanbeam >= <u32>sbt.length) break;

        aet.prepare(yt);
    }

    return outPoly;
}

function innerBounds(contours: f64[][]): Rectangle[] {
    let polylen = contours.length;
    let bounds: Rectangle[] = new Array(polylen);
        
    for (let i = 0; i < polylen; i++) {
        let poly = contours[i];
        let pointlen = poly.length;
            
        let xmin = Infinity;
        let ymin = Infinity;
        let xmax = -Infinity;
        let ymax = -Infinity;

        for (let j = 0; j < pointlen; j+=2) {
            let x = poly[j];
            let y = poly[j+1];
            if (x < xmin) { xmin = x; }
            if (x > xmax) { xmax = x; }
            if (y < ymin) { ymin = y; }
            if (y > ymax) { ymax = y; }
        }
        
        bounds[i] = new Rectangle(xmin, ymin, xmax, ymax);
    }

    return bounds;
}

function miniMaxTest(subject: Polygon, clipper: Polygon, op: u32): void {
    let sContrib = subject.contributing as bool[];
    let cContrib = clipper.contributing as bool[];

    let sBBoxes = innerBounds(subject.contours as f64[][]);
    let cBBoxes = innerBounds(clipper.contours as f64[][]);
    
    let slen = sBBoxes.length;
    let clen = cBBoxes.length;

    /* Check all subject contour bounding boxes against clip boxes */
    let oTable: bool[][] = new Array(clen);
    for (let i = 0; i < clen; i++) {
        let c = cBBoxes[i];
        let minx = c.minx;
        let maxx = c.maxx;
        let miny = c.miny;
        let maxy = c.maxy;
        let row: bool[] = new Array(slen);
        oTable[i] = row;
        for (let j = 0; j < slen; j++) {
            let s = sBBoxes[j];
            row[j] = !((s.maxx < minx) || (s.minx > maxx)) &&
                     !((s.maxy < miny) || (s.miny > maxy))
        }
    }

    /* For each clip contour, search for any subject contour overlaps */
    for (let c = 0; c < clen; c++) {
        cContrib[c] = oTable[c].every((s) => s);
    }

    if (op === INT) {
        /* For each subject contour, search for any clip contour overlaps */
        for (let s = 0; s < slen; s++) {
            let overlap = true;
            for(let c = 0; c < clen; c++) {
                if(!oTable[c][s]) {
                    overlap = false;
                    break;
                }
            }

            sContrib[s] = overlap;
        }
    }
}

function contourPass(
    edgeTable: EdgeTable, lmtTable: LmtTable,
    vertexCount: u32, eIndex: u32, type: u32,
    op: u32, fwd: bool
): u32 {
    let next = fwd ? NEXT_INDEX : PREV_INDEX;
    for (let min: u32 = 0; min < vertexCount; min++) {
        /* If a forward local minimum... */
        if (fwd ? edgeTable.FWD_MIN(min) : edgeTable.REV_MIN(min)) {
            /* Search for the next local maximum... */
            let edgeCount = 1;
            let max = next(min, vertexCount);
            while (fwd ? edgeTable.NOT_FMAX(max) : edgeTable.NOT_RMAX(max)) {
                edgeCount++;
                max = next(max, vertexCount);
            }

            /* Build the next edge list */
            let v = min;
            let e = edgeTable.getNode(eIndex);
            e.bstate_below = UNBUNDLED;
            e.bundle.below[CLIP] = 0;
            e.bundle.below[SUBJ] = 0;

            for (let i = 0; i < edgeCount; i++) {
                let ei = edgeTable.getNode(eIndex + i);
                let ev = edgeTable.getNode(v);

                ei.xb = ev.vertex.x;
                ei.bot.x = ev.vertex.x;
                ei.bot.y = ev.vertex.y;

                v = next(v, vertexCount);
                ev = edgeTable.getNode(v);

                ei.top.x = ev.vertex.x;
                ei.top.y = ev.vertex.y;
                ei.dx = (ev.vertex.x - ei.bot.x) / (ei.top.y - ei.bot.y);
                ei.type = type;
                ei.outp_above = null;
                ei.outp_below = null;
                ei.next = null;
                ei.prev = null;
                ei.succ = ((edgeCount > 1) && (i < (edgeCount - 1))) ? edgeTable.getNode(eIndex + i + 1) : null;
                ei.pred = ((edgeCount > 1) && (i > 0)) ? edgeTable.getNode(eIndex + i - 1) : null;
                ei.nextBound = null;
                ei.bside_clip = (op === DIF) ? RIGHT : LEFT;
                ei.bside_subj = LEFT;
            }

            lmtTable.insertBound(edgeTable.getNode(min).vertex.y, e);

            eIndex += edgeCount;
        }
    }

    return eIndex;
}

function OPTIMAL(p: f64[], i: u32): bool {
    let yi = p[i];
    let n = p.length;

    return (p[(i - 2 + n) % n] !== yi) ||
        (p[(i + 2) % n] !== yi);
}

function buildLmt(
    lmtTable: LmtTable,
    sbte: ScanBeamTreeEntries,
    p: Polygon,
    type: u32, // poly type SUBJ/CLIP
    op: u32,
): void {
    /* Create the entire input polygon edge table in one go */
    let innerPolies = p.contours as f64[][];
    let contributing = p.contributing as bool[]
    let iplen = innerPolies.length;
    for (let i = 0; i< iplen; i++) {
        if (!contributing[i]) {
            /* Ignore the non-contributing contour */
            contributing[i] = true;
        } else {
            let ip = innerPolies[i];

            /* Perform contour optimisation */
            let vertexCount = 0;
            let edgeTable = new EdgeTable();
            let pointLen = ip.length;
            for (let j = 1; j < pointLen; j+=2) {
                if (OPTIMAL(ip, j)) {
                    let y = ip[j];
                    edgeTable.addNode(ip[j-1], y);

                    /* Record vertex in the scanbeam table */
                    sbte.addToSBTree(y);

                    vertexCount++;
                }
            }

            /* Do the contour forward pass */
            let eIndex = contourPass(edgeTable, lmtTable, vertexCount, 0, type, op, true);

            /* Do the contour reverse pass */
            contourPass(edgeTable, lmtTable, vertexCount, eIndex, type, op, false);
        }
    }
}