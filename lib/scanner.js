// Code based on https://github.com/StephanJoubert/home_assistant_solarman
// From scanner.py

// Send the broadcast message every 30 seconds until a valid response is detected
'use strict';

const dgram = require('dgram');

class InverterScanner
{
    constructor(homey, homeyIP)
    {
        this._homey = homey;
        this._homeyIP = homeyIP;
        this._ipaddress = null;
        this._serial = null;
        this._mac = null;
        this._scanning = false;
        return this;
    }

    _discover_inverters(callback)
    {
        if (this._scanning)
        {
            return;
        }

        this._scanning = true;
        const request = "WIFIKIT-214028-READ";
        try
        {
            const socket = dgram.createSocket('udp4');
            var __this = this;

            socket.on('listening', function()
            {
                socket.setBroadcast(true);
                __this._scannerTimer = __this._homey.setInterval(() =>
                {
                    socket.send(request, 0, request.length, 48899, '255.255.255.255');
                }, 5000);
            });

            socket.on('message', function(buffer, remote)
            {
                if (remote.address !== __this._homeyIP)
                {
                    let message = buffer.toString();
                    console.log('CLIENT RECEIVED: ', remote, message);
                    let a = message.split(',');
                    if (3 == a.length)
                    {
                        __this._homey.clearTimeout(__this._scannerTimer);
                        __this._scanning = false;
                        __this._ipaddress = a[0];
                        __this._mac = a[1];
                        __this._serial = parseInt(a[2]);
                        console.log('CLIENT INFO: ', __this._ipaddress, __this._mac, __this._serial);
                        callback(__this._ipaddress, __this._serial);
                    }
                }
            });

            socket.bind('48899');
        }
        catch (err)
        {
            return;
        }
    }

    async startScanning(callback)
    {
        this._discover_inverters(callback);
    }

    get_ipaddress()
    {
        return this._ipaddress;
    }

    get_serialno()
    {
        return this._serial;
    }
}

module.exports = InverterScanner;