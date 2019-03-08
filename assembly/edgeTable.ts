import { EdgeNode } from './edgeNode';
import { NEXT_INDEX, PREV_INDEX } from './util';

export class EdgeTable {
    private nodeList: EdgeNode[] = [];

    public addNode(x: f64, y: f64): void {
        this.nodeList.push(new EdgeNode(x, y));
    }

    public getNode(index: u32): EdgeNode {
        return this.nodeList[index];
    }

    public FWD_MIN(i: u32): bool {
        let nodeList = this.nodeList;

        let prev = nodeList[PREV_INDEX(i, nodeList.length)];
        let next = nodeList[NEXT_INDEX(i, nodeList.length)];
        let ith = nodeList[i];

        return ((prev.vertex.y >= ith.vertex.y) &&
            (next.vertex.y > ith.vertex.y));
    }

    public NOT_FMAX(i: u32): bool {
        let nodeList = this.nodeList;

        let next = nodeList[NEXT_INDEX(i, nodeList.length)];
        let ith = nodeList[i];

        return next.vertex.y > ith.vertex.y;
    }

    public REV_MIN(i: u32): bool {
        let nodeList = this.nodeList;

        let prev = nodeList[PREV_INDEX(i, nodeList.length)];
        let next = nodeList[NEXT_INDEX(i, nodeList.length)];
        let ith = nodeList[i];

        return ((prev.vertex.y > ith.vertex.y) && (next.vertex.y >= ith.vertex.y));
    }

    public NOT_RMAX(i: u32): bool {
        let nodeList = this.nodeList;

        let prev = nodeList[PREV_INDEX(i, nodeList.length)];
        let ith = nodeList[i];

        return prev.vertex.y > ith.vertex.y;
    }
}