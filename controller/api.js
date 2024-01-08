'use strict';

const { response } = require('express');
const Mte = require('../model/Mte');

const getInstantaneous = async (req, res = response) => {
    try {
        const mte = new Mte();
        const devInfo = await mte.connect('localhost', 2404);
        console.log('device info', devInfo);
        res.json(await mte.readInstantaneous());
    } catch (e) {
        res.status(500).send(e.message);
    }
};

module.exports = {
    getInstantaneous,
};
