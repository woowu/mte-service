'use strict';

const { response } = require('express');
const Mte = require('../model/Mte');

async function createMte()
{
    const mte = new Mte();
    const devInfo = await mte.connect(
        process.env.MTE_HOST, process.env.MTE_PORT);
    console.log('device info', devInfo);
    return mte;
}

exports.getInstantaneous = async function(req, res = response) 
{
    try {
        const mte = await createMte();
        console.log('read instantaneous');
        const instant = await mte.readInstantaneous();
        mte.disconnect();
        console.log('instantaneous:', instant);
        res.json(instant);
    } catch (e) {
        res.status(500).send(e.message);
    }
};

exports.updateLoadDef = async function(req, res = response)
{
    try {
        const loadDef = req.body;
        console.log('setup load:', loadDef);
        const mte = await createMte();
        const result = await mte.setupLoad(loadDef);
        console.log('result:', result);
        mte.disconnect();
        res.json(result);
    } catch (e) {
        res.status(500).send(e.message);
    }
};
