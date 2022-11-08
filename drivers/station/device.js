/* jslint node: true */

'use strict';

const HubDevice = require('../hub_device');

class StationDevice extends HubDevice
{

    /**
     * onInit is called when the device is initialized.
     */
    async onInit()
    {
        if (!this.hasCapability('measure_update_time'))
        {
            this.addCapability('measure_update_time');
        }

        await super.onInit();

        this.log('StationDevice has been initialized');
    }

    async onSettings({ oldSettings, newSettings, changedKeys })
    {
        if (changedKeys.indexOf("timeFormat") >= 0)
        {
            const update_time = this.getCapabilityValue('measure_update_time');
            this.setCapabilityValue('measure_update_time', this.convertDate(update_time, newSettings)).catch(this.error);
        }
    }

    async getHubDeviceValues()
    {
        try
        {
            const data = await this._getHubDeviceValues();
            if (data)
            {
                this.setAvailable();
                const settings = this.getSettings();

                this.setCapabilityValue('measure_power.solar', data.generationPower).catch(this.error);
                this.setCapabilityValue('measure_power.grid', data.wirePower * -1).catch(this.error);
                this.setCapabilityValue('measure_power.battery', data.batteryPower).catch(this.error);
                this.setCapabilityValue('measure_power.consumption', data.usePower).catch(this.error);
                this.setCapabilityValue('meter_power.total', data.generationTotal).catch(this.error);
                this.setCapabilityValue('measure_battery', data.batterySoc).catch(this.error);
                this.setCapabilityValue('measure_update_time',this.convertDate(data.lastUpdateTime, settings)).catch(this.error);
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getHubDeviceValues: : ${this.homey.app.varToString(err)}`, 0);
            this.setUnavailable(err.message);
        }
    }

    convertDate(date, settings)
    {
        var strDate = "";
        if (date)
        {
            let tz = this.homey.clock.getTimezone();
            let lang = this.homey.i18n.getLanguage();

            let date_string = new Date().toLocaleString(lang, { timeZone: tz });   
            let d = new Date(date_string);

            if (settings.timeFormat == "mm_dd")
            {
                let mins = d.getMinutes();
                let dte = d.getDate();
                let month = d.toLocaleString(lang, {month: 'short'});
                strDate = d.getHours() + ":" + (mins < 10 ? "0" : "") + mins + " " + month + (dte < 10 ? " 0" : " ") + dte;
            }
            else if (settings.timeFormat == "system")
            {
                strDate = d.toLocaleString();
            }
            else if (settings.timeFormat == "time_stamp")
            {
                strDate = d.toJSON();
            }
            else
            {
                strDate = date;
            }
        }

        return strDate;
    }

}

module.exports = StationDevice;
