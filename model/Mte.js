const net = require('node:net');
const dump = require('buffer-hexdump');

const {
    MessageReceiver,
    createWriteMsg,
    createReadMsg,
    createConnectMsg,
    createMsg,
    createReadInstantaneousData,
    createSetupLoadData,
    createStopTestMsg,
    createPollTestResultMsg,
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

            console.log(`connect ${host}:${port}`);
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

    startTest(meter, param) {
        console.log(`Start test on meter ${meter}. Param:`, param);

        /* We don't know the meanings of the messages so far.
         */
        return new Promise((resolve, reject) => {
            const msg = createMsg(SELF_ADDR, DEFAULT_MTE_ADDR,
                0x32, Buffer.from([
                    0x00, 0x00, 0x00, 0x03, 0xe8, 0x00, 0x00, 0x00,
                    0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    0x00, 
                ]));
            this.#exchangeMsg(msg, { noresp: true, timeout: 1000 })
                .then(() => {
                    const msg = createMsg(SELF_ADDR, DEFAULT_MTE_ADDR,
                        0x31, Buffer.from([
                            0x00, 0xbe, 0xbc, 0x20, 0x00, 0x01,
                        ]));
                    return this.#exchangeMsg(msg, { noresp: true, timeout: 1000 });
                })
                .then(() => {
                    const msg = createMsg(SELF_ADDR, DEFAULT_MTE_ADDR,
                        0x51, Buffer.from([
                            0x01, 0x00,
                        ]));
                    return this.#exchangeMsg(msg, { noresp: true, timeout: 1000 });
                })
                .then(() => {
                    const msg = createMsg(SELF_ADDR, DEFAULT_MTE_ADDR,
                        0x47, Buffer.from([
                            0xff, 0x00,
                        ]));
                    return this.#exchangeMsg(msg, { noresp: true, timeout: 1000 });
                })
                .then(() => {
                    const msg = createMsg(SELF_ADDR, DEFAULT_MTE_ADDR,
                        0x46, Buffer.from([
                            0xff, 0x01,
                        ]));
                    return this.#exchangeMsg(msg, { noresp: true, timeout: 1000 });
                })
                .then(() => {
                    const msg = createMsg(SELF_ADDR, DEFAULT_MTE_ADDR,
                        0x48, Buffer.from([
                            0xff,
                        ]));
                    return this.#exchangeMsg(msg, { noresp: true, timeout: 1000 });
                })
                .then(resolve)
                .catch(reject);
        });
    }

    stopTest(meter) {
        console.log(`Stop test on meter ${meter}.`);

        const msg = createStopTestMsg(SELF_ADDR, DEFAULT_MTE_ADDR, meter);
        return new Promise((resolve, reject) => {
            this.#exchangeMsg(msg, { noresp: true, timeout: 1000 })
                .then(resolve)
                .catch(reject);
        });
    }

    pollTestResult(meter) {
        console.log(`Poll test result on meter ${meter}`);

        const msg = createPollTestResultMsg(SELF_ADDR, DEFAULT_MTE_ADDR, meter);
        return new Promise((resolve, reject) => {
            this.#exchangeMsg(msg)
                .then(resp => {
                    console.log('result:', resp);
                    resolve(resp);
                })
                .catch(reject);
        });
    }

    #exchangeMsg(req, options) {
        if (options === undefined) options = { noresp: false, timeout: 3000 };
        const { noresp=false, timeout=3000 } = options;

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (! noresp)
                    reject(new Error('request timeout'));
                else
                    resolve();
            }, timeout);
            this.#receiver.once('message', resp => {
                console.log('received resp:\n' + dump(resp));
                clearTimeout(timer);
                if (! noresp) resolve(resp);
            });
            console.log('send req:\n' + dump(req));
            this.#client.write(req);
        });
    }
}

module.exports = Mte;
