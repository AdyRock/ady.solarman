/* jslint node: true */

'use strict';

const { Driver } = require('homey');

class LanDriver extends Driver
{

    async getLanDevices()
    {
        const inverters = this.homey.app.getDiscoveredInverters();

        if (inverters.length > 0)
        {
            const devices = [];

            // Create an array of devices
            for (const device of inverters)
            {
                let data = {};
                data = {
                    id: device.serial
                };

                // Add this device to the table
                devices.push(
                {
                    name: device.serial.toString(),
                    data,
                }, );
            }
            return devices;
        }

        throw (new Error('HTTPS Error: Nothing returned'));
    }

}

module.exports = LanDriver;