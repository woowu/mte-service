const EventEmitter = require('events');
const dump = require('buffer-hexdump');

const MESSAGE_START = 0x81;
const MSG_OVERHEAD = 6;
const commandCodes = {
    CMD_CONNECT: 201,
    CMD_CONNECT_RESP: 57,
    CMD_READ: 160,
    CMD_READ_RESP: 80,
    CMD_WRITE: 163,
    CMD_ACK: 48,
    CMD_NAK: 51,
};
const LINE_NUM = 3;

const objectAddress = {
    instantaneous: Buffer.from([0x02, 0x3d]),
    loadSetup: Buffer.from([0x05, 0x46]),
    wiringSetup: Buffer.from([0x00, 0x01, 0x20]),
    displayWindow: Buffer.from([0x00, 0x10, 0x80]),
}

/*----------------------------------------------------------------------------*/

exports.objectAddress = objectAddress;
exports.DEFAULT_MTE_ADDR = 1;

/*----------------------------------------------------------------------------*/

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
    new DataView(mm).setInt32(0, parseInt(m), true);
    new DataView(nn).setInt8(0, parseInt(n));
    return Buffer.concat([Buffer.from(mm), Buffer.from(nn)]);
}

function encodeUint32(n) {
    const nn = new ArrayBuffer(4);
    new DataView(nn).setUint32(0, parseInt(n), true);
    return Buffer.from(nn);
}

function decodeUint32(data) {
    return new DataView(
        data.buffer.slice(data.byteOffset, data.byteOffset + 4)
    ).getUint32(0, true);
}

function encodeInt32(n) {
    const nn = new ArrayBuffer(4);
    new DataView(nn).setInt32(0, parseInt(n), true);
    return Buffer.from(nn);
}

function decodeInt32(data) {
    return new DataView(
        data.buffer.slice(data.byteOffset, data.byteOffset + 4)
    ).getInt32(0, true);
}

/**
 * @data Int4e1 encoded floating number
 * @return [m: significant, n: exponent]
 */
function decodeInt4e1(data) {
    return [
        new DataView(
            data.buffer.slice(data.byteOffset, data.byteOffset + 4)
        ).getInt32(0, true),
        new DataView(
            data.buffer.slice(data.byteOffset + 4, data.byteOffset + 5)
        ).getInt8(0, true),
    ];
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

function parseConnectReq(data)
{
    return null;
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

function parseWriteReq(data)
{
    if (data.length >= 3 && data.slice(0, 3).equals(Buffer.from([
        0x00, 0x10, 0x80])))
        return {
            addr: data.slice(0, 3),
            data: data.slice(3),
        };
    else
        return {
            addr: data.slice(0, 2),
            data: data.slice(2),
        };
}

function parseReadReq(data)
{
    return {
        addr: data.slice(0, 2),
        data: data.slice(2),
    };
}

function parseReadResp(data)
{
    const addr = data.slice(0, 2);
    if (addr.equals(objectAddress.instantaneous))
        return parseReadInstantaneousResp(data);
    return {
        error: 'unknown address in read response: ' + addr.toString('hex'),
    };
}

function parseAcknowledge(data, cmd)
{
    console.log('001', cmd);
    return { result: cmd == commandCodes.CMD_ACK
        ? 'success' : cmd == commandCodes.CMD_NAK
        ? 'failure' : cmd };
}

function parseMessage(msg)
{
    const messageParsers = {
        201: parseConnectReq,
        57: parseConnectResp,
        163: parseWriteReq,
        160: parseReadReq,
        80: parseReadResp,
        48: parseAcknowledge,
        51: parseAcknowledge,
    };

    var data = { raw: msg.slice(5, msg.length - 1) };
    for (const [cmd, handler] of Object.entries(messageParsers)) {
        if (cmd == msg[4]) {
            data = handler(msg.slice(5, msg.length - 1), cmd);
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

/*----------------------------------------------------------------------------*/

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
            console.log('socket received new data:\n' + dump(data));
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

/*----------------------------------------------------------------------------*/

exports.createConnectMsg = function(sender, receiver) {
    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: commandCodes.CMD_CONNECT,
    });
};

exports.createConnectRespMsg = function(sender, receiver, {
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
};

exports.createReadMsg = function(sender, receiver, addr, data) {
    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: commandCodes.CMD_READ,
        payload: Buffer.concat([addr, data]),
    });
};

exports.createReadRespMsg = function(sender, receiver, addr, data) {
    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: commandCodes.CMD_READ_RESP,
        payload: Buffer.concat([addr, data]),
    });
};

exports.createWriteMsg = function(sender, receiver, addr, data) {
    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: commandCodes.CMD_WRITE,
        payload: Buffer.concat([addr, data]),
    });
};

exports.createAcknowledgeMsg = function(sender, receiver, result) {
    return compositeMsg({
        receiverAddr: receiver,
        senderAddr: sender,
        cmd: result ? commandCodes.CMD_ACK
            : commandCodes.CMD_NAK,
    });
};

/*----------------------------------------------------------------------------*/

exports.createReadInstantaneousData = function() {
    const masks = Buffer.from([
        0xff, 0x3f, 0xff, 0xff, 0x0f,
    ]);
    return masks;
};

exports.createReadInstantaneousResp = function(value) {
    var a;

    const v = new Array(LINE_NUM);
    for (var l = 0; l < v.length; ++l) {
        v[l] = encodeInt4e1(value.v !== undefined && value.v[l] !== undefined
            ? value.v[l][0] : 0,
            value.v !== undefined && value.v[l] !== undefined
            ? value.v[l][1] : 0);
    }
    const i = new Array(LINE_NUM);
    for (var l = 0; l < i.length; ++l) {
        i[l] = encodeInt4e1(value.i !== undefined && value.i[l] !== undefined
            ? value.i[l][0] : 0,
            value.i !== undefined && value.i[l] !== undefined
            ? value.i[l][1] : 0);
    }

    a = new ArrayBuffer(4);
    new DataView(a).setUint32(0,
        value.freq !== undefined ? value.freq : 0, true);
    const freq = Buffer.from(a);

    const overloadFlag = Buffer.from([
        value.overloadFlag !== undefined ? value.overloadFlag : 0
    ]);

    const vPhi = new Array(LINE_NUM);
    for (var l = 0; l < vPhi.length; ++l) {
        a = new ArrayBuffer(4);
        new DataView(a).setUint32(0,
            value.vPhi !== undefined && value.vPhi[l] !== undefined
            ? value.vPhi[l] : 0, true);
        vPhi[l] = Buffer.from(a);
    }
    const iPhi = new Array(LINE_NUM);
    for (var l = 0; l < iPhi.length; ++l) {
        a = new ArrayBuffer(4);
        new DataView(a).setUint32(0,
            value.iPhi !== undefined && value.iPhi[l] !== undefined
            ? value.iPhi[l] : 0, true);
        iPhi[l] = Buffer.from(a);
    }

    const lPhi = new Array(LINE_NUM);
    for (var l = 0; l < lPhi.length; ++l) {
        a = new ArrayBuffer(4);
        new DataView(a).setUint32(0,
            value.lPhi !== undefined && value.lPhi[l] !== undefined
            ? value.lPhi[l] : 0, true);
        lPhi[l] = Buffer.from(a);
    }

    const pf = new Array(LINE_NUM + 2);
    for (var l = 0; l < pf.length; ++l) {
        a = new ArrayBuffer(4);
        new DataView(a).setInt32(0,
            value.pf !== undefined && value.pf[l] !== undefined
            ? value.pf[l] : 0, true);
        pf[l] = Buffer.from(a);
    }

    const p = new Array(LINE_NUM + 1);
    for (var l = 0; l < p.length; ++l) {
        p[l] = encodeInt4e1(value.p !== undefined && value.p[l] !== undefined
            ? value.p[l][0] : 0,
            value.p !== undefined && value.p[l] !== undefined
            ? value.p[l][1] : 0);
    }
    const q = new Array(LINE_NUM + 1);
    for (var l = 0; l < q.length; ++l) {
        q[l] = encodeInt4e1(value.q !== undefined && value.q[l] !== undefined
            ? value.q[l][0] : 0,
            value.q !== undefined && value.q[l] !== undefined
            ? value.q[l][1] : 0);
    }

    const s = new Array(LINE_NUM + 1);
    for (var l = 0; l < s.length; ++l) {
        s[l] = encodeInt4e1(value.s !== undefined && value.s[l] !== undefined
            ? value.s[0] : 0,
            value.s !== undefined && value.s[l] !== undefined
            ? value.s[1] : 0);
    }

    return Buffer.concat([
        Buffer.from([0xff]),
        v[2], v[1], v[0],
        i[2], i[1], i[0],
        freq,
        overloadFlag,

        Buffer.from([0x3f]),
        vPhi[2], vPhi[1], vPhi[0],
        iPhi[2], iPhi[1], iPhi[0],

        Buffer.from([0xff]),
        lPhi[2], lPhi[1], lPhi[0],
        pf[2], pf[1], pf[0], pf[3], pf[4],

        Buffer.from([0xff]),
        p[2], p[1], p[0], p[3],
        q[2], q[1], q[0], q[3],

        Buffer.from([0x0f]),
        s[2], s[1], s[0], s[3],
    ]);
};

exports.createSetupLoadData = function(loadDef) {
    const freqFlag = loadDef.freq !== undefined  ? 7 : 0;

    var phaseMask = 0;
    const vPhi = new Array(LINE_NUM);
    for (var l = 0; l < vPhi.length; ++l) {
        if (loadDef.vPhi && loadDef.vPhi[l] !== null) {
            vPhi[l] = encodeUint32(loadDef.vPhi[l]);
            phaseMask |= 1 << (vPhi.length - 1) - l
        } else
            vPhi[l] = encodeUint32(0);
    }
    const iPhi = new Array(LINE_NUM);
    for (var l = 0; l < iPhi.length; ++l) {
        if (loadDef.iPhi && loadDef.iPhi[l] !== null) {
            iPhi[l] = encodeUint32(loadDef.iPhi[l]);
            phaseMask |= 8 << (iPhi.length - 1) - l
        } else
            iPhi[l] = encodeUint32(0);
    }

    var amplitudeMask = 0;
    const v = new Array(LINE_NUM);
    for (var l = 0; l < v.length; ++l) {
        if (loadDef.v && loadDef.v[l] !== null) {
            v[l] = encodeInt4e1(loadDef.v[l][0], loadDef.v[l][1]);
            amplitudeMask |= 1 << (v.length - 1) - l
        } else
            v[l] = encodeInt4e1(0, 0);
    }
    const i = new Array(LINE_NUM);
    for (var l = 0; l < i.length; ++l) {
        if (loadDef.i && loadDef.i[l] !== null) {
            i[l] = encodeInt4e1(loadDef.i[l][0], loadDef.i[l][1]);
            amplitudeMask |= 8 << (v.length - 1) - l
        } else
            i[l] = encodeInt4e1(0, 0);
    }

    const freq = encodeUint32(loadDef.freq !== undefined ? loadDef.freq : 0);

    return Buffer.concat([
        Buffer.from([0x3f]),
        vPhi[2], vPhi[1], vPhi[0],
        iPhi[2], iPhi[1], iPhi[0],

        Buffer.from([0xff]),
        v[2], v[1], v[0],
        i[2], i[1], i[0],
        freq,
        Buffer.from([freqFlag]),

        Buffer.from([0x07]),
        Buffer.from([phaseMask, amplitudeMask, 0]),
    ]);
};
