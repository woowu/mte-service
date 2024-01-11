#!/usr/bin/node --harmony
'use strict';

/**
 * Generate some sample data for testing, which is not easy to type/repeat by
 * hand.
 */

const loadDef = {
    phi_v: [30.6e3, 120e3, 240e3],
    phi_i: [0e3, 120e3, 240e3],
    v: [242.1e3, 242.2e3, 242.3e3],
    i: [6.6e3, 10.2e3, 20e3],
    f: 50.01e3,
};
console.log(JSON.stringify(loadDef));
