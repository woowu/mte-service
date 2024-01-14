# MTE Service

A backend REST service providing access to a Meter Test Equipment (MTE) for control and polling.

# Installation

npm install

# Usage

npm start

By defaut, the MTE service running at tcp port 6200.

## Configure MTE device address
By default, the MTE will connect MTE device at 127.0.0.1:2404. To change the MTE device address, you need to call /api/mteconfig to configure correct host/ip and tcp port number. Using client tool mteconfig.js (comes with e355-cali.js project) can do this without the API knowledges.

Example:

```
./mteconfig -h host-running-mte-servie -p tcp-port-of-mte-server host 1.2.3.4
./mteconfig -h host-running-mte-servie -p tcp-port-of-mte-server port 50000
```

The above two commands will configure the MTE service running at `host-running-mte-servie:tcp-port-of-mte-server` to use MTE device at 1.2.3.4:50000
