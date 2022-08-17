import 'mocha';
import { expect } from 'chai';

import { pointUp, pointDn, small } from './vertices';
import { Polygon } from '../src/gpc';

describe("Test xors", () => {
  const up = Polygon.fromPoints(pointUp);
  const dn = Polygon.fromPoints(pointDn);
  const sm = Polygon.fromPoints(small);

  it("should produce a six disjoint triangle tips", () => { 
    const p1 = up.xor(dn);
    expect(p1.getInnerPolies().length).eql(6);
    expect(p1.getNumPoints()).eql(18);
    const p2 = dn.xor(up);
    expect(p1.equals(p2), "Xor is not commutative.");
    const p3 = Polygon.xor(up, dn);
    expect(p1.equals(p3), "Static method does not give same result as instance method.");
  });
  
  it("should produce a large hexagonal convex hull", () => { 
    const p1 = Polygon.xor(up, dn).getHull();
    expect(p1.getNumPoints()).eql(6);
  });

  it("should produce 6 triangles after explosion", () => { 
    const p1 = Polygon.xor(up, dn).explode();
    expect(p1.length).eql(6);
    expect(p1[0].getNumPoints()).eql(3);
    expect(p1[1].getNumPoints()).eql(3);
    expect(p1[2].getNumPoints()).eql(3);
    expect(p1[3].getNumPoints()).eql(3);
    expect(p1[4].getNumPoints()).eql(3);
    expect(p1[5].getNumPoints()).eql(3);
  });


  it("should be identical to difference", () => { 
    const p1 = up.xor(sm);
    expect(p1.getNumPoints()).eql(6);
    const p2 = up.difference(sm);
    expect(p1.equals(p2), "Subset xor and difference do not give the same result.");
  });
});