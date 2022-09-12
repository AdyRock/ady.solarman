/* jslint node: true */

'use strict';

const LanDevice = require('../lan_device');

class GridDevice extends LanDevice
{
    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        await super.onInit();

        this.log('GridDevice has been initialized');
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

                this.setCapabilityValue('measure_power', -data.Grid_Power).catch(this.error);
                this.setCapabilityValue('measure_voltage', data.Grid_Voltage).catch(this.error);
                this.setCapabilityValue('measure_current', data.Grid_Current).catch(this.error);
                this.setCapabilityValue('measure_frequency', data.Grid_Frequency).catch(this.error);

                this.setCapabilityValue('meter_power.today_import', data.Import_Today).catch(this.error);
                this.setCapabilityValue('meter_power.today_export', data.Export_Today).catch(this.error);
                this.setCapabilityValue('meter_power.total_import', data.Total_Import).catch(this.error);
                this.setCapabilityValue('meter_power.total_export', data.Total_Export).catch(this.error);
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getLanDeviceValues: : ${this.homey.app.varToString(err)}`, 0);
            this.setUnavailable(err.message);
        }
    }
}

module.exports = GridDevice;
