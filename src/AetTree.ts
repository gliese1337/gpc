import { EdgeNode } from "./EdgeNode";

export class AetTree {
    public top: EdgeNode | null = null;

    public addEdge(edge: EdgeNode): void {
        if (this.top === null) {
            /* Append edge onto the tail end of the AET */
            this.top = edge;
            edge.prev = null;
            edge.next = null;
    
            return;
        }
    
        let prevEdge: EdgeNode | null = null;
        let currentEdge = this.top;
        while (true) {
            /* Do primary sort on the xb field, and secondary sort on the dx field. */
            if (edge.xb < currentEdge.xb || (edge.xb === currentEdge.xb && edge.dx < currentEdge.dx)) {
                /* Insert edge here (before the AET edge) */
                edge.prev = prevEdge;
                edge.next = currentEdge;
                currentEdge.prev = edge;
                if (prevEdge === null) {
                    this.top = edge;
                } else {
                    prevEdge.next = edge;
                }
    
                return;
            }
    
            /* Head further into the AET */
            prevEdge = currentEdge;
            if (currentEdge.next === null) {
                currentEdge.next = edge;
                edge.prev = currentEdge;
                edge.next = null;
    
                return;
            } else {
                currentEdge = currentEdge.next;
            }
        }
    }    
}