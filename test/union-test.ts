import 'mocha';
import { expect } from 'chai';

import { pointUp, pointDn, small } from './vertices';
import { Polygon } from '../src/gpc';

describe("Test unions", () => {
  const up = Polygon.fromPoints(pointUp);
  const dn = Polygon.fromPoints(pointDn);
  const sm = Polygon.fromPoints(small);

  it("should produce a six-point star", () => { 
    const p1 = up.union(dn);
    expect(p1.getNumPoints()).eql(12);
    const p2 = dn.union(up);
    expect(p1.equals(p2), "Union is not commutative.");
    const p3 = Polygon.union(up, dn);
    expect(p1.equals(p3), "Static method does not give same result as instance method.");
  });
  
  it("should produce a large hexagonal convex hull", () => { 
    const p1 = Polygon.union(up, dn).getHull();
    expect(p1.getNumPoints()).eql(6);
    expect([...p1.iterVertices()].map(({ x, y }) => Math.hypot(x,y)))
      .eqls([1, 1, 1, 1, 1, 1]);
  });

  it("should be an identity operation for superset", () => { 
    const p1 = up.union(sm);
    expect(p1.getNumPoints()).eql(3);
    expect(p1.equals(up), "Union identity operation failed.");
    expect(!p1.equals(sm), "Union identity operation failed.");
  });
});