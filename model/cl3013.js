const EventEmitter = require('events');

const MESSAGE_START = 0x81;
const MSG_OVERHEAD = 6;
const commandCodes = {
    CMD_CONNECT: 201,
    CMD_CONNECT_RESP: 57,
    CMD_READ_INSTANTANEOUS: 160,
    CMD_READ_INSTANTANEOUS_RESP: 80,
};

/**
 * @param msg a buffer of message excluding the ending 'checksum' byte.
 */
function calcMsgChecksum(msg) {
    return msg.slice(1, msg.length).reduce((sum, c) => sum ^ c);
}

/**
 * @param m significant of 32-bit integer
 * @param n exponent from -128 to 127
 * @return A 5-octet buffer representing a Int4e1 number which is
 *   a 4-bytes little-endian integer of significant followed by
 *   one-byte exponent.
 */
function encodeInt4e1(m, n) {
    const mm = new ArrayBuffer(4);
    const nn = new ArrayBuffer(1);
    new DataView(mm).setInt32(0, m, true);
    new DataView(nn).setInt8(0, n);
    return Buffer.concat([Buffer.from(mm), Buffer.from(nn)]);
}

/**
 * @data Int4e1 encoded floating number
 * @return { m: significant, n: exponent }
 */
function decodeInt4e1(data) {
    return {
        m: new DataView(
            data.buffer.slice(data.byteOffset, data.byteOffset + 4)
            ).getInt32(0, true),
        n: data[4],
    };
}

function decodeUint32(data) {
    return new DataView(
        data.buffer.slice(data.byteOffset, data.byteOffset + 4)
    ).getUint32(0, true);
}

function decodeInt32(data) {
    return new DataView(
        data.buffer.slice(data.byteOffset, data.byteOffset + 4)
    ).getInt32(0, true);
}

/**
 * @param msg message of upper layer
 * @return a Buffer of message
 */
function compositeMsg(msg) {
    console.log('composite msg', msg);
    const buf = [MESSAGE_START];
    buf.push(msg.receiverAddr);
    buf.push(msg.senderAddr);
    buf.push((msg.payload ? msg.payload.length : 0) + MSG_OVERHEAD);
    buf.push(msg.cmd);
    if (msg.payload) buf.push(...msg.payload);
    buf.push(calcMsgChecksum(buf));
    return Buffer.from(buf);
}

function parseConnectResp(data)
{
    const copyString = (offset, maxLen) => {
        var len = 0;
        while (data[offset + len] && len < maxLen) ++len;
        return data.slice(offset, offset + len).toString();
    };
    return {
        protoVersion: copyString(0, 7),
        devType: copyString(7, 11),
        fwVersion: copyString(18, 5),
        seqno: copyString(23, 12),
    };
}

function parseReadInstantaneousResp(data)
{
    /* assume the first 3-bytes are always 0x02, 0x3d, 0xff */

    const value = {};
    value.v = [
        decodeInt4e1(data.slice(13, 13 + 5)),
        decodeInt4e1(data.slice(8, 8 + 5)),
        decodeInt4e1(data.slice(3, 3 + 5)),
    ];
    value.i = [
        decodeInt4e1(data.slice(28, 28 + 5)),
        decodeInt4e1(data.slice(23, 23 + 5)),
        decodeInt4e1(data.slice(18, 18 + 5)),
    ];
    value.freq = decodeUint32(data.slice(33, 33 + 4));
    value.overloadFlag = data[37];
    value.pf = [
        decodeInt32(data.slice(84, 84 + 4)),
        decodeInt32(data.slice(80, 80 + 4)),
        decodeInt32(data.slice(76, 76 + 4)),
        decodeInt32(data.slice(88, 88 + 4)), /* total pf */
        decodeInt32(data.slice(92, 92 + 4)), /* total sin(phi) */
    ];
    value.p = [
        decodeInt4e1(data.slice(107, 107 + 5)),
        decodeInt4e1(data.slice(102, 102 + 5)),
        decodeInt4e1(data.slice(97, 97 + 5)),
        decodeInt4e1(data.slice(112, 112 + 5)), /* total p */
    ];
    value.q = [
        decodeInt4e1(data.slice(127, 127 + 5)),
        decodeInt4e1(data.slice(122, 122 + 5)),
        decodeInt4e1(data.slice(117, 117 + 5)),
        decodeInt4e1(data.slice(132, 132 + 5)), /* total q */
    ];
    value.s = [
        decodeInt4e1(data.slice(148, 148 + 5)),
        decodeInt4e1(data.slice(143, 143 + 5)),
        decodeInt4e1(data.slice(138, 138 + 5)),
        decodeInt4e1(data.slice(153, 153 + 5)), /* total s */
    ];
    return value;
}

function parseMessage(msg)
{
    const messageParsers = {
        57: parseConnectResp,
        80: parseReadInstantaneousResp,
    };

    var data = { raw: msg.slice(5, msg.length - 1) };
    for (const [cmd, handler] of Object.entries(messageParsers)) {
        if (cmd == msg[4]) {
            data = handler(msg.slice(5, msg.length - 1));
            break;
        }
    }
    return {
        cmd: msg[4],
        senderAddr: msg[2],
        receiverAddr: msg[1],
        data,
    };
}

/**
 * @event message(msg) msg: a Buffer of received message
 */
exports.MessageReceiver = class MessageReceiver extends EventEmitter {
    #socket;
    #receiverAddr;
    #buf = [];
    #readTimer;

    constructor(socket, receiverAddr) {
        super();
        this.#socket = socket;
        this.#receiverAddr = receiverAddr;
    }

    start() {
        this.#socket.on('data', data => {
            console.log('socket received new data', data);
            this.#buf = [...this.#buf, ...data];
            clearTimeout(this.#readTimer);
            this.#readMessage();
        });
    }

    end() {
        clearTimeout(this.#readTimer);
    }

    #readMessage() {
        if (this.#buf.length < 3) return;
        while (this.#buf[0] != MESSAGE_START) this.#buf.shift();
        const len = this.#buf[3];
        if (this.#buf.length < len) return;

        const msg = this.#buf.slice(0, len);
        this.#buf = this.#buf.slice(len);

        if (msg[msg.length - 1] !=
            calcMsgChecksum(msg.slice(0, msg.length - 1)))
            console.log('message checksum error');
        else if (msg[1] != this.#receiverAddr)
            console.log(`receiver adddress mismatch: ${msg[1]},`
                + ` expect ${this.#receiverAddr}`);
        else
            super.emit('message', parseMessage(Buffer.from(msg)));

        this.#readTimer = setImmediate(() => {
            this.#readMessage();
        });
    }
};

exports.createConnectMsg = function(sender, receiver) {
    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: commandCodes.CMD_CONNECT,
    });
}

exports.createConnectResp = function(sender, receiver, {
    protoVersion = '1', devType = '1', fwVersion = '1', seqno = '0'
}) {
    const payload = protoVersion.slice(0, 7).padEnd(7, '\000')
        + devType.slice(0, 11).padEnd(11, '\000')
        + fwVersion.slice(0, 5).padEnd(5, '\000')
        + seqno.slice(0, 12).padEnd(12, '\000');
    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: commandCodes.CMD_CONNECT_RESP,
        payload: Buffer.from(payload),
    });
}

exports.createReadInstantaneousMsg = function(sender, receiver) {
    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: commandCodes.CMD_READ_INSTANTANEOUS,
        payload: Buffer.from([
            0x02, 0x3d, 0xff,
            0x3f, 0xff, 0xff, 0x0f,
        ]),
    });
}

exports.createReadInstantaneousResp = function(sender, receiver, value) {
    var a;

    const repeatReq = Buffer.from([0x02, 0x3d, 0xff]);

    const v1 = encodeInt4e1(value.v1 !== undefined ? value.v1[0] : 0,
        value.v1 !== undefined ? value.v1[1] :-6);
    const v2 = encodeInt4e1(value.v2 !== undefined ? value.v2[0] : 0,
        value.v2 !== undefined ? value.v2[1] :-6);
    const v3 = encodeInt4e1(value.v3 !== undefined ? value.v3[0] : 0,
        value.v3 !== undefined ? value.v3[1] :-6);
    const i1 = encodeInt4e1(value.i1 !== undefined ? value.i1[0] : 0,
        value.i1 !== undefined ? value.i1[1] :-6);
    const i2 = encodeInt4e1(value.i2 !== undefined ? value.i2[0] : 0,
        value.i2 !== undefined ? value.i2[1] :-6);
    const i3 = encodeInt4e1(value.i3 !== undefined ? value.i3[0] : 0,
        value.i3 !== undefined ? value.i3[1] :-6);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.freq !== undefined ? value.freq : 0, true);
    const freq = Buffer.from(a);

    const overloadFlag = Buffer.from([
        value.overloadFlag !== undefined ? value.overloadFlag : 0
    ]);

    const nouse1 = Buffer.from([0x3f]);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.v1Phi !== undefined ? value.v1Phi : 0, true);
    const v1Phi = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.v2Phi !== undefined ? value.v2Phi : 0, true);
    const v2Phi = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.v3Phi !== undefined ? value.v3Phi : 0, true);
    const v3Phi = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.i1Phi !== undefined ? value.i1Phi : 0, true);
    const i1Phi = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.i2Phi !== undefined ? value.i2Phi : 0, true);
    const i2Phi = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.i3Phi !== undefined ? value.i3Phi : 0, true);
    const i3Phi = Buffer.from(a);

    const nouse2 = Buffer.from([0xff]);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.l1Phi !== undefined ? value.l1Phi : 0, true);
    const l1Phi = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.l2Phi !== undefined ? value.l2Phi : 0, true);
    const l2Phi = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.l3Phi !== undefined ? value.l3Phi : 0, true);
    const l3Phi = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setInt32(0,
        value.l1Pf !== undefined ? value.l1Pf : 0, true);
    const l1Pf = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setInt32(0,
        value.l2Pf !== undefined ? value.l2Pf : 0, true);
    const l2Pf = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setInt32(0,
        value.l3Pf !== undefined ? value.l3Pf : 0, true);
    const l3Pf = Buffer.from(a);

    a = new ArrayBuffer(4);
    new DataView(a).setInt32(0,
        value.pf !== undefined ? value.pf : 0, true);
    const pf = Buffer.from(a);
    a = new ArrayBuffer(4);
    new DataView(a).setInt32(0,
        value.sinPhi !== undefined ? value.sinPhi : 0, true);
    const sinPhi = Buffer.from(a);

    const nouse3 = Buffer.from([0xff]);

    const p1 = encodeInt4e1(value.p1 !== undefined ? value.p1[0] : 0,
        value.p1 !== undefined ? value.p1[1] : -6);
    const p2 = encodeInt4e1(value.p2 !== undefined ? value.p2[0] : 0,
        value.p2 !== undefined ? value.p2[1] : -6);
    const p3 = encodeInt4e1(value.p3 !== undefined ? value.p3[0] : 0,
        value.p3 !== undefined ? value.p3[1] : -6);
    const p = encodeInt4e1(value.p !== undefined ? value.p[0] : 0,
        value.p !== undefined ? value.p[1] : -6);

    const q1 = encodeInt4e1(value.q1 !== undefined ? value.q1[0] : 0,
        value.q1 !== undefined ? value.q1[1] : -6);
    const q2 = encodeInt4e1(value.q2 !== undefined ? value.q2[0] : 0,
        value.q2 !== undefined ? value.q2[1] : -6);
    const q3 = encodeInt4e1(value.q3 !== undefined ? value.q3[0] : 0,
        value.q3 !== undefined ? value.q3[1] : -6);
    const q = encodeInt4e1(value.q !== undefined ? value.q[0] : 0,
        value.q !== undefined ? value.q[1] : -6);

    const nouse4 = Buffer.from([0x0f]);

    const s1 = encodeInt4e1(value.s1 !== undefined ? value.s1[0] : 0,
        value.s1 !== undefined ? value.s1[1] : -6);
    const s2 = encodeInt4e1(value.s2 !== undefined ? value.s2[0] : 0,
        value.s2 !== undefined ? value.s2[1] : -6);
    const s3 = encodeInt4e1(value.s3 !== undefined ? value.s3[0] : 0,
        value.s3 !== undefined ? value.s3[1] : -6);
    const s = encodeInt4e1(value.s !== undefined ? value.s[0] : 0,
        value.s !== undefined ? value.s[1] : -6);

    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: commandCodes.CMD_READ_INSTANTANEOUS_RESP,
        payload: Buffer.concat([
            repeatReq,
            v3, v2, v1,
            i3, i2, i1,
            freq,
            overloadFlag,
            nouse1,
            v3Phi, v2Phi, v1Phi,
            i3Phi, i2Phi, i1Phi,
            nouse2,
            l3Phi, l2Phi, l1Phi,
            l3Pf, l2Pf, l1Pf, pf, sinPhi,
            nouse3,
            p3, p2, p1, p,
            q3, q2, q1, q,
            nouse4,
            s3, s2, s1, s,
        ]),
    });
}

exports.DEFAULT_MTE_ADDR = 1;
