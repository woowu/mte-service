'use strict';

const { response } = require('express');
const Mte = require('../model/Mte');

const getInstantaneous = async (req, res = response) => {
    try {
        const mte = new Mte();
        const devInfo = await mte.connect(
            process.env.MTE_HOST, process.env.MTE_PORT);
        console.log('device info', devInfo);
        const instant = await mte.readInstantaneous();
        console.log('instant', instant);
        res.json(instant);
    } catch (e) {
        res.status(500).send(e.message);
    }
};

module.exports = {
    getInstantaneous,
};
