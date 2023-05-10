/* jslint node: true */

'use strict';

const OAuth2Driver = require('../lib/OAuth2Driver');

class HubDriver extends OAuth2Driver
{

    async getHUBDevices(oAuth2Client)
    {
        const response = await oAuth2Client.getStations();

        if (response)
        {
            this.log(response);
            if (response.success !== true)
            {
                throw (new Error(`Failed to get station list: ${response.msg}`));
            }

            const searchData = response.stationList;
            const homeyDevices = [];

            // Create an array of devices
            for (const station of searchData)
            {
                let device = {};
                const response2 = await oAuth2Client.getDevices(station.id);
                if (response2)
                {
                    this.log(response2);
                    device = response2.deviceListItems.find((item) => item.deviceType === 'INVERTER');
                }

                let data = {};
                data = {
                    id: station.id,
                    device,
                };

                // Add this device to the table
                homeyDevices.push(
                    {
                        name: station.name,
                        data,
                    },
                );
            }
            return homeyDevices;
        }

        throw (new Error('HTTPS Error: Nothing returned'));
    }

}

module.exports = HubDriver;
