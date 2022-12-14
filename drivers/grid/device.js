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

    checkCapabilities(serial)
    {
        const inverter = this.homey.app.getInverter(serial);
        if (inverter)
        {
            for (const group of inverter.inverter.parameter_definition.parameters)
            {
                if (group.group === 'grid')
                {
                    if (this.hasCapability('meter_power.today_import'))
                    {
                        if (!group.items.find(element => element.name === 'Import_Today'))
                        {
                            this.removeCapability('meter_power.today_import');
                        }
                    }

                    if (this.hasCapability('meter_power.today_export'))
                    {
                        if (!group.items.find(element => element.name === 'Export_Today'))
                        {
                            this.removeCapability('meter_power.today_export');
                        }
                    }
                    
                    if (this.hasCapability('meter_power.total_import'))
                    {
                        if (!group.items.find(element => element.name === 'Total_Import'))
                        {
                            this.removeCapability('meter_power.total_import');
                        }
                    }
                    
                    if (this.hasCapability('meter_power.total_export'))
                    {
                        if (!group.items.find(element => element.name === 'Total_Export'))
                        {
                            this.removeCapability('meter_power.total_export');
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

                this.setCapabilityValue('measure_power', -data.Grid_Power).catch(this.error);
                if (data.Grid_Voltage)
                {
                    this.setCapabilityValue('measure_voltage', data.Grid_Voltage).catch(this.error);
                }
                if (data.Grid_Current)
                {
                    this.setCapabilityValue('measure_current', data.Grid_Current).catch(this.error);
                }
                if (data.Grid_Frequency)
                {
                    this.setCapabilityValue('measure_frequency', data.Grid_Frequency).catch(this.error);
                }
                if (this.hasCapability('meter_power.today_import') && data.Import_Today > 0)
                {
                    this.setCapabilityValue('meter_power.today_import', data.Import_Today).catch(this.error);
                }
                if (this.hasCapability('meter_power.today_export') && data.Export_Today > 0)
                {
                    this.setCapabilityValue('meter_power.today_export', data.Export_Today).catch(this.error);
                }
                if (this.hasCapability('meter_power.total_import') && data.Total_Import > 0)
                {
                    this.setCapabilityValue('meter_power.total_import', data.Total_Import).catch(this.error);
                }
                if (this.hasCapability('meter_power.total_export') && data.Total_Export > 0)
                {
                    this.setCapabilityValue('meter_power.total_export', data.Total_Export).catch(this.error);
                }
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
