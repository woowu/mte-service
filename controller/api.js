'use strict';

const { response } = require('express');
const Mte = require('../model/Mte');

var mteConfig = {
    host: 'localhost',
    port: 2404,
};

async function createMte()
{
    const mte = new Mte();
    const devInfo = await mte.connect(
        mteConfig.host, mteConfig.port);
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
        res.status(500).send(e.stack);
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
        res.status(500).send(e.stack);
    }
};

exports.updateMteConfig = async function(req, res = response)
{
    try {
        const config = req.body;
        console.log('mte config:', config);
        mteConfig = Object.assign({}, mteConfig,  config);
        res.json({ result: 'success' });
    } catch (e) {
        res.status(500).send(e.stack);
    }
};

exports.getMteConfig = async function(req, res = response)
{
    try {
        res.json(mteConfig);
    } catch (e) {
        res.status(500).send(e.stack);
    }
};
