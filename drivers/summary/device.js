/* jslint node: true */

'use strict';

const LanDevice = require('../lan_device');

class InverterDevice extends LanDevice
{
    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        await super.onInit();

        this.log('StationDevice has been initialized');
    }

    async onSettings({ oldSettings, newSettings, changedKeys })
    {
    }

    async updateLanDeviceValues(serial, data)
    {
        try
        {
            const dd = this.getData();

            if (serial === dd.id)
            {
                this.setAvailable();

                this.setCapabilityValue('measure_power.consumption', data.Consumption).catch(this.error);
                this.setCapabilityValue('meter_power.today_solar', data.Daily_Production).catch(this.error);
                this.setCapabilityValue('meter_power.today_consumption', data.Consumed_Today).catch(this.error);
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getLanDeviceValues: : ${this.homey.app.varToString(err)}`, 0);
            this.setUnavailable(err.message);
        }
    }
}

module.exports = InverterDevice;
