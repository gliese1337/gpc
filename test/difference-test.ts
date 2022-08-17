import 'mocha';
import { expect } from 'chai';

import { pointUp, pointDn, small } from './vertices';
import { Polygon } from '../src/gpc';

describe("Test differences", () => {
  const up = Polygon.fromPoints(pointUp);
  const dn = Polygon.fromPoints(pointDn);
  const sm = Polygon.fromPoints(small);

  it("should produce disjoint triangle tips", () => { 
    const p1 = up.difference(dn);
    expect(p1.getInnerPolies().length).eql(3);
    expect(p1.getNumPoints()).eql(9);
    const p2 = dn.difference(up);
    expect(p2.getInnerPolies().length).eql(3);
    expect(p2.getNumPoints()).eql(9);
    const p3 = Polygon.difference(up, dn);
    expect(p1.equals(p3), "Static method does not give same result as instance method.");
  });

  it("should produce 3 triangles after explosion", () => { 
    const p1 = Polygon.difference(up, dn).explode();
    expect(p1.length).eql(3);
    expect(p1[0].getNumPoints()).eql(3);
    expect(p1[1].getNumPoints()).eql(3);
    expect(p1[2].getNumPoints()).eql(3);
  });

  it("should produce a convex hull identical to the original triangle", () => { 
    const p1 = up.difference(dn).getHull();
    expect(p1.equals(up), "Convex hull of triangle points does not equal triangle.");
  });

  it("should produce a hole", () => { 
    const p1 = up.difference(sm);
    expect(p1.getNumPoints()).eql(6);
  });

  it("should not separate hole during explosion", () => { 
    const p1 = up.difference(sm).explode();
    expect(p1.length).eql(1);
  });
});