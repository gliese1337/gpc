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
    const p2 = dn.difference(up);
    const p3 = Polygon.difference(up, dn);
    expect(p1.getInnerPolies().length).eql(3);
    expect(p1.getNumPoints()).eql(9);
    expect(p2.getNumPoints()).eql(9);
    expect(p1.equals(p3), "Static method does not give same result as instance method.");
  });

  it("should produce a hole", () => { 
    const p1 = up.difference(sm);
    expect(p1.getNumPoints()).eql(6);
  });
});