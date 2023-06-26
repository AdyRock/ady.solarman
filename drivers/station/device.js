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

        if ((this.hasCapability('measure_power.pv1')) && (!this.hasCapability('measure_temperature.invert')))
        {
            this.addCapability('measure_temperature.invert');
            this.addCapability('measure_temperature.battery');
            this.addCapability('measure_temperature.radiator');
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
        if (changedKeys.indexOf('timeFormat') >= 0)
        {
            const updateTime = this.getCapabilityValue('measure_update_time');
            this.setCapabilityValue('measure_update_time', this.convertDate(updateTime, newSettings)).catch(this.error);
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
                this.setWarning('');

                this.setAvailable();
                const settings = this.getSettings();

                this.setCapabilityValue('measure_power.solar', data.generationPower).catch(this.error);
                this.setCapabilityValue('measure_power.grid', data.wirePower * -1).catch(this.error);
                this.setCapabilityValue('measure_power.battery', data.batteryPower).catch(this.error);
                this.setCapabilityValue('measure_power.consumption', data.usePower).catch(this.error);
                this.setCapabilityValue('meter_power.total', data.generationTotal).catch(this.error);
                this.setCapabilityValue('measure_battery', data.batterySoc).catch(this.error);
                this.setCapabilityValue('measure_update_time', this.convertDate(data.lastUpdateTime, settings)).catch(this.error);

                if (data.DP1 && this.hasCapability('measure_power.pv1'))
                {
                    this.setCapabilityValue('measure_power.pv1', data.DP1 ? parseFloat(data.DP1.value) : null).catch(this.error);
                    this.setCapabilityValue('measure_power.pv2', data.DP2 ? parseFloat(data.DP2.value) : null).catch(this.error);

                    this.setCapabilityValue('measure_voltage.pv1', data.DV1 ? parseFloat(data.DV1.value) : null).catch(this.error);
                    this.setCapabilityValue('measure_voltage.pv2', data.DV2 ? parseFloat(data.DV2.value) : null).catch(this.error);

                    this.setCapabilityValue('measure_current.pv1', data.DC1 ? parseFloat(data.DC1.value) : null).catch(this.error);
                    this.setCapabilityValue('measure_current.pv2', data.DC2 ? parseFloat(data.DC2.value) : null).catch(this.error);

                    this.setCapabilityValue('measure_temperature.invert', data.INV_T0 ? parseFloat(data.INV_T0.value) : null).catch(this.error);
                    this.setCapabilityValue('measure_temperature.battery', data.B_T1 ? parseFloat(data.B_T1.value) : null).catch(this.error);
                    this.setCapabilityValue('measure_temperature.radiator', data.T_RDT1 ? parseFloat(data.T_RDT1.value) : null).catch(this.error);
                }
                else if (this.hasCapability('measure_power.pv1'))
                {
                    this.removeCapability('measure_power.pv1').catch(this.error);
                    this.removeCapability('measure_power.pv2').catch(this.error);
                    this.removeCapability('measure_voltage.pv1').catch(this.error);
                    this.removeCapability('measure_voltage.pv2').catch(this.error);
                    this.removeCapability('measure_current.pv1').catch(this.error);
                    this.removeCapability('measure_current.pv2').catch(this.error);
                    this.removeCapability('measure_temperature.invert').catch(this.error);
                    this.removeCapability('measure_temperature.battery').catch(this.error);
                    this.removeCapability('measure_temperature.radiator').catch(this.error);
                }

                // Update every 15 minutes
                return (15 * 60 * 1000);
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getHubDeviceValues: : ${this.homey.app.varToString(err)}`, 0);
            if (err.message.search('insufficient allowance') !== -1)
            {
                this.setWarning('Rate limit');
                return (120 * 60 * 1000); // Back off for 2 hours
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
                this.setWarning('');

                const lastIdx = history.stationDataItems.length - 1;

                if (lastIdx >= 0)
                {
                    this.setCapabilityValue('meter_power.total_today', history.stationDataItems[lastIdx].generationValue).catch(this.error);
                    this.setCapabilityValue('meter_power.battery_charge_today', history.stationDataItems[lastIdx].chargeValue).catch(this.error);
                    this.setCapabilityValue('meter_power.battery_discharge_today', history.stationDataItems[lastIdx].dischargeValue).catch(this.error);

                    if (lastIdx > 0)
                    {
                        this.setCapabilityValue('meter_power.total_yesterday', history.stationDataItems[lastIdx - 1].generationValue).catch(this.error);
                        this.setCapabilityValue('meter_power.battery_charge_yesterday', history.stationDataItems[lastIdx - 1].chargeValue).catch(this.error);
                        this.setCapabilityValue('meter_power.battery_discharge_yesterday', history.stationDataItems[lastIdx - 1].dischargeValue).catch(this.error);
                    }
                }

                // Update once per hour
                return (60 * 60 * 1000);
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`getHistoricalValues: : ${this.homey.app.varToString(err)}`, 0);
            if (err.message.search('insufficient allowance') !== -1)
            {
                this.setWarning('Rate limit');
                return (120 * 60 * 1000); // Back off for 2 hours
            }
        }

        return (MINIMUM_POLL_INTERVAL * 1000);
    }

    convertDate(date, settings)
    {
        let strDate = '';
        if (date)
        {
            const tz = this.homey.clock.getTimezone();
            const lang = this.homey.i18n.getLanguage();
            const dateToConvert = new Date(date * 1000);

            const dateString = dateToConvert.toLocaleString(lang, { timeZone: tz });
            const d = new Date(dateString);

            if (settings.timeFormat === 'mm_dd')
            {
                const mins = d.getMinutes();
                const dte = d.getDate();
                const month = d.toLocaleString(lang, { month: 'short' });
                strDate = `${d.getHours()}:${mins < 10 ? '0' : ''}${mins} ${month}${dte < 10 ? ' 0' : ' '}${dte}`;
            }
            else if (settings.timeFormat === 'system')
            {
                strDate = d.toLocaleString();
            }
            else if (settings.timeFormat === 'time_stamp')
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
