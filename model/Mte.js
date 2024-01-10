const net = require('node:net');
const dump = require('buffer-hexdump');

const {
    MessageReceiver,
    createWriteMsg,
    createReadMsg,
    createConnectMsg,
    createReadInstantaneousData,
    createSetupLoadData,
    commandCodes,
    objectAddress,
    DEFAULT_MTE_ADDR,
} = require('../model/cl3013.js');

const SELF_ADDR = 6;

class Mte {
    #client;
    #receiver;

    connect(host, port) {
        this.#client = new net.Socket();

        this.#client.on('close', () => {
            console.log('mte socket closed');
            if (this.#receiver) this.#receiver.end();
        });

        return new Promise((resolve, reject) => {
            this.#client.on('error', err => {
                console.log('socket error', err);
                if (this.#receiver) this.#receiver.end();
                reject(err);
            });

            this.#client.connect(port, host, () => {
                console.log('mte socket connected');
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
        this.#client.destroy();
    }

    readInstantaneous() {
        return new Promise((resolve, reject) => {
            const rdMsg = createReadMsg(SELF_ADDR, DEFAULT_MTE_ADDR,
                objectAddress.instantaneous,
                createReadInstantaneousData());
            this.#exchangeMsg(rdMsg)
                .then(resp => {
                    resolve(resp.data);
                })
                .catch(reject);
        });
    }

    setupLoad(def) {
        return new Promise((resolve, reject) => {
            const wrMsg = createWriteMsg(SELF_ADDR, DEFAULT_MTE_ADDR,
                objectAddress.loadSetup, createSetupLoadData(def));
            this.#exchangeMsg(wrMsg)
                .then(resp => {
                    const wrMsg = createWriteMsg(
                        SELF_ADDR, DEFAULT_MTE_ADDR,
                        objectAddress.displayWindow, Buffer.from([0x81]));
                    return this.#exchangeMsg(wrMsg);
                })
                .then(resp => {
                    resolve(resp.data);
                })
                .catch(reject);
        });
    }

    #exchangeMsg(req, timeout=3000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('request timeout'));
            }, timeout);
            this.#receiver.once('message', resp => {
                console.log('received resp:\n' + dump(resp));
                clearTimeout(timer);
                resolve(resp);
            });
            console.log('send req:\n' + dump(req));
            this.#client.write(req);
        });
    }
}

module.exports = Mte;
