/* jslint node: true */

'use strict';

const OAuth2Client = require('./OAuth2Client');
const OAuth2Error = require('./OAuth2Error');
const OAuth2Token = require('./OAuth2Token');

module.exports = class SolarmanOAuth2Client extends OAuth2Client
{

    // Required:
    static API_URL = 'https://globalapi.solarmanpv.com';
    static TOKEN_URL = 'https://globalapi.solarmanpv.com/account/v1.0/token';
    static AUTHORIZATION_URL = 'https://globalapi.solarmanpv.com/account/v1.0/token';

    // Optional:
    static TOKEN = OAuth2Token; // Default: OAuth2Token
    // static REDIRECT_URL = 'https://callback.athom.com/oauth2/callback'; // Default: 'https://callback.athom.com/oauth2/callback'

    // Overload what needs to be overloaded here

    async onHandleNotOK({ statusText })
    {
        throw new OAuth2Error(statusText);
    }

    async getStations()
    {
        // Section 4.4
        return this.post(
            {
                path: '/station/v1.0/list',
                json:
                {
                    page: 1,
                    size: 20,
                },
                query: { language: 'en' },
            },
        );
    }

    async getDevices(stationId)
    {
        // Section 4.2
        return this.post(
            {
                path: '/station/v1.0/device',
                json:
                {
                    stationId,
                },
                query: { language: 'en' },
            },
        );
    }

    async getStationData(stationId)
    {
        return this.post(
            {
                path: '/station/v1.0/realTime',
                json:
                {
                    stationId,
                },
                query: { language: 'en' },
            },
        );
    }

    async getDeviceData(deviceSn)
    {
        return this.post(
            {
                path: '/device/v1.0/currentData',
                json:
                {
                    deviceSn,
                },
                query: { language: 'en' },
            },
        );
    }

    async getStationHistory(stationId)
    {
        const today = new Date(Date.now());
        const yesterday = new Date(Date.now());
        yesterday.setDate(today.getDate() - 1);
        yesterday.setHours(0);
        yesterday.setMinutes(0);

        const [todayDate] = today.toISOString().split('T');
        const [yesterdayDate] = yesterday.toISOString().split('T');

        return this.post(
            {
                path: '/station/v1.0/history',
                json:
                {
                    stationId,
                    timeType: 2,
                    startTime: yesterdayDate,
                    endTime: todayDate,
                },
                query: { language: 'en' },
            },
        );
    }

};
