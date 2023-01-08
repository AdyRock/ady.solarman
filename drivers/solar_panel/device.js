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
        this.sumPV1_PV2 = false;

        this.log('SolarPanelDevice has been initialized');
    }

    checkCapabilities(serial)
    {
        const inverter = this.homey.app.getInverter(serial);
        if (inverter)
        {
            for (const group of inverter.inverter.parameter_definition.parameters)
            {
                if (group.group === 'grid')
                {
                    if (!group.items.find(element => element.name === 'PV_Power'))
                    {
                        this.sumPV1_PV2 = true;
                    }

                    if (this.hasCapability('meter_power.today'))
                    {
                        if (!group.items.find(element => element.name === 'Daily_Production'))
                        {
                            this.removeCapability('meter_power.today');
                        }
                    }

                    if (this.hasCapability('meter_power'))
                    {
                        if (!group.items.find(element => element.name === 'Total_Generation'))
                        {
                            this.removeCapability('meter_power.today');
                        }
                    }

                    this.CapabilitiesChecked = true;                    
                }
            }
        }
    }

    async updateLanDeviceValues(serial, data)
    {
        try
        {
            const dd = this.getData();

            if (serial === dd.id)
            {
                if (!this.CapabilitiesChecked)
                {
                    this.checkCapabilities(dd.id);
                    this.CapabilitiesChecked = true;
                }

                this.setAvailable();

                if (this.sumPV1_PV2)
                {
                    this.setCapabilityValue('measure_power', data.PV1_Power + data.PV2_Power).catch(this.error);
                }
                else
                {
                    this.setCapabilityValue('measure_power', data.PV_Power).catch(this.error);
                }

                if (this.hasCapability('meter_power.today'))
                {
                    this.setCapabilityValue('meter_power.today', data.Daily_Production).catch(this.error);
                }

                if (this.hasCapability('meter_power') && data.Total_Generation > 0)
                {
                    this.setCapabilityValue('meter_power', data.Total_Generation).catch(this.error);
                }

                this.setCapabilityValue('measure_power.pv1', data.PV1_Power).catch(this.error);
                this.setCapabilityValue('measure_voltage.pv1', data.PV1_Voltage).catch(this.error);
                this.setCapabilityValue('measure_current.pv1', data.PV1_Current).catch(this.error);
                this.setCapabilityValue('measure_power.pv2', data.PV2_Power).catch(this.error);
                this.setCapabilityValue('measure_voltage.pv2', data.PV2_Voltage).catch(this.error);
                this.setCapabilityValue('measure_current.pv2', data.PV2_Current).catch(this.error);
                this.setCapabilityValue('measure_generation_time', data.Generation_Time_Today).catch(this.error);
                this.setCapabilityValue('measure_generation_time_total', data.Generation_Time_Total).catch(this.error);
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
