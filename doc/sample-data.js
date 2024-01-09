#!/usr/bin/node --harmony
'use strict';

/**
 * Generate some sample data for testing, which is not easy to type/repeat by
 * hand.
 */

const loadDef = {
    vPhi: [0, 240e4, 120e4],
    iPhi: [0, 240e4, 120e4],
    v: [
        [57.7e4, -4],
        [57.7e4, -4],
        [57.7e4, -4],
    ],
    i: [
        [5e6, -6],
        [5e6, -6],
        [5e6, -6],
    ],
    freq: 50e4,
};
console.log(JSON.stringify(loadDef));
