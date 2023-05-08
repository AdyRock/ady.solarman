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
        if (this.hasCapability('meter_power.today_import'))
        {
            if (!this.hasCapability('meter_cost.today_import') && (this.getSetting('standard') > 0))
            {
                // Add the missing standard cost capability
                this.addCapability('meter_cost.today_import').catch(this.error);
            }

            if (this.getSetting('dual_rate'))
            {
                if (!this.hasCapability('meter_power.hi_rate_import') && (this.getSetting('lo') > 0))
                {
                    this.addCapability('meter_power.hi_rate_import').catch(this.error);
                    this.addCapability('meter_cost.hi_rate_import').catch(this.error);
                    this.addCapability('meter_power.low_rate_import').catch(this.error);
                    this.addCapability('meter_cost.low_rate_import').catch(this.error);
                }
            }
        }

        this.startPower = this.getStoreValue('startPower');
        this.endPower = this.getStoreValue('endPower');
        if (!this.startPower)
        {
            this.startPower = 0;
        }
        if (!this.endPower)
        {
            this.endPower = 0;
        }

        this.log('GridDevice has been initialized');
    }

    async onSettings({ oldSettings, newSettings, changedKeys })
    {
        if (changedKeys.indexOf('dual_rate') >= 0)
        {
            if (newSettings.dual_rate)
            {
                if (this.hasCapability('meter_power.today_import'))
                {
                    this.addCapability('meter_power.hi_rate_import').catch(this.error);
                    this.addCapability('meter_cost.hi_rate_import').catch(this.error);
                    this.addCapability('meter_power.low_rate_import').catch(this.error);
                    this.addCapability('meter_cost.low_rate_import').catch(this.error);
                }
            }
            else
            {
                this.removeCapability('meter_power.hi_rate_import').catch(this.error);
                this.removeCapability('meter_cost.hi_rate_import').catch(this.error);
                this.removeCapability('meter_power.low_rate_import').catch(this.error);
                this.removeCapability('meter_cost.low_rate_import').catch(this.error);
            }
        }

        if (changedKeys.indexOf('cost_units') >= 0)
        {
            // Update the of all the cost capabilities
            let options = this.getCapabilityOptions('meter_cost.today_import');
            options.units = newSettings.cost_units;
            this.setCapabilityOptions('meter_cost.today_import', options);

            options = this.getCapabilityOptions('meter_cost.hi_rate_import');
            options.units = newSettings.cost_units;
            this.setCapabilityOptions('meter_cost.hi_rate_import', options);

            options = this.getCapabilityOptions('meter_cost.low_rate_import');
            options.units = newSettings.cost_units;
            this.setCapabilityOptions('meter_cost.low_rate_import', options);
        }
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
                        if (!group.items.find((element) => element.name === 'Import_Today'))
                        {
                            this.removeCapability('meter_power.today_import');
                            this.removeCapability('meter_power.hi_rate_import');
                            this.removeCapability('meter_cost.hi_rate_import');
                            this.removeCapability('meter_power.low_rate_import');
                            this.removeCapability('meter_cost.low_rate_import');
                            this.removeCapability('meter_cost');
                        }
                    }

                    if (this.hasCapability('meter_power.today_export'))
                    {
                        if (!group.items.find((element) => element.name === 'Export_Today'))
                        {
                            this.removeCapability('meter_power.today_export');
                        }
                    }

                    if (this.hasCapability('meter_power.total_import'))
                    {
                        if (!group.items.find((element) => element.name === 'Total_Import'))
                        {
                            this.removeCapability('meter_power.total_import');
                        }
                    }

                    if (this.hasCapability('meter_power.total_export'))
                    {
                        if (!group.items.find((element) => element.name === 'Total_Export'))
                        {
                            this.removeCapability('meter_power.total_export');
                        }
                    }

                    this.CapabilitiesChecked = true;
                }
            }
        }
    }

    convertTZ(date, tzString)
    {
        return new Date((typeof date === 'string' ? new Date(date) : date).toLocaleString('en-US', { timeZone: tzString }));
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

                // Import with cost and dual rate option
                if (this.hasCapability('meter_power.today_import') && data.Import_Today > 0)
                {
                    this.setCapabilityValue('meter_power.today_import', data.Import_Today).catch(this.error);

                    if (this.getSetting('dual_rate'))
                    {
                        // Dual rate enabled. Get date in local time
                        const tz = this.homey.clock.getTimezone();
                        const nowTime = this.convertTZ(new Date(), tz);
                        let standardCost = 0;
                        let lowCost = 0;

                        if ((nowTime.getHours() < this.getSetting('start_hour')) && (nowTime.getMinutes() < this.getSetting('start_minute')))
                        {
                            // Before the low rate period so just record import power up to start
                            if (this.startPower !== data.Import_Today)
                            {
                                this.startPower = data.Import_Today;
                                this.setStoreValue('startPower', this.startPower);

                                const unitPrice = this.getSetting('standard');
                                if (unitPrice > 0)
                                {
                                    standardCost = this.startPower * unitPrice;
                                    this.setCapabilityValue('meter_cost.today_import', standardCost).catch(this.error);
                                }

                                if (this.endPower > 0)
                                {
                                    this.endPower = 0;
                                    this.setStoreValue('endPower', this.endPower);
                                    this.setCapabilityValue('meter_power.low_rate_import', 0).catch(this.error);
                                    this.setCapabilityValue('meter_cost.low_rate_import', 0).catch(this.error);
                                }
                            }
                        }
                        else if ((nowTime.getHours() < this.getSetting('end_hour')) && (nowTime.getMinutes() < this.getSetting('end_minute')))
                        {
                            // In the low rate period
                            if ((this.getSetting('start_hour') === 0) && (this.getSetting('start_minute') === 0) && (this.startPower !== 0))
                            {
                                // Trap for low rate starting a midnight to clear startPower
                                this.startPower = 0;
                                this.setStoreValue('startPower', this.startPower);
                                this.setCapabilityValue('meter_power.today_import', 0).catch(this.error);
                            }

                            if (this.endPower !== data.Import_Today)
                            {
                                // Power has updated so update the end power then we know how much was used during the low rate
                                this.endPower = data.Import_Today;
                                this.setStoreValue('endPower', this.endPower);

                                const lowToday = this.endPower - this.startPower;
                                this.setCapabilityValue('meter_power.low_rate_import', lowToday).catch(this.error);
                                const unitPrice = this.getSetting('lo');
                                if (unitPrice > 0)
                                {
                                    lowCost = lowToday * unitPrice;
                                    this.setCapabilityValue('meter_cost.low_rate_import', lowCost).catch(this.error);
                                }
                            }
                        }
                        else
                        {
                            // After low rate period
                            const standardToday = data.Import_Today - (this.endPower - this.startPower);
                            this.setCapabilityValue('meter_power.hi_rate_import', standardToday).catch(this.error);
                            const unitPrice = this.getSetting('standard');
                            if (unitPrice > 0)
                            {
                                standardCost = standardToday * unitPrice;
                                this.setCapabilityValue('meter_cost.hi_rate_import', standardCost).catch(this.error);
                            }

                            if (lowCost === 0)
                            {
                                const lowToday = this.endPower - this.startPower;
                                this.setCapabilityValue('meter_power.low_rate_import', lowToday).catch(this.error);
                                const unitPrice = this.getSetting('lo');
                                if (unitPrice > 0)
                                {
                                    lowCost = lowToday * unitPrice;
                                    this.setCapabilityValue('meter_cost.low_rate_import', lowCost).catch(this.error);
                                }
                            }
                        }
                        // Total cost for dual tarrif is cost at low rate + cost at standard rate
                        this.setCapabilityValue('meter_cost.today_import', standardCost + lowCost).catch(this.error);
                    }
                    else
                    {
                        // Not using dual rate tarrif so cost is  total * standard rate
                        this.setCapabilityValue('meter_cost.today_import', data.Import_Today * this.getSetting('standard')).catch(this.error);
                    }
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
