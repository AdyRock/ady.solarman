/* jslint node: true */

'use strict';

const { OAuth2Driver } = require('homey-oauth2app');

class HubDriver extends OAuth2Driver
{

    async getHUBDevices(oAuth2Client)
    {
        const response = await oAuth2Client.getStations();

        if (response)
        {
            if (response.success !== true)
            {
                throw (new Error('Failed to get station list'));
            }

            const searchData = response.stationList;
            const devices = [];

            // Create an array of devices
            for (const device of searchData)
            {
                let data = {};
                data = {
                    id: device.id
                };

                // Add this device to the table
                devices.push(
                    {
                        name: device.name,
                        data,
                    },
                );
            }
            return devices;
        }

        throw (new Error('HTTPS Error: Nothing returned'));
    }

}

module.exports = HubDriver;
