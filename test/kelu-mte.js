#!/usr/bin/node --harmony
'use strict';

const net = require('node:net');
const dump = require('buffer-hexdump');
const {
    MessageReceiver,
    createConnectRespMsg,
    createReadInstantaneousResp,
    createReadRespMsg,
    createAcknowledgeMsg,
    createPollTestResultRespMsg,
    createPollTestResultResp,
    DEFAULT_MTE_ADDR,
} = require('../model/cl3013.js');

const SERVER_PORT = 2404;

/*----------------------------------------------------------------------------*/

function handleConnect(req, socket, mte)
{
    const msg = createConnectRespMsg(req.receiverAddr, req.senderAddr,
        {});
    console.log('send response:\n' + dump(msg));
    socket.write(msg);
    return mte;
}

function handleRead(req, socket, mte)
{
    /* currently i assume the addr is always [0x02, 0x3d] and
     * data is [0xff, 0x3f, 0xff, 0xff, 0x0f]
     */

    const resp = createReadInstantaneousResp({
        v: [242.1e3, 242.2e3, 242.3e3],
        i: [6.6e3, 10.2e3, 20e3],
        p: [1.3838e6, 2.4704e6, 4.846e6],
        q: [.79893e6, 10, 10],
        pf: [.8607e3, 1, 1],
        f: 50.03e3
    });
    const msg = createReadRespMsg(req.receiverAddr, req.senderAddr,
        req.data.addr, resp);
    console.log('send response:\n' + dump(msg));
    socket.write(msg);
    return mte;
}

function handleWrite(req, socket, mte)
{
    const msg = createAcknowledgeMsg(req.receiverAddr, req.senderAddr,
        true);
    console.log('send response:\n', dump(msg));
    socket.write(msg);
    return mte;
}

function handleStartTest(req, socket, mte)
{
    console.log('got message for starting a test:', req.data);
    return Object.assign({}, mte, {
        test: { startTime: new Date() },
    });
}

function handleStopTest(req, socket, mte)
{
    console.log('got message for stopping a test:', req.data);
    if (! mte.test)
        console.log('no test started!');
    return { test: null };
}

function handlePollTestResult(req, socket, mte)
{
    console.log('got message for polling test result:', req.data);
    if (! mte.test || ! mte.test.startTime) {
        console.log('no test started');
        return mte;
    }
    const meter = req.data.meter;
    const t = new Date() - mte.test.startTime;
    const seqno = (t / 1000) % 3;
    const msg = createPollTestResultRespMsg(req.receiverAddr, req.senderAddr,
        meter, parseInt(t / 3000), createPollTestResultResp(.5e-2));
    console.log('send response:\n', dump(msg));
    socket.write(msg);
    return mte;
}

/*----------------------------------------------------------------------------*/

var mteConnection = {};

class Server {
    #client;
    #receiver;

    constructor(client) {
        this.#client = client;
        this.#receiver = new MessageReceiver(client, DEFAULT_MTE_ADDR);
    }

    start() {
        this.#client.on('close', () => {
            console.log('connection closed');
            this.#receiver.end();
        });
        this.#receiver.on('message', msg => {
            this.#processMessage(msg);
        });
        this.#receiver.start();
    }

    #processMessage(msg) {
        console.log('received message', msg);
        const reqCmdHandlers = {
            201: handleConnect,
            160: handleRead,
            163: handleWrite,
            72: handleStartTest,
            73: handleStopTest,
            52: handlePollTestResult,
        };

        var handlered = false;
        for (const [cmd, handler] of Object.entries(reqCmdHandlers)) {
            if (cmd == msg.cmd) {
                console.log(`found command handler for ${msg.cmd}`);
                mteConnection = handler(msg, this.#client,
                    mteConnection);
                handlered = true;
                break;
            }
        }
        if (! handlered) console.log('no handler for command', msg.cmd);
    }
}

const server = net.createServer(socket => {
    console.log('new connection');
    new Server(socket).start();
});

console.log(`listen on ${SERVER_PORT}`);
server.listen(SERVER_PORT);
