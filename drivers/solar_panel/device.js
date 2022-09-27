/* jslint node: true */

'use strict';

const LanDevice = require('../lan_device');

class SolarPanelDevice extends LanDevice
{
    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        await super.onInit();

        this.log('SolarPanelDevice has been initialized');
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {}

    async updateLanDeviceValues(serial, data)
    {
        try
        {
            const dd = this.getData();

            if (serial === dd.id)
            {
                this.setAvailable();

                if (data.PV_Power)
                {
                    this.setCapabilityValue('measure_power', data.PV_Power).catch(this.error);
                }
                if (data.Daily_Production > 0)
                {
                    this.setCapabilityValue('meter_power.today', data.Daily_Production).catch(this.error);
                }
                if (data.Total_Generation > 0)
                {
                    this.setCapabilityValue('meter_power', data.Total_Generation).catch(this.error);
                }
                if (data.PV1_Power)
                {
                    this.setCapabilityValue('measure_power.pv1', data.PV1_Power).catch(this.error);
                }
                if (data.PV1_Voltage)
                {
                    this.setCapabilityValue('measure_voltage.pv1', data.PV1_Voltage).catch(this.error);
                }
                if (data.PV1_Current)
                {
                    this.setCapabilityValue('measure_current.pv1', data.PV1_Current).catch(this.error);
                }
                if (data.PV2_Power)
                {
                    this.setCapabilityValue('measure_power.pv2', data.PV2_Power).catch(this.error);
                }
                if (data.PV2_Voltage)
                {
                    this.setCapabilityValue('measure_voltage.pv2', data.PV2_Voltage).catch(this.error);
                }
                if (data.PV2_Current)
                {
                    this.setCapabilityValue('measure_current.pv2', data.PV2_Current).catch(this.error);
                }
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`updateLanDeviceValues: : ${this.homey.app.varToString(err)}`);
            this.setUnavailable(err.message);
        }
    }
}

module.exports = SolarPanelDevice;