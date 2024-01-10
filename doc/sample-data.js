#!/usr/bin/node --harmony
'use strict';

/**
 * Generate some sample data for testing, which is not easy to type/repeat by
 * hand.
 */

const loadDef = {
    phi_v: [30.6, 120, 240],
    phi_i: [0, 120, 240],
    v: [242.1, 242.2, 242.3],
    i: [6.6, 10.2, 20],
    f: 50.01,
};
console.log(JSON.stringify(loadDef));
