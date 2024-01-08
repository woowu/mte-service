const net = require('node:net');
const {
    MessageReceiver,
    commandCodes,
    createConnectMsg,
    createReadInstantaneousMsg,
    DEFAULT_MTE_ADDR,
} = require('../model/cl3013.js');

const SELF_ADDR = 6;

class Mte {
    #client;
    #receiver;

    connect(host, port) {
        this.#client = new net.Socket();

        this.#client.on('close', () => {
            console.log('socket closed');
            this.#receiver.end();
        });

        return new Promise((resolve, reject) => {
            this.#client.connect(port, host, () => {
                console.log('socket connected');
                this.#receiver = new MessageReceiver(this.#client, SELF_ADDR);
                this.#receiver.start();
                this.#exchangeMsg(createConnectMsg(SELF_ADDR, DEFAULT_MTE_ADDR))
                    .then(resp => {
                        resolve(resp);
                    })
                    .catch(reject);
            });
        });
    }

    disconnect() {
        this.client.destroy();
    }

    readInstantaneous() {
        return new Promise((resolve, reject) => {
            this.#exchangeMsg(createReadInstantaneousMsg(
                SELF_ADDR, DEFAULT_MTE_ADDR))
                .then(resolve)
                .catch(reject);
        });
    }

    #exchangeMsg(req, timeout=3000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('request timeout'));
            }, timeout);
            this.#receiver.once('message', resp => {
                console.log('exchange: received', resp);
                clearTimeout(timer);
                resolve(resp);
            });
            console.log('exchange: send req', req);
            this.#client.write(req);
        });
    }
}

module.exports = Mte;
