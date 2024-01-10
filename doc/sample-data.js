#!/usr/bin/node --harmony
'use strict';

/**
 * Generate some sample data for testing, which is not easy to type/repeat by
 * hand.
 */

const loadDef = {
    phi_v: [0, 240e4, 120e4],
    phi_i: [0, 240e4, 120e4],
    v: [
        [242e4, -4],
        [242e4, -4],
        [242e4, -4],
    ],
    i: [
        [6e6, -6],
        [6e6, -6],
        [6e6, -6],
    ],
    f: 50e4,
};
console.log(JSON.stringify(loadDef));
