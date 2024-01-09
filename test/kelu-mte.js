#!/usr/bin/node --harmony
'use strict';

const net = require('node:net');
const dump = require('buffer-hexdump');
const {
    MessageReceiver,
    createConnectResp,
    createReadInstantaneousResp,
    createSetupLoadResp,
    DEFAULT_MTE_ADDR,
} = require('../model/cl3013.js');

const SERVER_PORT = 2404;

/*----------------------------------------------------------------------------*/

function handleConnect(req, socket)
{
    const resp = createConnectResp(req.receiverAddr, req.senderAddr, {});
    console.log('send resposne:\n' + dump(resp));
    socket.write(resp);
}

function handleReadInstantaneous(req, socket)
{
    const resp = createReadInstantaneousResp(req.receiverAddr, req.senderAddr,
        {
            v: [
                [239e6, -6],
                [241e6, -6],
                [230e6, -6],
            ],
            i: [
                [5.01e6, -6],
                [4.99e6, -6],
                [20.68e6, -6],
            ],
            p: [
                [84668258, -5],
                [85035954, -5],
                [411916323, -5],
            ],
            q: [
                [84668258, -5],
                [85035954, -5],
                [237820000, -5],
            ],
        });
    console.log('send resposne:\n' + dump(resp));
    socket.write(resp);
}

function handleSetupLoad(req, socket)
{
    const msg = createSetupLoadResp(req.receiverAddr, req.senderAddr,
        true);
    console.log('send resposne:\n', dump(msg));
    socket.write(msg);
}

/*----------------------------------------------------------------------------*/

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
        console.log('process message', msg);
        const reqCmdHandlers = {
            201: handleConnect,
            160: handleReadInstantaneous,
            163: handleSetupLoad,
        };

        var handlered = false;
        for (const [cmd, handler] of Object.entries(reqCmdHandlers)) {
            if (cmd == msg.cmd) {
                console.log(`found command handler for ${msg.cmd}`);
                handler(msg, this.#client);
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
server.listen(SERVER_PORT, 'localhost');
