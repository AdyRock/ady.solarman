/* jslint node: true */

'use strict';

if (process.env.DEBUG === '1')
{
    // eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
    require('inspector').open(9229, '0.0.0.0', true);
}

const Homey = require('homey');
const { OAuth2App } = require('homey-oauth2app');
const SolarmanOAuth2Client = require('./lib/SolarmanOAuth2Client');
const nodemailer = require('nodemailer');

const Scanner = require('./lib/scanner');
const Sensor = require('./lib/sensor');

const MINIMUM_POLL_INTERVAL = 120; // in Seconds
class MyApp extends OAuth2App
{
    static OAUTH2_CLIENT = SolarmanOAuth2Client; // Default: OAuth2Client
    static OAUTH2_DEBUG = true; // Default: false
    static OAUTH2_MULTI_SESSION = false; // Default: false

    /**
     * onInit is called when the app is initialized.
     */
    async onOAuth2Init()
    {
        this.log('Solarman has been initialized');
        this.useLocalDevice = false;

        process.on('unhandledRejection', (reason, promise) =>
        {
            this.log('Unhandled Rejection at:', promise, 'reason:', reason);
            this.updateLog('Unhandled Rejection',
            {
                message: promise,
                stack: reason,
            }, 0);
        });

        this.diagLog = '';

        if (process.env.DEBUG === '1')
        {
            this.homey.settings.set('debugMode', true);
        }
        else
        {
            this.homey.settings.set('debugMode', false);
        }

        this.scannerFoundADevice = this.scannerFoundADevice.bind(this);
        this.getInverterData = this.getInverterData.bind(this);

        // Callback for app settings changed
        this.homey.settings.on('set', async function settingChanged(setting) {});

        this.onHubPoll = this.onHubPoll.bind(this);
        this.hubDevices = 0;
        this.timerHubID = null;

        this.lanSensors = [];
        this.lanSensorTimer = null;

        try
        {
            this.homeyIP = await this.homey.cloud.getLocalAddress();
            if (this.homeyIP)
            {
                // Remove the port number
                let ip = this.homeyIP.split(':');

                this.scanner = new Scanner(this.homey, ip[0]);
                this.scanner.startScanning(this.scannerFoundADevice);
            }
        }
        catch (err)
        {
            // Homey cloud or Bridge so no LAN access
            this.homeyIP = null;
            this.scanner = null;
        }

        this.homey.app.updateLog('************** App has initialised. ***************');
    }

    async startLocalFetch()
    {
        if (!this.useLocalDevice)
        {
            this.useLocalDevice = true;
            this.getInverterData();
        }
    }

    async scannerFoundADevice(ip, serial)
    {
        this.updateLog(`Found Inverter: : ${ip}, ${serial}`, 0);
        await this.registerSensor(ip, serial);

        if (this.lanSensorTimer === null)
        {
            this.lanSensorTimer = this.homey.setTimeout(async () =>
            {
                this.getInverterData();
            }, 1000);
        }
    }

    async getInverterData()
    {
        if (this.useLocalDevice)
        {
            this.updateLog('Get Data');

            for (let sensor of this.lanSensors)
            {
                let result = await sensor.getStatistics();

                if (result !== null)
                {
                    const serial = sensor.getSerial();

                    this.updateLog(`Inverter data: : ${serial}, ${this.varToString(result)}`);
        
                    const drivers = this.homey.drivers.getDrivers();
                    for (const driver in drivers)
                    {
                        let devices = this.homey.drivers.getDriver(driver).getDevices();

                        for (let device of devices)
                        {
                            if (device.updateLanDeviceValues)
                            {
                                device.updateLanDeviceValues(serial, result);
                            }
                        }
                    }
                }
                else
                {
                    this.updateLog('No Data');
                }
            }
            
            this.lanSensorTimer = this.homey.setTimeout(async () =>
            {
                this.getInverterData();
            }, 10000);
        }
    }

    async registerSensor(ip, serial)
    {
        for (let sensor of this.lanSensors)
        {
            // Check if this one already registered
            if (sensor.getSerial() === serial)
            {
                // Yep, found it so update the IP just incase it changed
                sensor.setHost(ip);
                return;
            }
        }

        // let sensor = new Sensor(serial, ip, 8899, 1, 'sofar_hy_es');
        let sensor = await this.checkSensor(ip, serial, 14, 'sofar_lsw3');
        if (sensor === null)
        {
            sensor = await this.checkSensor(ip, serial, 524, 'sofar_hy_es');
        }

        if (sensor)
        {
            this.lanSensors.push(sensor);
        }
    }

    async checkSensor( ip, serial, register, lookup_file )
    {
        let sensor = new Sensor(serial, ip, 8899, 1, lookup_file);
        try
        {
            let frequency = await sensor.getRegisterValue(register, register, 3);
            if ((frequency < 4500) || (frequency > 6500))
            {
                return null;
            }
        }
        catch (err)
        {
            return null;
        }

        return sensor;
    }

    getDiscoveredInverters()
    {
        return this.lanSensors;
    }

    getInverter(serial)
    {
        if (this.lanSensors.length > 0)
        {
            for (const inverter of this.lanSensors)
            {
                if (inverter.inverter_sn === serial)
                {
                    return inverter;
                }
            }
        }

        return null;
    }

    async GetRegisterValue(register)
    {
        if (this.lanSensors.length > 0)
        {
            let registerNumber = parseInt(register);
            return await this.lanSensors[0].getRegisterValue(registerNumber, registerNumber, 3);
        }

        return 'No inverter available';
    }

    async onUninit() {}

    hashCode(s)
    {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        return h;
    }

    varToString(source)
    {
        try
        {
            if (source === null)
            {
                return 'null';
            }
            if (source === undefined)
            {
                return 'undefined';
            }
            if (source instanceof Error)
            {
                const stack = source.stack.replace('/\\n/g', '\n');
                return `${source.message}\n${stack}`;
            }
            if (typeof(source) === 'object')
            {
                const getCircularReplacer = () =>
                {
                    const seen = new WeakSet();
                    return (key, value) =>
                    {
                        if (typeof value === 'object' && value !== null)
                        {
                            if (seen.has(value))
                            {
                                return '';
                            }
                            seen.add(value);
                        }
                        return value;
                    };
                };

                return JSON.stringify(source, getCircularReplacer(), 2);
            }
            if (typeof(source) === 'string')
            {
                return source;
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`VarToString Error: ${err}`, 0);
        }

        return source.toString();
    }

    updateLog(newMessage, errorLevel = 1)
    {
        this.log(newMessage);
        if (errorLevel === 0)
        {
            this.error(newMessage);
        }

        if ((errorLevel === 0) || (((errorLevel & 1) === 1) && this.homey.settings.get('logEnabled')) || (((errorLevel & 2) === 2) && this.homey.settings.get('logNetEnabled')))
        {
            try
            {
                const nowTime = new Date(Date.now());

                this.diagLog += '\r\n* ';
                this.diagLog += nowTime.toJSON();
                this.diagLog += '\r\n';

                this.diagLog += newMessage;
                this.diagLog += '\r\n';
                if (this.diagLog.length > 60000)
                {
                    this.diagLog = this.diagLog.substr(this.diagLog.length - 60000);
                }

                if (this.homeyIP)
                {
                    this.homey.api.realtime('logupdated', { log: this.diagLog });
                }
            }
            catch (err)
            {
                this.log(err);
            }
        }
    }

    // Send the log to the developer (not applicable to Homey cloud)
    async sendLog(body)
    {
        let tries = 5;

        let logData;
        if (body.logType === 'diag')
        {
            logData = this.diagLog;
        }

        while (tries-- > 0)
        {
            try
            {
                // create reusable transporter object using the default SMTP transport
                const transporter = nodemailer.createTransport(
                {
                    host: Homey.env.MAIL_HOST, // Homey.env.MAIL_HOST,
                    port: 465,
                    ignoreTLS: false,
                    secure: true, // true for 465, false for other ports
                    auth:
                    {
                        user: Homey.env.MAIL_USER, // generated ethereal user
                        pass: Homey.env.MAIL_SECRET, // generated ethereal password
                    },
                    tls:
                    {
                        // do not fail on invalid certs
                        rejectUnauthorized: false,
                    },
                }, );

                // send mail with defined transport object
                const info = await transporter.sendMail(
                {
                    from: `"Homey User" <${Homey.env.MAIL_USER}>`, // sender address
                    to: Homey.env.MAIL_RECIPIENT, // list of receivers
                    subject: `Sofar & Solarman ${body.logType} log (${Homey.manifest.version})`, // Subject line
                    text: logData, // plain text body
                }, );

                this.updateLog(`Message sent: ${info.messageId}`);
                // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

                // Preview only available when sending through an Ethereal account
                this.log('Preview URL: ', nodemailer.getTestMessageUrl(info));
                return this.homey.__('settings.logSent');
            }
            catch (err)
            {
                this.updateLog(`Send log error: ${err.message}`, 0);
            }
        }

        return (this.homey.__('settings.logSendFailed'));
    }

    async Delay(period)
    {
        await new Promise(resolve => this.homey.setTimeout(resolve, period));
    }

    registerHUBPolling()
    {
        this.hubDevices++;
        if (this.timerHubID === null)
        {
            this.timerHubID = this.homey.setTimeout(this.onHubPoll, 1000);
        }
    }

    unregisterHUBPolling()
    {
        this.hubDevices--;
        if ((this.hubDevices === 0) && (this.timerHubID !== null))
        {
            this.homey.clearTimeout(this.timerHubID);
            this.timerHubID = null;
        }
    }

    async onHubPoll()
    {
        if (this.timerHubID)
        {
            this.homey.clearTimeout(this.timerHubID);
            this.timerHubID = null;
        }

        const promises = [];

        const drivers = this.homey.drivers.getDrivers();
        for (const driver of Object.values(drivers))
        {
            const devices = driver.getDevices();
            for (const device of Object.values(devices))
            {
                if (device.getHubDeviceValues)
                {
                    promises.push(device.getHubDeviceValues());
                }
            }
        }

        await Promise.all(promises);

        let nextInterval = (MINIMUM_POLL_INTERVAL * 1000);
        this.timerHubID = this.homey.setTimeout(this.onHubPoll, nextInterval);
    }
}

module.exports = MyApp;