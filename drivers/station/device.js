/* jslint node: true */

'use strict';

const HubDevice = require('../hub_device');
const MINIMUM_POLL_INTERVAL = 5 * 60; // 5 minutes in Seconds

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

        if (!this.hasCapability('meter_power.total_today'))
        {
            this.addCapability('meter_power.total_today');
        }

        if (!this.hasCapability('meter_power.total_yesterday'))
        {
            this.addCapability('meter_power.total_yesterday');
        }

        await super.onInit();

        this.lastUpdateTime = 0;
        this.onRealTimePoll = this.onRealTimePoll.bind(this);
        this.onRealTimePoll();

        this.onHistoryPoll = this.onHistoryPoll.bind(this);
        this.onHistoryPoll();

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

    async onRealTimePoll()
    {
        let nextInterval = MINIMUM_POLL_INTERVAL;
        if (this.timerRealTime)
        {
            this.homey.clearTimeout(this.timerRealTime);
            this.timerRealTime = null;
            nextInterval = await this.getRealTimeValues();
        }

        this.timerRealTime = this.homey.setTimeout(this.onRealTimePoll, nextInterval);
    }

    async onHistoryPoll()
    {
        let nextInterval = MINIMUM_POLL_INTERVAL + (Math.random() * (5 * 60 * 1000));
        if (this.timerHistory)
        {
            this.homey.clearTimeout(this.timerHistory);
            this.timerHistory = null;
            nextInterval = await this.getHistoricalValues();
        }

        this.timerHistory = this.homey.setTimeout(this.onHistoryPoll, nextInterval);
    }

    async getRealTimeValues()
    {
        try
        {
            const data = await this._getHubDeviceValues();
            if (data)
            {
                if (data.msg)
                {
                    throw new Error(data.msg);
                }

                this.homey.app.updateLog(`getHubDeviceValues: : ${this.homey.app.varToString(data)}`, 2);
                this.setWarning("");

                this.setAvailable();
                const settings = this.getSettings();

                this.setCapabilityValue('measure_power.solar', data.generationPower).catch(this.error);
                this.setCapabilityValue('measure_power.grid', data.wirePower * -1).catch(this.error);
                this.setCapabilityValue('measure_power.battery', data.batteryPower).catch(this.error);
                this.setCapabilityValue('measure_power.consumption', data.usePower).catch(this.error);
                this.setCapabilityValue('meter_power.total', data.generationTotal).catch(this.error);
                this.setCapabilityValue('measure_battery', data.batterySoc).catch(this.error);
                this.setCapabilityValue('measure_update_time', this.convertDate(data.lastUpdateTime, settings)).catch(this.error);

                // Update every 20 minutes
                return  (20 * 60 * 1000);
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getHubDeviceValues: : ${this.homey.app.varToString(err)}`, 0);
            if (err.message.search("insufficient allowance"))
            {
                this.setWarning("Rate limit");
                return (120 * 60 * 1000);    // Back off for 2 hours
            }
            this.setUnavailable(err.message);
        }

        return (MINIMUM_POLL_INTERVAL * 1000);
    }

    async getHistoricalValues()
    {
        try
        {
            const history = await this._getHubHistory();
            if (history)
            {
                if (history.msg)
                {
                    throw new Error(history.msg);
                }

                this.homey.app.updateLog(`getHistoricalValues: : ${this.homey.app.varToString(history)}`, 2);
                this.setWarning("");

                this.setCapabilityValue('meter_power.total_today', history.stationDataItems[1].generationValue).catch(this.error);
                this.setCapabilityValue('meter_power.total_yesterday', history.stationDataItems[0].generationValue).catch(this.error);
                this.setCapabilityValue('meter_power.battery_charge_today', history.stationDataItems[1].chargeValue).catch(this.error);
                this.setCapabilityValue('meter_power.battery_charge_yesterday', history.stationDataItems[0].chargeValue).catch(this.error);
                this.setCapabilityValue('meter_power.battery_discharge_today', history.stationDataItems[1].dischargeValue).catch(this.error);
                this.setCapabilityValue('meter_power.battery_discharge_yesterday', history.stationDataItems[0].dischargeValue).catch(this.error);
        
                // Update once per hour
                return (60 * 60 * 1000);
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getHistoricalValues: : ${this.homey.app.varToString(err)}`, 0);
            if (err.message.search("insufficient allowance"))
            {
                this.setWarning("Rate limit");
                return (120 * 60 * 1000);    // Back off for 2 hours
            }
        }

        return (MINIMUM_POLL_INTERVAL * 1000);
    }

    convertDate(date, settings)
    {
        var strDate = "";
        if (date)
        {
            let tz = this.homey.clock.getTimezone();
            let lang = this.homey.i18n.getLanguage();
            let dateToConvert = new Date(date * 1000);

            let date_string = dateToConvert.toLocaleString(lang, { timeZone: tz });   
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
