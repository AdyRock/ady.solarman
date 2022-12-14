/* jslint node: true */

'use strict';

const HubDevice = require('../hub_device');
const MINIMUM_POLL_INTERVAL = 120; // in Seconds

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
        if (this.timerRealTime)
        {
            this.homey.clearTimeout(this.timerRealTime);
            this.timerRealTime = null;
        }

        let nextInterval = await this.getRealTimeValues();
        this.timerRealTime = this.homey.setTimeout(this.onRealTimePoll, nextInterval);
    }

    async onHistoryPoll()
    {
        if (this.timerHistory)
        {
            this.homey.clearTimeout(this.timerHistory);
            this.timerHistory = null;
        }

        let nextInterval = await this.getHistoricalValues();
        this.timerRealTime = this.homey.setTimeout(this.onHistoryPoll, nextInterval);
    }

    async getRealTimeValues()
    {
        try
        {
            const data = await this._getHubDeviceValues();
            if (data)
            {
                this.homey.app.updateLog(`getHubDeviceValues: : ${this.homey.app.varToString(data)}`, 2);

                this.setAvailable();
                const settings = this.getSettings();

                this.setCapabilityValue('measure_power.solar', data.generationPower).catch(this.error);
                this.setCapabilityValue('measure_power.grid', data.wirePower * -1).catch(this.error);
                this.setCapabilityValue('measure_power.battery', data.batteryPower).catch(this.error);
                this.setCapabilityValue('measure_power.consumption', data.usePower).catch(this.error);
                this.setCapabilityValue('meter_power.total', data.generationTotal).catch(this.error);
                this.setCapabilityValue('measure_battery', data.batterySoc).catch(this.error);
                this.setCapabilityValue('measure_update_time', this.convertDate(data.lastUpdateTime, settings)).catch(this.error);

                if (data.lastUpdateTime)
                {
                    if (this.lastUpdateTime !== data.lastUpdateTime)
                    {
                        this.lastUpdateTime = data.lastUpdateTime; 

                        let updateTime = new Date(data.lastUpdateTime * 1000);
                        const minutes = updateTime.getMinutes() + 17;
                        updateTime.setMinutes(minutes);
                        const nextInterval = updateTime - new Date(Date.now());
                        if (nextInterval >= (MINIMUM_POLL_INTERVAL * 1000))
                        {
                            return nextInterval;
                        }
                    }
                }
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getHubDeviceValues: : ${this.homey.app.varToString(err)}`, 0);
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
                this.homey.app.updateLog(`getHistoricalValues: : ${this.homey.app.varToString(history)}`, 2);

                this.setCapabilityValue('meter_power.total_today', history.stationDataItems[1].generationValue).catch(this.error);
                this.setCapabilityValue('meter_power.total_yesterday', history.stationDataItems[0].generationValue).catch(this.error);
                this.setCapabilityValue('meter_power.battery_charge_today', history.stationDataItems[1].chargeValue).catch(this.error);
                this.setCapabilityValue('meter_power.battery_charge_yesterday', history.stationDataItems[0].chargeValue).catch(this.error);
                this.setCapabilityValue('meter_power.battery_discharge_today', history.stationDataItems[1].dischargeValue).catch(this.error);
                this.setCapabilityValue('meter_power.battery_discharge_yesterday', history.stationDataItems[0].dischargeValue).catch(this.error);
        
                let updateTime = new Date(Date.now());
                const hours = updateTime.getHours() + 1;
                updateTime.setHours(hours);
                updateTime.setMinutes(0);
                updateTime.setSeconds(0);

                const nextInterval = updateTime - new Date(Date.now());
                if (nextInterval >= (MINIMUM_POLL_INTERVAL * 1000))
                {
                    return nextInterval;
                }
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getHistoricalValues: : ${this.homey.app.varToString(err)}`, 0);
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
            let dateToConvert = new Date(date);

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
