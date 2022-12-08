/* jslint node: true */

'use strict';

const { OAuth2Device } = require('homey-oauth2app');

class HubDevice extends OAuth2Device
{

    async onInit()
    {
        try
        {
            await super.onInit();
        }
        catch (err)
        {
            this.log(err);
        }

        this.homey.app.registerHUBPolling();
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onOAuth2Deleted()
    {
        this.homey.app.unregisterHUBPolling();

        this.log('HubDevice has been deleted');
    }

    /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
    async onSettings({ oldSettings, newSettings, changedKeys })
    {
        // Called when settings changed
    }

    async _getHubDeviceValues()
    {
        const dd = this.getData();
        if (this.oAuth2Client)
        {
            const data = await this.oAuth2Client.getStationData(dd.id);
            return data;
        }
    }

    async _getHubHistory()
    {
        const dd = this.getData();
        if (this.oAuth2Client)
        {
            const data = await this.oAuth2Client.getStationHistory(dd.id);
            return data;
        }
    }

}

module.exports = HubDevice;
