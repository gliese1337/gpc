import { EdgeNode } from "./EdgeNode";
import { PREV_INDEX, NEXT_INDEX } from "./util";

export class EdgeTable {
    private nodeList: EdgeNode[] = [];

    public addNode(x: number, y: number): void {
        this.nodeList.push(new EdgeNode(x, y));
    }

    public getNode(index: number): EdgeNode {
        return this.nodeList[index];
    }

    public FWD_MIN(i: number): boolean {
        const nodeList = this.nodeList;

        const prev = nodeList[PREV_INDEX(i, nodeList.length)];
        const next = nodeList[NEXT_INDEX(i, nodeList.length)];
        const ith = nodeList[i];

        return ((prev.vertex.y >= ith.vertex.y) &&
            (next.vertex.y > ith.vertex.y));
    }

    public NOT_FMAX(i: number): boolean {
        const nodeList = this.nodeList;

        const next = nodeList[NEXT_INDEX(i, nodeList.length)];
        const ith = nodeList[i];

        return next.vertex.y > ith.vertex.y;
    }

    public REV_MIN(i: number): boolean {
        const nodeList = this.nodeList;

        const prev = nodeList[PREV_INDEX(i, nodeList.length)];
        const next = nodeList[NEXT_INDEX(i, nodeList.length)];
        const ith = nodeList[i];

        return ((prev.vertex.y > ith.vertex.y) && (next.vertex.y >= ith.vertex.y));
    }

    public NOT_RMAX(i: number): boolean {
        const nodeList = this.nodeList;

        const prev = nodeList[PREV_INDEX(i, nodeList.length)];
        const ith = nodeList[i];

        return prev.vertex.y > ith.vertex.y;
    }
}