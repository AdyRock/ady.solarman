/* jslint node: true */

'use strict';

const Homey = require('homey');
const { OAuth2Client, OAuth2Error } = require('homey-oauth2app');
const { OAuth2Token } = require('homey-oauth2app');

module.exports = class SolarmanOAuth2Client extends OAuth2Client
{

    // Required:
    static API_URL = "https://api.solarmanpv.com";
    static TOKEN_URL = "https://api.solarmanpv.com/account/v1.0/token";
    static AUTHORIZATION_URL = "https://api.solarmanpv.com/account/v1.0/token";

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
        return this.post(
        {
            path: '/station/v1.0/list',
            json:
            {
                'page': 1,
                'size': 20
            },
            query: 'language=en'
        }, );
    }

    async getStationData(stationId)
    {
        return this.post(
        {
            path: `/station/v1.0/realTime`,
            json:
            {
                'stationId': stationId
            },
            query: 'language=en'
        }, );
    }

    async getStationHistory(stationId)
    {
        let today = new Date(Date.now());
        let yesterday = new Date(Date.now());
        yesterday.setDate(today.getDate() - 1);
        yesterday.setHours(0);
        yesterday.setMinutes(0);

        const [todayDate] = today.toISOString().split('T');
        const [yesterdayDate] = yesterday.toISOString().split('T');
    
        return this.post(
        {
            path: `/station/v1.0/history`,
            json:
            {
                'stationId': stationId,
                'timeType': 2,
                'startTime': yesterdayDate,
                'endTime': todayDate,
            },
            query: 'language=en'
        }, );
    }

};