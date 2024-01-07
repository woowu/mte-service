'use strict';

const { response } = require('express');
const Mte = require('../model/Mte');

const getInstantaneous = async (req, res = response) => {
    try {
        const mte = new Mte();
        await mte.connect('localhost', 2404);
        res.json(await mte.readInstantaneous());
    } catch (e) {
        res.status(500).send(e.message);
    }
};

module.exports = {
    getInstantaneous,
};
