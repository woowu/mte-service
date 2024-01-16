# MTE Service

A REST service providing access to a Meter Test Equipment (MTE) for control and data poll.

# Features

- Hide and separate MTE operations by providing a set of universal and abstract API's.
- A client tool for service configuration.

# Installation

Install [Node.js](https://nodejs.org) and run the below command to install the dependencies:

```
npm install
```

# Usage

Linux:
```
npm start
```

By defaut, the MTE service running at tcp port 6200. Modify the .env file can change the port.

## Configure MTE device address

By default, the MTE will connect MTE device at 127.0.0.1:2404. To change the MTE device address, you need to call /api/mteconfig to configure correct host/ip and tcp port number. Using client tool mteconfig.js (comes with e355-cali.js project) can do this without the API knowledges.

Example:

```
./mteconfig -h host-running-mte-servie -p tcp-port-of-mte-server host 1.2.3.4
./mteconfig -h host-running-mte-servie -p tcp-port-of-mte-server port 50000
```

The above two commands will configure the MTE service running at `host-running-mte-servie:tcp-port-of-mte-server` to use MTE device at 1.2.3.4:50000

## API

- */instantaneous* Method: GET. Poll instantaneous quantities from the MTE.
- */loadef* Method: PUT. Update load definition like voltage, current, phase angles e.t.c.
- */mteconfig* Method: PUT. Update configurations of the service itself, e.g., host and port number of the MTE device.
- */mteconfig* Method: GET. Query configurations of the service itself.
